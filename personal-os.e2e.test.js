import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#versionStatus")).toContainText("12.5.0");
  expect(await page.evaluate(()=>APP_VERSION)).toBe("12.5.0");
  expect(await page.evaluate(()=>STATE_VERSION)).toBe(18);
  return errors
}
async function openTodayFocus(page){await page.evaluate(()=>{switchTab("today");ux7SetView("today","focus",false)})}
async function openMore(page,view){await page.locator('[data-tab="more"]').click();await page.locator(`#more .ux7-tab[data-view="${view}"]`).click()}

test("Personal OS capture routes are stable and keep one Inbox surface",async({page})=>{
  const errors=await boot(page);await openTodayFocus(page);
  await expect(page.locator("#capture2Command")).toBeVisible();
  await expect(page.locator("#inboxOsCommand")).toBeVisible();
  expect(await page.locator("text=Быстрый захват").count()).toBe(0);

  await page.locator("#inboxCaptureInput").fill("E2E решение оставить один Inbox");
  await page.locator('[data-testid="capture-add"]').click();
  let row=page.locator("#inboxOsCommand .log-item").filter({hasText:"E2E решение"});
  await expect(row).toBeVisible();
  await row.locator('[data-route="decision"]').click();
  expect(await page.evaluate(()=>personalData().decisions.some(x=>x.title.includes("E2E решение")))).toBe(true);

  await page.locator("#inboxCaptureInput").fill("какой-то длинный текст про человека без имени");
  await page.locator('[data-testid="capture-add"]').click();
  row=page.locator("#inboxOsCommand .log-item").filter({hasText:"какой-то длинный текст"});
  await row.locator('[data-route="person"]').click();
  expect(await page.evaluate(()=>peopleAll().some(x=>x.name.includes("длинный текст")))).toBe(false);
  await page.evaluate(()=>discardInbox(inboxOpen().find(x=>x.text.includes("длинный текст"))?.id));

  await page.locator("#inboxCaptureInput").fill("E2E Person: договорились созвониться");
  await page.locator('[data-testid="capture-add"]').click();
  row=page.locator("#inboxOsCommand .log-item").filter({hasText:"E2E Person"});
  await row.locator('[data-route="person"]').click();
  expect(await page.evaluate(()=>peopleAll().some(x=>x.name==="E2E Person"))).toBe(true);
  expect(errors).toEqual([])
});

test("Focus and Task planning/timers stay coherent",async({page})=>{
  const errors=await boot(page);await openTodayFocus(page);
  const tomorrow=await page.evaluate(()=>localDateKey(addDays(new Date(),1)));
  await page.evaluate(()=>{taskCreate({title:"E2E Focus Task",area:"Личное",priority:2,minutes:30});render()});
  await page.locator('[data-testid="focus-add"]').click();
  await page.locator("#focusTask").selectOption({label:"E2E Focus Task"});
  await page.locator("#focusDate").fill(tomorrow);
  await page.locator("#focusMinutes").fill("25");
  await page.locator('button[onclick="focusAddTimebox()"]',).click();
  expect(await page.evaluate(()=>taskAll().find(x=>x.title==="E2E Focus Task")?.plannedDate)).toBe(tomorrow);

  const focusCheck=await page.evaluate(async()=>{
    const task=taskAll().find(x=>x.title==="E2E Focus Task"),taskId=task.id,tb=focusTimeboxes().find(x=>x.taskId===taskId);
    tb.dateKey=localDateKey();task.plannedDate=localDateKey();task.timerStartedAt=new Date().toISOString();
    await focusStart(tb.id);const blockedFocus=!personalData().activeFocus?.startedAt;
    task.timerStartedAt="";await focusStart(tb.id);const blockedTask=calibrationStartTaskTimer(taskId)===false;
    personalData().activeFocus.startedAt=new Date(Date.now()-125000).toISOString();await focusStop();
    return {blockedFocus,blockedTask,actual:task.actualMinutes,identity:taskAll().find(x=>x.id===taskId)===task}
  });
  expect(focusCheck.blockedFocus).toBe(true);expect(focusCheck.blockedTask).toBe(true);expect(focusCheck.actual).toBeGreaterThanOrEqual(2);expect(focusCheck.identity).toBe(true);
  expect(errors).toEqual([])
});

test("People without interactions have no fabricated freshness",async({page})=>{
  const errors=await boot(page);await openMore(page,"overview");
  await page.locator('[data-testid="people-add"]').click();
  await page.locator("#peopleName").fill("E2E No Contact");await page.locator("#peopleCadence").fill("7");await page.locator('button[onclick="peopleSave()"]',).click();
  const row=page.locator("#peopleOsList .log-item").filter({hasText:"E2E No Contact"});
  await expect(row).toContainText("Последний контакт: ещё не зафиксирован");await expect(row).toContainText("связь —");
  expect(errors).toEqual([])
});

test("Body means are day-weighted and Home purchase keeps factual inventory",async({page})=>{
  const errors=await boot(page);
  const result=await page.evaluate(async()=>{
    const t=localDateKey(),y=localDateKey(addDays(new Date(),-1));
    growthLogEvent("tracker-mood",{dateKey:t,value:2});growthLogEvent("tracker-mood",{dateKey:t,value:8});growthLogEvent("tracker-mood",{dateKey:y,value:10});
    personalData().inventory.push({id:"e2e-stock",name:"E2E Stock",qty:1,minQty:5,unit:"шт",archived:false});personalData().shopping.push({id:"e2e-buy",name:"E2E Stock",inventoryId:"e2e-stock",done:false});
    await homeBought("e2e-buy");
    return {avg:bodyAvg("tracker-mood",7),stock:homeInventory().find(x=>x.id==="e2e-stock").qty}
  });
  expect(result.avg).toBe(7.5);expect(result.stock).toBe(1);expect(errors).toEqual([])
});

test("Import Hub is preview-first and rejects empty Personal numeric values",async({page})=>{
  const errors=await boot(page);await openMore(page,"settings");
  await expect(page.locator("#import127Command")).toBeVisible();
  await expect(page.locator("#import127File")).toBeAttached();
  await expect(page.locator("#personalImportCommand").locator("xpath=ancestor::div[contains(@class,'card')]")).not.toBeVisible();

  await page.locator("#import127File").setInputFiles({
    name:"personal.csv",
    mimeType:"text/csv",
    buffer:Buffer.from("date;tracker;value;durationMin;note\n23.09.2026;E2E Metric;7;;ok\n23.09.2026;E2E Empty;;;bad\n")
  });

  await expect(page.locator("#import127Preview")).toContainText("Готово");
  await expect(page.locator("#import127Preview")).toContainText("Ошибки");
  await expect(page.locator("#import127Command")).toContainText("Personal CSV");
  expect(await page.evaluate(()=>growthTrackers().some(x=>x.name==="E2E Metric"))).toBe(false);

  await page.locator("#import127Apply").click();

  await expect.poll(()=>page.evaluate(()=>growthTrackers().some(x=>x.name==="E2E Metric"))).toBe(true);
  expect(await page.evaluate(()=>growthTrackers().some(x=>x.name==="E2E Empty"))).toBe(false);
  await expect(page.locator("#import127History")).toContainText("Personal CSV");
  expect(errors).toEqual([])
});

test("Dashboard search finds Personal OS entities",async({page})=>{
  const errors=await boot(page);await page.evaluate(()=>{peopleCreate({name:"E2E Search Person",cadenceDays:30});render()});await openMore(page,"settings");
  await page.locator("#dashboardSearchInput").fill("E2E Search Person");
  await expect(page.locator("#dashboardSearchResults")).toContainText("E2E Search Person");
  await expect(page.locator("#dashboardSearchResults").getByRole("button",{name:"Открыть"}).first()).toBeVisible();
  expect(errors).toEqual([])
});

test("Personal OS views do not create horizontal overflow on Pixel 7",async({page})=>{
  const errors=await boot(page);
  for(const [section,view] of [["today","focus"],["more","overview"],["more","settings"]]){
    await page.evaluate(([s,v])=>{switchTab(s);ux7SetView(s,v,false)},[section,view]);
    const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth);expect(overflow).toBeLessThanOrEqual(1)
  }
  expect(errors).toEqual([])
});
