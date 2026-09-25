import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#ux128SearchBtn")).toBeVisible();
  return errors
}

test("12.8 shell exposes global search, expanded quick actions and Recent",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{taskCreate({title:"E2E UX Search Task",area:"Система",priority:2,minutes:15});audit("E2E recent","system","UX 12.8");render()});

  await page.locator("#ux128SearchBtn").click();
  await expect(page.locator("#ux128SearchSheet")).toHaveClass(/open/);
  await page.locator("#ux128SearchInput").fill("E2E UX Search Task");
  await expect(page.locator("#ux128SearchResults")).toContainText("E2E UX Search Task");
  await page.evaluate(()=>closeModal("ux128SearchSheet"));

  await page.evaluate(()=>openModal("ux7QuickSheet"));
  for(const action of ["task","inbox","recent","search","import"])await expect(page.locator(`[data-ux128-action="${action}"]`)).toBeVisible();
  await page.evaluate(()=>closeModal("ux7QuickSheet"));

  await page.evaluate(()=>ux128OpenRecent());
  await expect(page.locator("#ux128RecentSheet")).toHaveClass(/open/);
  await expect(page.locator("#ux128RecentList")).toContainText("E2E recent");
  expect(errors).toEqual([])
});

test("12.8 restores last section/view and consolidates More",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{switchTab("work");ux7SetView("work","crm",false)});
  await expect(page.locator("#work")).toHaveClass(/active/);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#work")).toHaveClass(/active/);
  await expect(page.locator('#work .ux7-tab[data-view="crm"]')).toHaveClass(/active/);

  await page.evaluate(()=>{switchTab("more");ux7SetView("more","overview",false)});
  await expect(page.locator("#more .book-hero")).toBeHidden();
  await expect(page.locator("#weeklyReview").locator("xpath=ancestor::div[contains(@class,'card')]")).toBeHidden();
  await expect(page.locator("#calibrationOsCommand").locator("xpath=ancestor::div[contains(@class,'card')]")).toBeHidden();

  await page.evaluate(()=>ux7SetView("more","settings",false));
  await expect(page.locator("#calibrationOsCommand").locator("xpath=ancestor::div[contains(@class,'card')]")).toBeVisible();
  expect(errors).toEqual([])
});

test("12.8 mobile sticky form actions stay in the viewport",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{switchTab("work");ux7SetView("work","log",false)});
  const save=page.locator("#workSaveBtn"),row=save.locator("xpath=ancestor::div[contains(@class,'split')][1]");
  await expect(row).toHaveClass(/ux128-sticky-actions/);
  const box=await save.boundingBox();expect(box).not.toBeNull();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(412);
  expect(errors).toEqual([])
});
