import { test, expect } from "@playwright/test";

test("Life RPG 11 mobile critical flow", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(String(error)));

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#today")).toHaveClass(/active/);
  await expect(page.locator("#versionStatus")).toContainText("11.1.0");
  expect(await page.evaluate(()=>STATE_VERSION)).toBe(18);

  // Life OS is visible only in Today -> Focus and participates in UX7 switching.
  await expect(page.locator("#lifeOsCommand")).toBeVisible();
  await page.locator('#today .ux7-tab[data-view="progress"]').click();
  await expect(page.locator("#lifeOsCommand")).not.toBeVisible();
  await page.locator('#today .ux7-tab[data-view="focus"]').click();
  await expect(page.locator("#lifeOsCommand")).toBeVisible();
  await expect(page.locator("#tasksOsCommand")).toBeVisible();
  await expect(page.locator("#routinesOsCommand")).toBeVisible();
  await expect(page.locator("#inboxOsCommand")).toBeVisible();
  await expect(page.locator("#commandPaletteBtn")).toBeVisible();
  await expect(page.locator("#todayFlowCommand")).toBeVisible();
  await expect(page.locator("#decisionOsCommand")).toBeVisible();
  await expect(page.locator("#executionOsCommand")).toBeVisible();
  await expect(page.locator("#lifeOsCommand")).toContainText("Не предлагать");

  // Tasks OS -> create a real next action.
  await page.locator('button[onclick*="taskEditorCard"]').click();
  await expect(page.locator("#taskEditorCard")).toBeVisible();
  await page.locator("#taskTitle").fill("E2E задача");
  await page.locator("#taskDueDate").fill(today);
  await page.locator("#taskPriority").selectOption("1");
  await page.locator('button[onclick="saveTaskForm()"]',).click();
  await expect(page.locator("#tasksOsList")).toContainText("E2E задача");
  expect(await page.evaluate(()=>Array.isArray(S.entities.tasks)&&S.entities.tasks.some(x=>x.title==="E2E задача"))).toBe(true);
  await page.locator('button[onclick="applyExecutionPlan()"]',).click();
  expect(await page.evaluate(()=>S.entities.tasks.find(x=>x.title==="E2E задача")?.plannedDate||"")).not.toBe("");

  // Routines OS -> create today's routine and complete it once.
  await page.locator('button[onclick*="routineDayPicker"]').click();
  await expect(page.locator("#routineEditorCard")).toBeVisible();
  await page.locator("#routineTitle").fill("E2E рутина");
  await page.locator("#routineMinutes").fill("20");
  await page.locator('button[onclick="saveRoutineForm()"]',).click();
  const routineRow=page.locator("#routinesOsList .quest").filter({hasText:"E2E рутина"});
  await expect(routineRow).toBeVisible();
  await routineRow.locator('button[onclick^="completeRoutine"]').click();
  await expect(routineRow).toContainText("E2E рутина");

  // Inbox OS -> capture first, decide route later.
  await page.locator("#inboxCaptureInput").fill("E2E inbox позвонить клиенту завтра");
  await page.locator('button[onclick="captureInbox()"]',).click();
  const inboxRow=page.locator("#inboxOsCommand .log-item").filter({hasText:"E2E inbox"});
  await expect(inboxRow).toBeVisible();
  await inboxRow.getByRole("button",{name:"→ Задача"}).click();
  await expect(page.locator("#tasksOsList")).toContainText("E2E inbox");

  // Work -> CRM -> reveal compact editor -> save deal.
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

  // Tennis -> Training -> reveal compact editor -> add rated match.
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
  await page.locator("#ttMatches").fill("Соперник A | 1200 | W | 3:1 | test");
  await page.locator("#ttSaveBtn").click();

  await expect(page.locator("#tennisLog")).toContainText("матчи 1:0");
  await expect(page.locator("#tennisLog")).toContainText("Соперник A");

  // More -> Knowledge -> add a book through the real modal.
  await page.locator('[data-tab="more"]').click();
  await expect(page.locator("#more")).toHaveClass(/active/);

  // Modular 11.1.0 systems are present in More / Overview.
  await expect(page.locator("#rulesOsCommand")).toBeVisible();
  await expect(page.locator("#insightsOsCommand")).toBeVisible();
  await expect(page.locator("#calibrationOsCommand")).toBeVisible();
  const settingsTab=page.locator('#more .ux7-tab[data-view="settings"]');
  await settingsTab.click();
  await expect(page.locator("#dataOsCommand")).toBeVisible();
  await expect(page.locator("#recoveryOsCommand")).toBeVisible();
  await page.locator('#more .ux7-tab[data-view="overview"]').click();

  // Projects OS -> create a real project in More / Overview.
  await expect(page.locator("#projectsOsCommand")).toBeVisible();
  await page.locator('button[onclick="projectToggleEditor(true)"]').click();
  await expect(page.locator("#projectEditorCard")).toBeVisible();
  await page.locator("#projectTitle").fill("E2E проект");
  await page.locator("#projectOutcome").fill("Проверяемый результат");
  await page.locator("#projectNextStep").fill("Сделать следующий шаг");
  await page.locator('button[onclick="saveProject()"]').click();
  await expect(page.locator("#projectsOsList")).toContainText("E2E проект");

  // Goals OS -> create a goal linked to the real project.
  await expect(page.locator("#goalsOsCommand")).toBeVisible();
  await page.locator('button[onclick*="goalProjectLinks"]').click();
  await expect(page.locator("#goalEditorCard")).toBeVisible();
  await page.locator("#goalTitle").fill("E2E цель");
  await page.locator("#goalOutcome").fill("Достигнут проверяемый результат");
  const projectLink=page.locator('#goalProjectLinks label').filter({hasText:"E2E проект"}).locator('input');
  await projectLink.check();
  await page.locator('button[onclick="saveGoalForm()"]').click();
  await expect(page.locator("#goalsOsList")).toContainText("E2E цель");

  // Command Palette -> global search finds the linked project.
  await page.locator("#commandPaletteBtn").click();
  await expect(page.locator("#commandPalette")).toHaveClass(/open/);
  await page.locator("#commandInput").fill("E2E проект");
  await expect(page.locator("#commandResults")).toContainText("E2E проект");
  await page.locator('#commandPalette .close').click();

  // Review / Planning OS -> save the weekly snapshot and verify history.
  await expect(page.locator("#reviewOsCommand")).toBeVisible();
  await page.locator("#reviewWeekWins").fill("E2E результат недели");
  await page.locator('button[onclick="saveReview(\'week\')"]').click();
  await expect(page.locator("#reviewHistory")).toContainText("Неделя");
  await expect(page.locator("#reviewHistory")).toContainText("E2E результат недели");

  // Calendar / Timeline OS -> create a future planned training.
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
  await expect(page.locator("#knowledgeOsCommand")).toBeVisible();
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
