import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#versionStatus")).toContainText("13.2.2");
  await page.evaluate(()=>{switchTab("more");ux7SetView("more","settings",false)});
  return errors
}

test("Recovery 13.3 renders, creates checksummed checkpoint and scans storage",async({page})=>{
  const errors=await boot(page);
  await expect(page.locator("#recovery133Center")).toBeVisible();
  await expect(page.locator("#recovery133Center")).toContainText("Recovery Center 13.3");
  await page.evaluate(()=>recovery133CreateManualCheckpoint());
  await expect(page.locator("#recovery133Snapshots")).toContainText("Ручной checkpoint 13.3");
  const scan=await page.evaluate(()=>recovery133ScanStorage({quiet:true}));
  expect(scan.current.ok).toBe(true);
  expect(scan.snapshots.checked).toBeGreaterThan(0);
  expect(scan.snapshots.failed).toBe(0);
  const newest=await page.evaluate(async()=>{const rows=await recovery133LoadAllSnapshots();return recovery133VerifySnapshot(rows[0],{upgradeLegacy:true})});
  expect(newest.ok).toBe(true);
  expect(newest.meta.checksum).toMatch(/^sha256:/);
  expect(errors).toEqual([])
});

test("Recovery 13.3 Safe Mode is reversible and DR bundle self-verifies",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>recovery133SetSafeMode(true,"e2e"));
  await expect(page.locator("#recovery133SafeBadge")).toHaveText("SAFE MODE");
  expect(await page.evaluate(()=>document.documentElement.classList.contains("recovery133-safe"))).toBe(true);
  expect(await page.evaluate(()=>recovery133SafeModeActive())).toBe(true);
  const parsed=await page.evaluate(async()=>{const bundle=await recovery133PrepareBundle();return recovery133ParseBundleText(JSON.stringify(bundle))});
  expect(parsed.format).toBe("life-rpg-disaster-recovery-v1");
  expect(parsed.stateVersion).toBe(18);
  await page.evaluate(()=>recovery133SetSafeMode(false,"e2e"));
  await expect(page.locator("#recovery133SafeBadge")).toHaveText("WRITE MODE");
  expect(await page.evaluate(()=>recovery133SafeModeActive())).toBe(false);
  expect(errors).toEqual([])
});
