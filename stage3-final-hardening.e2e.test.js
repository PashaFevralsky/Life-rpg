import { test, expect } from "@playwright/test";

test("Stage 3.5 final mobile/PWA/Recovery gate",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.setViewportSize({width:360,height:480});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#versionStatus")).toContainText("13.9.0");

  await page.evaluate(()=>openModal("readingModal"));
  const card=page.locator("#readingModal .modal-card");
  await expect(card).toBeVisible();
  const geometry=await card.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {top:r.top,bottom:r.bottom,viewport:window.innerHeight,maxHeight:s.maxHeight}});
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport+1);
  expect(geometry.maxHeight).toMatch(/px$/);
  await page.keyboard.press("Escape");

  const result=await page.evaluate(async()=>({
    pwaProbe:typeof pwaMaybeRefreshRegistration==="function",
    forcedReload:String(setupPwa).includes("location.reload"),
    storageEstimate:await recovery133StorageEstimate()
  }));
  expect(result.pwaProbe).toBe(true);
  expect(result.forcedReload).toBe(false);
  expect(typeof result.storageEstimate.supported).toBe("boolean");
  expect(errors).toEqual([]);
});
