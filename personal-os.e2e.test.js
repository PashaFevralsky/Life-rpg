import { test, expect } from "@playwright/test";

test("Personal OS 12 critical flows stay coherent on mobile", async ({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#versionStatus")).toContainText("12.0.0");
  expect(await page.evaluate(()=>APP_VERSION)).toBe("12.0.0");
  expect(await page.evaluate(()=>STATE_VERSION)).toBe(18);

  // One Inbox surface only. Legacy IDs remain for backward-compatible workflows.
  await page.evaluate(()=>{switchTab("today");ux7SetView("today","focus",false)});
  await expect(page.locator("#capture2Command")).toBeVisible();
  await expect(page.locator("#inboxOsCommand")).toBeVisible();
  expect(await page.locator("text=Быстрый захват").count()).toBe(0);
  await page.locator("#inboxCaptureInput").fill("E2E решение оставить один Inbox");
  await page.locator('button[onclick="captureInbox()"]',).click();
  const captureRow=page.locator("#inboxOsCommand .log-item").filter({hasText:"E2E решение"});
  await expect(captureRow).toBeVisible();
  await expect(captureRow.getByRole("button",{name:"→ Решение",exact:true})).toBeVisible();
  await captureRow.getByRole("button",{name:"→ Решение",exact:true}).click();
  expect(await page.evaluate(()=>personalData().decisions.some(x=>x.title.includes("E2E решение")))).toBe(true);

  // Unsafe free-form person routing is rejected; structured routing succeeds.
  await page.locator("#inboxCaptureInput").fill("какой-то длинный текст про человека без имени");
  await page.locator('button[onclick="captureInbox()"]',).click();
  let row=page.locator("#inboxOsCommand .log-item").filter({hasText:"какой-то длинный текст"});
  await row.getByRole("button",{name:/^(?:→ )?Человек$/}).click();
  expect(await page.evaluate(()=>peopleAll().some(x=>x.name.includes("длинный текст")))).toBe(false);
  await page.evaluate(()=>discardInbox(inboxOpen().find(x=>x.text.includes("длинный текст"))?.id));
  await page.locator("#inboxCaptureInput").fill("E2E Person: договорились созвониться");
  await page.locator('button[onclick="captureInbox()"]',).click();
  row=page.locator("#inboxOsCommand .log-item").filter({hasText:"E2E Person"});
  await row.getByRole("button",{name:/^(?:→ )?Человек$/}).click();
  expect(await page.evaluate(()=>peopleAll().some(x=>x.name==="E2E Person"))).toBe(true);

  // Focus <-> Task date synchronization and timer mutual exclusion.
  const tomorrow=await page.evaluate(()=>localDateKey(addDays(new Date(),1)));
  await page.evaluate(()=>{taskCreate({title:"E2E Focus Task",area:"Личное",priority:2,minutes:30});render()});
  await page.getByRole("button",{name:"+ Блок",exact:true}).click();
  await page.locator("#focusTask").selectOption({label:"E2E Focus Task"});
  await page.locator("#focusDate").fill(tomorrow);
  await page.locator("#focusMinutes").fill("25");
  await page.locator('button[onclick="focusAddTimebox()"]',).click();
  expect(await page.evaluate(()=>taskAll().find(x=>x.title==="E2E Focus Task")?.plannedDate)).toBe(tomorrow);
  const focusCheck=await page.evaluate(async()=>{
    const taskId=taskAll().find(x=>x.title==="E2E Focus Task").id,tb=focusTimeboxes().find(x=>x.taskId===taskId);tb.dateKey=localDateKey();let currentTask=taskAll().find(x=>x.id===taskId);currentTask.plannedDate=localDateKey();currentTask.timerStartedAt=new Date().toISOString();await focusStart(tb.id);const blockedFocus=!personalData().activeFocus?.startedAt;currentTask=taskAll().find(x=>x.id===taskId);currentTask.timerStartedAt="";await focusStart(tb.id);const blockedTask=calibrationStartTaskTimer(taskId)===false;personalData().activeFocus.startedAt=new Date(Date.now()-125000).toISOString();await focusStop();return {blockedFocus,blockedTask,actual:taskAll().find(x=>x.id===taskId)?.actualMinutes||0}
  });
  expect(focusCheck.blockedFocus).toBe(true);expect(focusCheck.blockedTask).toBe(true);expect(focusCheck.actual).toBeGreaterThanOrEqual(2);

  // People without a factual interaction do not get a fake freshness score.
  await page.locator('[data-tab="more"]').click();await page.locator('#more .ux7-tab[data-view="overview"]').click();
  await page.getByRole("button",{name:"+ Человек",exact:true}).click();await page.locator("#peopleName").fill("E2E No Contact");await page.locator("#peopleCadence").fill("7");await page.locator('button[onclick="peopleSave()"]',).click();
  const personRow=page.locator("#peopleOsList .log-item").filter({hasText:"E2E No Contact"});await expect(personRow).toContainText("связь —");

  // Body means are day-weighted.
  const bodyAvgValue=await page.evaluate(()=>{const t=localDateKey(),y=localDateKey(addDays(new Date(),-1));growthLogEvent("tracker-mood",{dateKey:t,value:2});growthLogEvent("tracker-mood",{dateKey:t,value:8});growthLogEvent("tracker-mood",{dateKey:y,value:10});return bodyAvg("tracker-mood",7)});
  expect(bodyAvgValue).toBe(7.5);

  // Buying an inventory-linked shopping item does not fabricate stock.
  const stock=await page.evaluate(async()=>{personalData().inventory.push({id:"e2e-stock",name:"E2E Stock",qty:1,minQty:5,unit:"шт",archived:false});personalData().shopping.push({id:"e2e-buy",name:"E2E Stock",inventoryId:"e2e-stock",done:false});await homeBought("e2e-buy");return homeInventory().find(x=>x.id==="e2e-stock").qty});
  expect(stock).toBe(1);

  // Import is preview-first: valid DD.MM.YYYY accepted, empty value rejected.
  await page.locator('#more .ux7-tab[data-view="settings"]').click();
  await expect(page.locator("#personalImportFile")).toBeAttached();
  await page.locator("#personalImportFile").setInputFiles({name:"personal.csv",mimeType:"text/csv",buffer:Buffer.from("date;tracker;value;durationMin;note\n23.09.2026;E2E Metric;7;;ok\n23.09.2026;E2E Empty;;;bad\n")});
  await expect(page.locator("#personalImportPreview")).toContainText("Готово");await expect(page.locator("#personalImportPreview")).toContainText("Ошибки");
  expect(await page.evaluate(()=>growthTrackers().some(x=>x.name==="E2E Metric"))).toBe(false);
  await page.locator("#personalImportApply").click();
  expect(await page.evaluate(()=>growthTrackers().some(x=>x.name==="E2E Metric"))).toBe(true);
  expect(await page.evaluate(()=>growthTrackers().some(x=>x.name==="E2E Empty"))).toBe(false);

  // Search now includes Personal OS entities and gives a navigation action.
  await page.locator("#dashboardSearchInput").fill("E2E No Contact");
  await expect(page.locator("#dashboardSearchResults")).toContainText("E2E No Contact");
  await expect(page.locator("#dashboardSearchResults").getByRole("button",{name:"Открыть"}).first()).toBeVisible();

  // Personal OS must not introduce horizontal overflow on the phone viewport.
  for(const [section,view] of [["today","focus"],["more","overview"],["more","settings"]]){
    await page.evaluate(([s,v])=>{switchTab(s);ux7SetView(s,v,false)},[section,view]);
    const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth);expect(overflow).toBeLessThanOrEqual(1)
  }
  expect(errors).toEqual([]);
});
