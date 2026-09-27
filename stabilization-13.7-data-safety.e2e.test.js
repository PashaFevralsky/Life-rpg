import { test, expect } from "@playwright/test";

async function boot(page){
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
}

test("Stage 1: stale tab cannot overwrite a newer state",async({page,context})=>{
  await boot(page);
  const page2=await context.newPage();await boot(page2);
  const stamp=Date.now(),titleA=`stage137-a-${stamp}`,titleB=`stage137-b-${stamp}`;

  await page.evaluate(async title=>{
    taskCreate({title,area:"Система",priority:3,minutes:5});
    await persist()
  },titleA);

  await page2.waitForTimeout(100);
  const result=await page2.evaluate(async title=>{
    taskCreate({title,area:"Система",priority:3,minutes:5});
    try{await persist();return "saved"}catch(e){return String(e?.code||e?.message||e)}
  },titleB);
  expect(result).toContain("LIFE_RPG_STORAGE_CONFLICT");

  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  const saved=await page.evaluate(({a,b})=>({
    a:taskAll().some(x=>x.title===a),
    b:taskAll().some(x=>x.title===b)
  }),{a:titleA,b:titleB});
  expect(saved.a).toBe(true);
  expect(saved.b).toBe(false);
});
