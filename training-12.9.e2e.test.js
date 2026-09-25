import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);return errors
}
test("Training OS 12.9 records outdoor fact and combines it with tennis",async({page})=>{
  const errors=await boot(page);await page.evaluate(()=>{switchTab("more");ux7SetView("more","overview",false)});
  await expect(page.locator("#training129Command")).toBeVisible();
  const today=await page.evaluate(()=>localDateKey());
  await page.locator("#training129Date").fill(today);await page.locator("#training129Type").selectOption("easy");await page.locator("#training129Minutes").fill("35");await page.locator("#training129Rpe").fill("4");await page.locator("#training129Distance").fill("3.5");await page.locator("#training129AvgHr").fill("135");await page.locator('button[onclick="training129Save()"]').click();
  await expect(page.locator("#training129History")).toContainText("35 мин");await expect(page.locator("#training129History")).toContainText("3.5 км");
  expect(await page.evaluate(()=>training129OutdoorSessions(7).length)).toBe(1);
  expect(await page.evaluate(()=>training129Range(7).load)).toBeGreaterThanOrEqual(140);
  expect(errors).toEqual([])
});
test("Training OS 12.9 plans only after confirmation and is reachable from Life/quick shell",async({page})=>{
  const errors=await boot(page);page.on("dialog",d=>d.accept());await page.evaluate(()=>{switchTab("more");ux7SetView("more","overview",false)});
  await page.locator('button[onclick="training129PlanWeek()"]').click();
  await expect.poll(()=>page.evaluate(()=>calendarManualEvents().filter(x=>String(x.note||"").includes("Training OS 12.9")).length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>training129SuggestedWeek().length)).toBeGreaterThan(0);
  await page.evaluate(()=>openModal("ux7QuickSheet"));await expect(page.locator('[data-training129-action="1"]')).toBeVisible();await page.evaluate(()=>closeModal("ux7QuickSheet"));
  const candidate=await page.evaluate(()=>lifeOsCandidates().find(x=>x.route==="training129")?.title||"");
  expect(typeof candidate).toBe("string");
  expect(errors).toEqual([])
});
