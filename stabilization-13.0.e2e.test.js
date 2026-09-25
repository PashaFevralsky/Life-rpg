import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  return errors
}

test("13.0 stabilized shell is idempotent and extensions register once",async({page})=>{
  const errors=await boot(page);
  await expect(page.locator("#versionStatus")).toContainText("13.1.1");
  expect(await page.evaluate(()=>STATE_VERSION)).toBe(18);
  const before=await page.evaluate(()=>({
    huawei:document.querySelectorAll("#tennisHuaweiCard").length,
    training:document.querySelectorAll("#training129Command").length,
    work:document.querySelectorAll("#work121Pace").length,
    search:document.querySelectorAll("#ux128SearchSheet").length,
    quick:document.querySelectorAll("#ux7QuickSheet").length
  }));
  await page.evaluate(()=>{for(let i=0;i<8;i++)render()});
  const after=await page.evaluate(()=>({
    huawei:document.querySelectorAll("#tennisHuaweiCard").length,
    training:document.querySelectorAll("#training129Command").length,
    work:document.querySelectorAll("#work121Pace").length,
    search:document.querySelectorAll("#ux128SearchSheet").length,
    quick:document.querySelectorAll("#ux7QuickSheet").length,
    trainingCandidates:lifeOsCandidates().filter(x=>x.route==="training129").length,
    lifeExtensions:lifeOsExtensionStatus(),
    navigation:ux7NavigationStatus(),
    runtimeErrors:lifeRuntimeErrors(),
    pwa:pwaSetupStatus()
  }));
  expect(before).toEqual({huawei:1,training:1,work:1,search:1,quick:1});
  expect(after.huawei).toBe(1);expect(after.training).toBe(1);expect(after.work).toBe(1);expect(after.search).toBe(1);expect(after.quick).toBe(1);
  expect(after.trainingCandidates).toBeLessThanOrEqual(1);
  expect(after.lifeExtensions.candidateProviders).toContain("training129");expect(after.lifeExtensions.routeHandlers).toContain("training129");
  expect(after.navigation.listeners).toContain("ux128-navigation");
  expect(after.runtimeErrors).toEqual([]);expect(after.pwa.done).toBe(true);
  expect(errors).toEqual([])
});

test("13.0 navigation hooks preserve 12.8 restore behavior",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{switchTab("work");ux7SetView("work","crm",false)});
  await expect(page.locator("#work")).toHaveClass(/active/);
  await page.reload({waitUntil:"domcontentloaded"});await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#work")).toHaveClass(/active/);await expect(page.locator('#work .ux7-tab[data-view="crm"]')).toHaveClass(/active/);
  expect(errors).toEqual([])
});
