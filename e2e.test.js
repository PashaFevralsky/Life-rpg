import { test, expect } from "@playwright/test";

test("Life RPG 12 mobile critical flow", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(String(error)));

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#today")).toHaveClass(/active/);
  await expect(page.locator("#versionStatus")).toContainText("13.2.2");
  expect(await page.evaluate(()=>STATE_VERSION)).toBe(18);

  await expect(page.locator("#lifeOsCommand")).toBeVisible();
  await page.locator('#today .ux7-tab[data-view="progress"]').click();
  await expect(page.locator("#lifeOsCommand")).not.toBeVisible();
  await page.locator('#today .ux7-tab[data-view="focus"]').click();
  await expect(page.locator("#lifeOsCommand")).toBeVisible();
  await expect(page.locator("#tasksOsCommand")).toBeVisible();
  await expect(page.locator("#routinesOsCommand")).toBeVisible();
  await expect(page.locator("#inboxOsCommand")).toBeVisible();
  await expect(page.locator("#commandPaletteBtn")).toBeVisible();
  await expect(page.locator("#today123Command")).toBeVisible();
  await expect(page.locator("#todayFlowCommand")).not.toBeVisible();
  await expect(page.locator("#decisionOsCommand")).toBeVisible();
  await expect(page.locator("#executionOsCommand")).toBeVisible();
  await expect(page.locator("#lifeOsCommand")).toContainText("Не предлагать");

  await page.locator('button[onclick*="taskEditorCard"]').click();
  await expect(page.locator("#taskEditorCard")).toBeVisible();
  await page.locator("#taskTitle").fill("E2E задача");
  await page.locator("#taskDueDate").fill(today);
  await page.locator("#taskPriority").selectOption("1");
  await page.locator('button[onclick="saveTaskForm()"]',).click();
  await expect(page.locator("#tasksOsList")).toContainText("E2E задача");
  expect(await page.evaluate(()=>Array.isArray(S.entities.tasks)&&S.entities.tasks.some(x=>x.title==="E2E задача"))).toBe(true);
  const e2ePlanDecision=await page.evaluate(()=>{
    const task=S.entities.tasks.find(x=>x.title==="E2E задача"),plan=executionPlan();
    if(!task)return {taskId:"",assignment:"",unscheduled:"missing-task",blocked:""};
    const assignment=plan.assignments.find(x=>x.taskId===task.id)?.dateKey||"";
    const unscheduled=plan.unscheduled.find(x=>x.taskId===task.id)?.reason||"";
    const blocked=plan.blocked.find(x=>x.taskId===task.id)?.reason||"";
    return {taskId:task.id,assignment,unscheduled,blocked};
  });
  expect(e2ePlanDecision.taskId).not.toBe("");
  expect(Boolean(e2ePlanDecision.assignment||e2ePlanDecision.unscheduled||e2ePlanDecision.blocked)).toBe(true);
  await page.locator('button[onclick="applyExecutionPlan()"]',).click();
  if(e2ePlanDecision.assignment){
    await expect.poll(()=>page.evaluate(()=>S.entities.tasks.find(x=>x.title==="E2E задача")?.plannedDate||"")).toBe(e2ePlanDecision.assignment);
  }else{
    expect(await page.evaluate(()=>S.entities.tasks.find(x=>x.title==="E2E задача")?.plannedDate||"")).toBe("");
  }

  await page.locator('button[onclick*="routineDayPicker"]').click();
  await expect(page.locator("#routineEditorCard")).toBeVisible();
  await page.locator("#routineTitle").fill("E2E рутина");
  await page.locator("#routineMinutes").fill("20");
  await page.locator('button[onclick="saveRoutineForm()"]',).click();
  const routineRow=page.locator("#routinesOsList .quest").filter({hasText:"E2E рутина"});
  await expect(routineRow).toBeVisible();
  await routineRow.locator('button[onclick^="completeRoutine"]').click();
  await expect(routineRow).toContainText("E2E рутина");

  await page.locator("#inboxCaptureInput").fill("E2E inbox позвонить клиенту завтра");
  await page.locator('button[onclick="captureInbox()"]',).click();
  const inboxRow=page.locator("#inboxOsCommand .log-item").filter({hasText:"E2E inbox"});
  await expect(inboxRow).toBeVisible();
  await inboxRow.getByRole("button",{name:"→ Задача"}).click();
  await expect(page.locator("#tasksOsList")).toContainText("E2E inbox");

  await page.locator('[data-tab="work"]').click();
  await expect(page.locator("#work")).toHaveClass(/active/);

  const crmTab = page.locator('#work .ux7-tab[data-view="crm"]');
  await expect(crmTab).toBeVisible();
  await crmTab.click();
  await expect(page.locator("#workOsQuality")).toBeVisible();
  await expect(page.locator("#workOsCommand")).not.toBeVisible();

  const crmCard = page.locator("#crmEditorCard");
  await expect(crmCard).toBeVisible();
  if (await crmCard.evaluate(el => el.classList.contains("ux7-editor-collapsed"))) {
    await crmCard.locator(".ux7-editor-toggle").click();
  }
  await expect(page.locator("#crmName")).toBeVisible();

  await page.locator("#crmName").fill("E2E объект");
  await page.locator("#crmCity").fill("Екатеринбург");
  await page.locator("#crmPotential").fill("600000");
  await page.locator("#crmNextStep").fill("Позвонить ЛПР");
  await page.locator("#crmNextDate").fill(today);
  await page.locator('button[onclick="saveCrmDeal()"]',).click();

  await expect(page.locator("#crmDealList")).toContainText("E2E объект");
  await expect(page.locator("#crmDealList")).toContainText("Позвонить ЛПР");

  await page.locator('[data-tab="tennis"]').click();
  await expect(page.locator("#tennis")).toHaveClass(/active/);

  const trainingTab = page.locator('#tennis .ux7-tab[data-view="training"]');
  await expect(trainingTab).toBeVisible();
  await trainingTab.click();
  await expect(page.locator("#tennisOsCommand")).not.toBeVisible();

  const tennisCard = page.locator('#tennis .card:has(#ttSaveBtn)');
  await expect(tennisCard).toBeVisible();
  if (await tennisCard.evaluate(el => el.classList.contains("ux7-editor-collapsed"))) {
    await tennisCard.locator(".ux7-editor-toggle").click();
  }
  await expect(page.locator("#ttSaveBtn")).toBeVisible();

  const matchDetails = page.locator("#ttMatches").locator("xpath=ancestor::details");
  await expect(matchDetails.locator("summary")).toBeVisible();
  if (!(await matchDetails.evaluate(el => el.open))) {
    await matchDetails.locator("summary").click();
  }
  await expect(page.locator("#ttMatches")).toBeVisible();
  await page.locator("#ttMatches").fill("Ударник A | 1200 | W | 3:1 | test");
  await page.locator("#ttSaveBtn").click();

  await expect(page.locator("#tennisLog")).toContainText("матчи 1:0");
  await expect(page.locator("#tennisLog")).toContainText("Ударник A");
  await page.locator('[data-tab="more"]').click();
  await expect(page.locator("#more")).toHaveClass(/active/);

  await expect(page.locator("#rulesOsCommand")).toBeVisible();
  await expect(page.locator("#insightsOsCommand")).toBeVisible();
  await expect(page.locator("#calibrationOsCommand")).not.toBeVisible();
  const settingsTab=page.locator('#more .ux7-tab[data-view="settings"]');
  await settingsTab.click();
  await expect(page.locator("#dataOsCommand")).toBeVisible();
  await expect(page.locator("#recovery133Center")).toBeVisible();
  await expect(page.locator("#recoveryOsCommand")).not.toBeVisible();
  await expect(page.locator("#calibrationOsCommand")).toBeVisible();
  await page.locator('#more .ux7-tab[data-view="overview"]').click();

  await expect(page.locator("#projectsOsCommand")).toBeVisible();
  await page.locator('button[onclick="projectToggleEditor(true)"]').click();
  await expect(page.locator("#projectEditorCard")).toBeVisible();
  await page.locator("#projectTitle").fill("E2E проект");
  await page.locator("#projectOutcome").fill("Проверяемый результат");
  await page.locator("#projectNextStep").fill("Сделать следующий шаг");
  await page.locator('button[onclick="saveProject()"]').click();
  await expect(page.locator("#projectsOsList")).toContainText("E2E проект");

  await expect(page.locator("#goalsOsCommand")).toBeVisible();
  await page.locator('button[onclick*="goalProjectLinks"]').click();
  await expect(page.locator("#goalEditorCard")).toBeVisible();
  await page.locator("#goalTitle").fill("E2E цель");
  await page.locator("#goalOutcome").fill("Достигнут проверяемый результат");
  const projectLink=page.locator('#goalProjectLinks label').filter({hasText:"E2E проект"}).locator('input');
  await projectLink.check();
  await page.locator('button[onclick="saveGoalForm()"]').click();
  await expect(page.locator("#goalsOsList")).toContainText("E2E цель");

  await page.locator("#commandPaletteBtn").click();
  await expect(page.locator("#commandPalette")).toHaveClass(/open/);
  await page.locator("#commandInput").fill("E2E проект");
  await expect(page.locator("#commandResults")).toContainText("E2E проект");
  await page.locator('#commandPalette .close').click();

  await expect(page.locator("#reviewOsCommand")).toBeVisible();
  await page.locator("#reviewWeekWins").fill("E2E результат недели");
  await page.locator('button[onclick="saveReview(\'week\')"]').click();
  await expect(page.locator("#reviewHistory")).toContainText("Неделя");
  await expect(page.locator("#reviewHistory")).toContainText("E2E результат недели");

  await expect(page.locator("#calendarOsCommand")).toBeVisible();
  await page.locator('button:has-text("+ Событие")').click();
  await page.locator("#calendarTitle").fill("E2E тренировка");
  const tomorrow = await page.evaluate(() => {
    const d=new Date(); d.setDate(d.getDate()+1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });
  await page.locator("#calendarDate").fill(tomorrow);
  await page.locator("#calendarType").selectOption({label:"Тренировка"});
  await page.locator("#calendarMinutes").fill("90");
  await page.locator('button[onclick="saveCalendarEvent()"]').click();
  await expect(page.locator("#calendarTimeline")).toContainText("E2E тренировка");

  const knowledgeTab = page.locator('#more .ux7-tab[data-view="knowledge"]');
  await expect(knowledgeTab).toBeVisible();
  await knowledgeTab.click();
  await expect(page.locator("#knowledge124Today")).toBeVisible();
  await expect(page.locator("#knowledgeOsCommand")).not.toBeVisible();
  await expect(page.locator("#projectsOsCommand")).not.toBeVisible();
  await expect(page.locator("#goalsOsCommand")).not.toBeVisible();
  await expect(page.locator("#reviewOsCommand")).not.toBeVisible();
  await expect(page.locator("#calendarOsCommand")).not.toBeVisible();
  await expect(page.locator("#rulesOsCommand")).not.toBeVisible();
  await expect(page.locator("#insightsOsCommand")).not.toBeVisible();
  await expect(page.locator("#calibrationOsCommand")).not.toBeVisible();

  const addBookButton = page.locator('button[onclick="openModal(\'bookModal\')"]');
  await expect(addBookButton).toBeVisible();
  await addBookButton.click();

  await expect(page.locator("#bookModal")).toHaveClass(/open/);
  await page.locator("#bookTitle").fill("E2E книга");
  await page.locator("#bookPages").fill("100");
  await page.locator('button[onclick="addBook()"]',).click();

  await expect(page.locator("#bookList")).toContainText("E2E книга");
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  expect(pageErrors).toEqual([]);
});

test("v17 local state migrates durably to entity architecture v18", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await page.evaluate(async()=>{
    const raw={
      version:17,
      created:new Date().toISOString(),
      updated:new Date(Date.now()+2000).toISOString(),
      profile:{name:"migration-e2e"},
      settings:{
        projects:[{id:"m-project",title:"Migrated project",status:"active",area:"Работа",priority:2,progress:10,nextStep:"Step"}],
        tasks:[{id:"m-task",title:"Migrated task",status:"active",area:"Работа",priority:2,projectId:"m-project",minutes:20}]
      }
    };
    localStorage.setItem("lifeRpg4",JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  const migrated=await page.evaluate(()=>({
    version:S.version,
    project:S.entities.projects.some(x=>x.id==="m-project"),
    task:S.entities.tasks.some(x=>x.id==="m-task"&&x.projectId==="m-project"),
    legacyProjects:Object.prototype.hasOwnProperty.call(S.settings,"projects")
  }));
  expect(migrated).toEqual({version:18,project:true,task:true,legacyProjects:false});
  await page.evaluate(()=>persist());
  expect(await page.evaluate(async()=>(await dbGet("state","current")).version)).toBe(18);
});

test("newer fallback survives reload and becomes durable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await page.evaluate(async()=>{
    S.profile.name="older database";await persist();
    const fallback=structuredClone(S);fallback.profile.name="fresh fallback";fallback.updated=new Date(Date.now()+1000).toISOString();
    localStorage.setItem("lifeRpg4",JSON.stringify(fallback));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  expect(await page.evaluate(()=>S.profile.name)).toBe("fresh fallback");
  await page.evaluate(()=>persist());
  expect(await page.evaluate(async()=>(await dbGet("state","current")).profile.name)).toBe("fresh fallback");
});

test("PWA starts offline with versioned scripts and retained data", async ({ page, context }) => {
  const errors=[];page.on("pageerror",error=>errors.push(String(error)));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await page.evaluate(async()=>{S.profile.name="offline retained";await persist();await navigator.serviceWorker.ready});
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  expect(await page.evaluate(()=>S.profile.name)).toBe("offline retained");
  expect(errors).toEqual([]);
});

test("completed book editing and CRM double-tap preserve data", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  const result=await page.evaluate(async()=>{
    S.crmDeals=[{id:"race",name:"Race",realizedAmount:500,realizationDate:localDateKey()}];
    await Promise.all([recordCrmRealization("race"),recordCrmRealization("race")]);
    S.books=[{id:"finished",title:"Completed",status:"done",totalPages:100,currentPage:100}];
    S.readingLogs=[{id:"read",bookId:"finished",dateKey:localDateKey(),minutes:30,pages:100,xpAward:320}];
    render();editReading("read");
    return {sales:S.workLogs.filter(x=>x.sourceDealId==="race").length,selected:document.getElementById("readBook").value};
  });
  expect(result).toEqual({sales:1,selected:"finished"});
});

const layoutWidths=[360,390,430,768];

async function seedLayoutStress(page){
  await page.evaluate(()=>{
    const today=localDateKey(),dow=((new Date().getDay()+6)%7)+1,stamp=new Date().toISOString();
    S.entities.tasks.unshift(taskNormalize({id:"layout-task",title:"Подготовить очень длинное коммерческое предложение и проверить все приложения перед отправкой заказчику",area:"Работа",priority:1,status:"active",dueDate:today,plannedDate:today,minutes:45,blockedByIds:[],createdAt:stamp,updatedAt:stamp}));
    S.entities.routines.unshift({id:"layout-routine",title:"Тренировка техники с длинным названием для проверки мобильной строки действий",area:"Теннис",priority:1,status:"active",minutes:35,days:[dow],createdAt:stamp,updatedAt:stamp});
    S.entities.inbox.unshift({id:"layout-inbox",text:"Позвонить клиенту по большой заявке и уточнить длинный перечень технических вопросов",area:"Работа",status:"open",dateKey:today,createdAt:stamp,updatedAt:stamp});
    S.crmDeals.unshift({id:"layout-deal",name:"Очень длинное название CRM сделки для проверки выпадающего списка",stage:"Переговоры",probability:50,amount:100000,nextAction:"Позвонить",nextDate:today});
    S.books.unshift({id:"layout-book",title:"Очень длинное название книги для проверки переноса текста и мобильной сетки действий",author:"Автор с длинным именем",totalPages:500,currentPage:0,status:"queued",readingOrder:1,created:today,started:"",notes:""});
    render();
  });
}

async function geometryAudit(page){
  return page.evaluate(()=>{
    const visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0};
    const viewport=document.documentElement.clientWidth;
    const bodyOverflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-viewport;
    const actionRows=[...document.querySelectorAll('.quest:has(> .split)')].filter(visible).map(q=>{const body=q.querySelector(':scope > .qbody'),actions=q.querySelector(':scope > .split');if(!body||!actions||!visible(body)||!visible(actions))return null;const br=body.getBoundingClientRect(),ar=actions.getBoundingClientRect(),qr=q.getBoundingClientRect();return {bodyWidth:br.width,rowWidth:qr.width,stacked:ar.top>=br.bottom-1,inside:ar.left>=qr.left-1&&ar.right<=qr.right+1}}).filter(Boolean);
    const statBad=[...document.querySelectorAll('.stat-row')].filter(visible).filter(row=>{const v=row.querySelector('.stat-xp'),card=row.closest('.card');if(!v||!card)return false;const r=v.getBoundingClientRect(),c=card.getBoundingClientRect();return r.right>c.right+1||r.left<c.left-1||v.scrollWidth>v.clientWidth+1}).length;
    const buttonBad=[...document.querySelectorAll('.card .btn')].filter(visible).filter(btn=>{const card=btn.closest('.card'),r=btn.getBoundingClientRect(),c=card?.getBoundingClientRect();return c&&(r.right>c.right+1||r.left<c.left-1)}).length;
    const shell=document.querySelector('.shell'),bottom=document.querySelector('.bottom');const pad=parseFloat(getComputedStyle(shell).paddingBottom)||0,bh=bottom?.getBoundingClientRect().height||0;
    const wrapBad=[...document.querySelectorAll('.qtitle,.qmeta,.book-head>div')].filter(visible).filter(el=>el.scrollWidth>el.clientWidth+2).length;
    return {viewport,bodyOverflow,actionRows,statBad,buttonBad,pad,bh,wrapBad};
  });
}

for(const width of layoutWidths){
  test(`layout gate ${width}px: no squeeze, clipping or horizontal overflow`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto("/",{waitUntil:"domcontentloaded"});
    await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
    await seedLayoutStress(page);

    await page.evaluate(()=>{switchTab("today");ux7SetView("today","focus",false)});
    let a=await geometryAudit(page);
    expect(a.bodyOverflow).toBeLessThanOrEqual(1);expect(a.statBad).toBe(0);expect(a.buttonBad).toBe(0);expect(a.wrapBad).toBe(0);expect(a.pad).toBeGreaterThanOrEqual(a.bh+36);
    if(width<=600){expect(a.actionRows.length).toBeGreaterThan(0);for(const row of a.actionRows){expect(row.bodyWidth).toBeGreaterThan(120);expect(row.stacked).toBe(true);expect(row.inside).toBe(true)}}

    await page.evaluate(()=>{switchTab("tennis");ux7SetView("tennis","overview",false)});
    a=await geometryAudit(page);expect(a.bodyOverflow).toBeLessThanOrEqual(1);expect(a.statBad).toBe(0);expect(a.buttonBad).toBe(0);

    await page.evaluate(()=>{switchTab("more");ux7SetView("more","knowledge",false)});
    await expect(page.locator("#bookList")).toContainText("Очень длинное название книги");
    a=await geometryAudit(page);expect(a.bodyOverflow).toBeLessThanOrEqual(1);expect(a.buttonBad).toBe(0);expect(a.wrapBad).toBe(0);
    if(width<=600){const book=await page.evaluate(()=>{const b=[...document.querySelectorAll('#bookList .book')].find(x=>x.textContent.includes('Очень длинное название книги')),g=b?.querySelector(':scope > .split');if(!b||!g)return null;const br=b.getBoundingClientRect();return {display:getComputedStyle(g).display,buttons:[...g.querySelectorAll('.btn')].map(x=>{const r=x.getBoundingClientRect();return {w:r.width,inside:r.left>=br.left-1&&r.right<=br.right+1}})}});expect(book).not.toBeNull();expect(book.display).toBe("grid");for(const b of book.buttons){expect(b.w).toBeGreaterThan(44);expect(b.inside).toBe(true)}}

    for(const [section,view] of [["finance","overview"],["finance","bank"],["work","overview"],["work","crm"],["more","overview"],["more","settings"]]){
      await page.evaluate(([s,v])=>{switchTab(s);ux7SetView(s,v,false)},[section,view]);
      a=await geometryAudit(page);expect(a.bodyOverflow,`${section}/${view} overflows at ${width}px`).toBeLessThanOrEqual(1);expect(a.buttonBad,`${section}/${view} buttons leave cards at ${width}px`).toBe(0);
    }
  });
}
