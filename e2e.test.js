import { test, expect } from "@playwright/test";
test("Life RPG 10 mobile critical flow",async({page})=>{
  const pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));
  await page.goto("/");await expect(page.locator("#today")).toHaveClass(/active/);await expect(page.locator("#versionStatus")).toContainText("10.0.0");
  await page.locator('[data-tab="work"]').click();await expect(page.locator("#work")).toHaveClass(/active/);
  await page.evaluate(()=>window.ux7Go?.("work","crm"));await page.locator("#crmName").fill("E2E объект");await page.locator("#crmCity").fill("Екатеринбург");await page.locator("#crmPotential").fill("600000");await page.locator("#crmNextStep").fill("Позвонить ЛПР");await page.locator("#crmNextDate").fill(new Date().toISOString().slice(0,10));await page.locator('button[onclick="saveCrmDeal()"]',).click();await expect(page.locator("#crmDealList")).toContainText("E2E объект");
  await page.locator('[data-tab="tennis"]').click();await page.evaluate(()=>window.ux7Go?.("tennis","training"));await page.locator("#ttMatches").fill("Соперник A | 1200 | W | 3:1 | test");await page.locator("#ttSaveBtn").click();await expect(page.locator("#tennisLog")).toContainText("матчи 1:0");
  await page.locator('[data-tab="more"]').click();await page.evaluate(()=>window.ux7Go?.("more","knowledge"));await page.locator('button[onclick="openModal(\'bookModal\')"]').click();await page.locator("#bookTitle").fill("E2E книга");await page.locator("#bookPages").fill("100");await page.locator('button[onclick="addBook()"]',).click();await expect(page.locator("#bookList")).toContainText("E2E книга");
  expect(pageErrors).toEqual([]);
});
