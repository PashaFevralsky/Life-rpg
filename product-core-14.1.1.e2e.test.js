import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  return errors
}

test("14.1.1 Setup Center ignores defaults and reaches 100% only from factual setup",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>ux7Go("more","overview"));
  await expect(page.locator("#productSetup1411Card")).toBeVisible();
  await expect(page.locator("#productSetup1411Summary")).toContainText("0%");
  await expect(page.locator("#productSetup1411Summary")).toContainText("0/5");

  const initial=await page.evaluate(()=>productCore1411SetupStatus());
  expect(initial.done).toBe(0);
  expect(initial.score).toBe(0);

  await page.evaluate(()=>{
    S.accounts[0].verifiedBalance=25000;S.accounts[0].verifiedAt=new Date().toISOString();
    S.settings.monthlyIncome=100000;
    S.regularPayments=[{id:"e2e-rp",name:"Аренда",amount:30000,dueDay:5,active:true}];
    S.settings.workMonthlyPlan=500000;
    S.entities.tasks=[{id:"e2e-task",title:"Первое действие",status:"active"}];
    productCore1411RenderSetup()
  });
  await expect(page.locator("#productSetup1411Summary")).toContainText("100%");
  await expect(page.locator("#productSetup1411Summary")).toContainText("5/5");
  await expect(page.locator("#productSetup1411Steps .tag")).toHaveCount(5);
  expect(errors).toEqual([])
});

test("14.1.1 Adaptive More promotes repeatedly used tools",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{
    productUsage141Track("more:knowledge");
    productUsage141Track("more:knowledge");
    productUsage141Track("more:recovery");
    productUsage141Track("more:recovery");
    productUsage141Track("more:recovery");
    ux7Go("more","overview");
    productCore1411RenderAdaptiveMore()
  });
  const frequent=page.locator("#productCore1411Frequent");
  await expect(frequent).toBeVisible();
  const rows=frequent.locator("[data-product-adaptive]");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute("data-product-feature","more:recovery");
  await expect(rows.nth(1)).toHaveAttribute("data-product-feature","more:knowledge");

  await rows.nth(1).click();
  await expect(page.locator('#more .ux7-tab[data-view="knowledge"]')).toHaveClass(/active/);
  expect(errors).toEqual([])
});
