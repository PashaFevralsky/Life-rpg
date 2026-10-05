import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  return errors
}

test("14.1.2 Finance has one default decision surface and details remain available",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>ux7Go("finance","overview"));
  await expect(page.locator("#autopilotPlan")).toBeVisible();
  await expect(page.locator("#autopilotPlan").locator("xpath=ancestor::div[contains(@class,'card')]")).toContainText("Что делать с деньгами сейчас");
  await expect(page.locator("#decisionEngine")).toBeHidden();
  await expect(page.locator("#moneyEngineSummary")).toBeHidden();

  const toggle=page.locator("#finance .ux7-clarity-toggle");
  await toggle.click();
  await expect(page.locator("#decisionEngine")).toBeVisible();
  await expect(page.locator("#moneyEngineSummary")).toBeVisible();

  await page.evaluate(()=>ux7Go("finance","operations"));
  await expect(page.locator("#regularPaymentList")).toBeVisible();
  await expect(page.locator("#finance .ux7-clarity-toggle")).toBeHidden();
  expect(errors).toEqual([])
});

test("14.1.2 Work keeps KPI context plus one action center",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>ux7Go("work","overview"));
  await expect(page.locator("#work .work-hero")).toBeVisible();
  await expect(page.locator("#workOsCommand")).toBeVisible();
  await expect(page.locator("#workOsCommand").locator("xpath=ancestor::div[contains(@class,'card')]")).toContainText("Что делать сейчас");
  await expect(page.locator("#workPace")).toBeHidden();
  await expect(page.locator("#work121Pace")).toBeHidden();

  await page.locator("#work .ux7-clarity-toggle").click();
  await expect(page.locator("#workPace")).toBeVisible();
  await expect(page.locator("#work121Pace")).toBeVisible();

  await page.evaluate(()=>ux7Go("work","crm"));
  await expect(page.locator("#crmSummary")).toBeVisible();
  await expect(page.locator("#workOsQuality")).toBeVisible();
  expect(errors).toEqual([])
});

test("14.1.2 Tennis keeps profile context plus one next-training prescription",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>ux7Go("tennis","overview"));
  await expect(page.locator("#tennis .tennis-hero")).toBeVisible();
  await expect(page.locator("#tennisDecision22Next")).toBeVisible();
  await expect(page.locator("#tennisDecision22Next").locator("xpath=ancestor::div[contains(@class,'card')]")).toContainText("Следующая тренировка");
  await expect(page.locator("#tennisOsCommand")).toBeHidden();
  await expect(page.locator("#tennisSkills")).toBeHidden();

  await page.locator("#tennis .ux7-clarity-toggle").click();
  await expect(page.locator("#tennisOsCommand")).toBeVisible();
  await expect(page.locator("#tennisSkills")).toBeVisible();

  await page.evaluate(()=>ux7Go("tennis","training"));
  await expect(page.locator("#ttSaveBtn")).toBeVisible();
  await expect(page.locator("#tennisHuaweiCard")).toBeVisible();
  expect(errors).toEqual([])
});
