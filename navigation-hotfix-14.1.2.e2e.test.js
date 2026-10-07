import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  return errors
}

test("unified navigation reveals hidden Today tools and opens an exact task",async({page})=>{
  const errors=await boot(page);
  const id=await page.evaluate(()=>{const t=taskCreate({title:"NAV exact task",area:"Работа",priority:2,minutes:15});render();return t.id});
  await page.evaluate(id=>lifeNavigateEntity("task",id),id);
  await expect(page.locator("#today")).toHaveClass(/active/);
  await expect(page.locator('#today .ux7-tab[data-view="focus"]')).toHaveClass(/active/);
  await expect(page.locator("#today")).toHaveClass(/product-core141-expanded/);
  await expect(page.locator("#taskEditorCard")).toBeVisible();
  await expect(page.locator("#taskEditId")).toHaveValue(id);
  await expect(page.locator("#taskTitle")).toHaveValue("NAV exact task");
  expect(errors).toEqual([])
});

test("global Search opens the exact task instead of only its section",async({page})=>{
  const errors=await boot(page);
  const id=await page.evaluate(()=>{const t=taskCreate({title:"NAV Search Unique",area:"Система",priority:2,minutes:20});render();return t.id});
  await page.locator("#ux128SearchBtn").click();
  await page.locator("#ux128SearchInput").fill("NAV Search Unique");
  const row=page.locator("#ux128SearchResults .ux128-search-row").filter({hasText:"NAV Search Unique"}).first();
  await expect(row).toBeVisible();await row.click();
  await expect(page.locator("#taskEditorCard")).toBeVisible();
  await expect(page.locator("#taskEditId")).toHaveValue(id);
  expect(errors).toEqual([])
});

test("Command Palette calibration route follows the card after consolidation",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>commandRoute("calibration"));
  await expect(page.locator("#more")).toHaveClass(/active/);
  await expect(page.locator('#more .ux7-tab[data-view="settings"]')).toHaveClass(/active/);
  await expect(page.locator("#calibrationOsCommand").locator("xpath=ancestor::div[contains(@class,'card')]")).toBeVisible();
  expect(errors).toEqual([])
});

test("target ownership corrects a stale section/view route",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>lifeNavigate({section:"more",view:"overview",target:"#aiImportPreview",behavior:"auto"}));
  await expect(page.locator("#finance")).toHaveClass(/active/);
  await expect(page.locator('#finance .ux7-tab[data-view="operations"]')).toHaveClass(/active/);
  await expect(page.locator("#aiImportPreview").locator("xpath=ancestor::div[contains(@class,\'card\')]")).toBeVisible();
  expect(errors).toEqual([])
});

test("Work and Tennis edit actions reveal collapsed editors before focusing fields",async({page})=>{
  const errors=await boot(page);
  const data=await page.evaluate(()=>{
    const w={id:"nav-work",date:localDateKey(),sales:0,contacts:1,followups:0,lpr:0,meetings:0,proposals:0,wins:0,pipeline:0,note:"nav"};S.workLogs.unshift(w);
    const t={id:"nav-tennis",dateKey:localDateKey(),date:new Date().toLocaleDateString("ru-RU"),min:60,load:5,type:"Тренировка",focus:"Смешанная",serveMin:0,footMin:0,w:0,l:0,note:"nav"};S.tennis.unshift(t);render();return {w:w.id,t:t.id}
  });
  await page.evaluate(id=>editWork(id),data.w);
  const workCard=page.locator("#workDate").locator("xpath=ancestor::div[contains(@class,'card')]");
  await expect(workCard).toBeVisible();await expect(workCard).not.toHaveClass(/ux7-editor-collapsed/);
  await page.evaluate(id=>editTennis(id),data.t);
  const tennisCard=page.locator("#ttDate").locator("xpath=ancestor::div[contains(@class,'card')]");
  await expect(tennisCard).toBeVisible();await expect(tennisCard).not.toHaveClass(/ux7-editor-collapsed/);
  expect(errors).toEqual([])
});

test("Recent classifies projects and goals into More instead of Today",async({page})=>{
  const errors=await boot(page);
  const rows=await page.evaluate(()=>({project:ux128AuditRoute("project"),goal:ux128AuditRoute("goal"),task:ux128AuditRoute("task")}));
  expect(rows.project).toEqual(["more","overview"]);expect(rows.goal).toEqual(["more","overview"]);expect(rows.task).toEqual(["today","focus"]);
  expect(errors).toEqual([])
});
