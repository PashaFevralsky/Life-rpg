import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#today123Command")).toBeVisible();
  return errors
}

test("14.1 Product Core exposes one default Today decision surface",async({page})=>{
  const errors=await boot(page);
  const primary=page.locator("#today123Command").locator("xpath=ancestor::div[contains(@class,'card')][1]");
  await expect(primary).toBeVisible();
  await expect(primary.locator(".section-title")).toHaveText("Что делать сейчас");
  await expect(page.locator("#capture2Command")).toBeVisible();

  for(const id of ["lifeOsCommand","decisionOsCommand","tasksOsCommand","routinesOsCommand","trackingOsCommand","focusOsCommand","executionOsCommand","today123Reserved","today123Deferred"]){
    await expect(page.locator(`#${id}`)).toBeHidden();
  }
  await expect(page.locator("#dailyEngine")).toBeHidden();
  await expect(page.locator("#todayPriorities")).toBeHidden();

  const details=page.locator('[data-product-core-action="details"]');
  await expect(details).toBeVisible();
  await expect(details).toHaveAttribute("aria-expanded","false");
  await details.click();
  await expect(details).toHaveAttribute("aria-expanded","true");
  await expect(page.locator("#lifeOsCommand")).toBeVisible();
  await expect(page.locator("#tasksOsCommand")).toBeVisible();
  await expect(page.locator("#routinesOsCommand")).toBeVisible();
  await expect(page.locator("#executionOsCommand")).toBeVisible();
  expect(errors).toEqual([])
});

test("14.1 Product Core usage analytics stays local and is inspectable",async({page})=>{
  const errors=await boot(page);
  await page.locator('[data-tab="finance"]').click();
  await page.locator('[data-tab="today"]').click();
  await page.locator("#ux128SearchBtn").click();
  await page.evaluate(()=>closeModal("ux128SearchSheet"));

  const usage=await page.evaluate(()=>JSON.parse(localStorage.getItem("life-rpg-product-usage-v1")||"{}"));
  const totals=Object.values(usage.days||{}).reduce((acc,day)=>{for(const [k,v] of Object.entries(day||{}))acc[k]=(acc[k]||0)+v;return acc},{});
  expect(totals["nav:finance"]).toBeGreaterThanOrEqual(1);
  expect(totals["nav:today"]).toBeGreaterThanOrEqual(1);
  expect(totals.search).toBeGreaterThanOrEqual(1);

  await page.evaluate(()=>ux7Go("more","settings"));
  await expect(page.locator("#productUsage141Card")).toBeVisible();
  await expect(page.locator("#productUsage141List")).toContainText("Деньги");
  expect(errors).toEqual([])
});
