import { test, expect } from "@playwright/test";

test("Life RPG 10 mobile critical flow", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(String(error)));

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  await page.goto("/");
  await expect(page.locator("#today")).toHaveClass(/active/);
  await expect(page.locator("#versionStatus")).toContainText("10.0.0");

  // Work -> CRM -> reveal compact editor -> save deal.
  await page.locator('[data-tab="work"]').click();
  await expect(page.locator("#work")).toHaveClass(/active/);

  const crmTab = page.locator('#work .ux7-tab[data-view="crm"]');
  await expect(crmTab).toBeVisible();
  await crmTab.click();

  const crmCard = page.locator("#crmEditorCard");
  await expect(crmCard).toBeVisible();

  if (await crmCard.evaluate(el =>
    el.classList.contains("ux7-editor-collapsed")
  )) {
    await crmCard.locator(".ux7-editor-toggle").click();
  }

  await expect(page.locator("#crmName")).toBeVisible();

  await page.locator("#crmName").fill("E2E объект");
  await page.locator("#crmCity").fill("Екатеринбург");
  await page.locator("#crmPotential").fill("600000");
  await page.locator("#crmNextStep").fill("Позвонить ЛПР");
  await page.locator("#crmNextDate").fill(today);

  await page
    .locator('button[onclick="saveCrmDeal()"]')
    .click();

  await expect(page.locator("#crmDealList"))
    .toContainText("E2E объект");

  await expect(page.locator("#crmDealList"))
    .toContainText("Позвонить ЛПР");

  // Tennis -> Training -> reveal compact editor -> add rated match.
  await page.locator('[data-tab="tennis"]').click();
  await expect(page.locator("#tennis")).toHaveClass(/active/);

  const trainingTab =
    page.locator('#tennis .ux7-tab[data-view="training"]');

  await expect(trainingTab).toBeVisible();
  await trainingTab.click();

  const tennisCard =
    page.locator('#tennis .card:has(#ttSaveBtn)');

  await expect(tennisCard).toBeVisible();

  if (await tennisCard.evaluate(el =>
    el.classList.contains("ux7-editor-collapsed")
  )) {
    await tennisCard.locator(".ux7-editor-toggle").click();
  }

  await expect(page.locator("#ttSaveBtn")).toBeVisible();

  const matchDetails =
    page.locator("#ttMatches").locator("xpath=ancestor::details");

  await expect(matchDetails.locator("summary")).toBeVisible();

  if (!(await matchDetails.evaluate(el => el.open))) {
    await matchDetails.locator("summary").click();
  }

  await expect(page.locator("#ttMatches")).toBeVisible();

  await page.locator("#ttMatches").fill(
    "Соперник A | 1200 | W | 3:1 | test"
  );

  await page.locator("#ttSaveBtn").click();

  await expect(page.locator("#tennisLog"))
    .toContainText("матчи 1:0");

  await expect(page.locator("#tennisLog"))
    .toContainText("Соперник A");

  // More -> Knowledge -> add a book through the real modal.
  await page.locator('[data-tab="more"]').click();
  await expect(page.locator("#more")).toHaveClass(/active/);

  const knowledgeTab =
    page.locator('#more .ux7-tab[data-view="knowledge"]');

  await expect(knowledgeTab).toBeVisible();
  await knowledgeTab.click();

  const addBookButton = page.locator(
    'button[onclick="openModal(\'bookModal\')"]'
  );

  await expect(addBookButton).toBeVisible();
  await addBookButton.click();

  await expect(page.locator("#bookModal"))
    .toHaveClass(/open/);

  await page.locator("#bookTitle").fill("E2E книга");
  await page.locator("#bookPages").fill("100");

  await page
    .locator('button[onclick="addBook()"]')
    .click();

  await expect(page.locator("#bookList"))
    .toContainText("E2E книга");

  expect(pageErrors).toEqual([]);
});
