import { test, expect } from "@playwright/test";

async function boot(page){const errors=[];page.on("pageerror",e=>errors.push(String(e)));await page.goto("/",{waitUntil:"domcontentloaded"});await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);await expect(page.locator("#versionStatus")).toContainText("13.2.2");await page.evaluate(()=>{switchTab("today");ux7SetView("today","focus",false)});return errors}

test("Decision Intelligence 13.2 explains and records an outcome",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{const y=localDateKey(addDays(new Date(),-1));taskCreate({title:"E2E hard intelligence task",area:"Работа",priority:1,dueDate:y,minutes:20});render()});
  const card=page.locator("#intelligence132Command .log-item").filter({hasText:"E2E hard intelligence task"});
  await expect(card).toBeVisible();await expect(card).toContainText("HARD");await expect(card).toContainText("confidence");await expect(card).toContainText("Что изменит решение");
  await card.getByRole("button",{name:"Сделано"}).click();
  await expect.poll(()=>page.evaluate(()=>intelligence132Store().journal.some(x=>x.title==="E2E hard intelligence task"&&x.outcome==="done"))).toBe(true);
  expect(errors).toEqual([])
});

test("Decision Intelligence 13.2 scenario engine stays local and cross-domain",async({page})=>{
  const errors=await boot(page);await expect(page.locator("#intelligence132Command")).toBeVisible();
  const root=page.locator("#intelligence132Command").locator("xpath=ancestor::div[contains(@class,'card')]");await root.locator("summary",{hasText:"Что если?"}).click();
  await page.locator("#intel132Spend").fill("1000");await page.locator("#intel132TrainingMin").fill("45");await page.locator("#intel132TrainingRpe").fill("6");await page.locator("#intel132WorkMin").fill("60");await root.getByRole("button",{name:"Пересчитать"}).click();
  await expect(page.locator("#intelligence132Scenario")).toContainText("Финансы 30д");await expect(page.locator("#intelligence132Scenario")).toContainText("Ёмкость сегодня");
  expect(await page.evaluate(()=>S.settings.intelligence132.scenario.spend)).toBe(1000);expect(errors).toEqual([])
});
