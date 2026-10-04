"use strict";
const fs=require("fs"),assert=require("node:assert/strict");
const css=fs.readFileSync("android-ui-14.css","utf8");
const e2e=fs.readFileSync("android-ui-14.e2e.test.js","utf8");
const ui=fs.readFileSync("ui.js","utf8");
const prev=fs.readFileSync("ui-hotfix-14.0.2.test.js","utf8");
const cfg=JSON.parse(fs.readFileSync("android-release-config.json","utf8"));

for(const token of [
  "Life RPG 14.0.3 — semantic mobile header cleanup",
  ".top-actions>#commandPaletteBtn",
  ".top-actions>#installBtn",
  'button[onclick*="exportBackup"]',
  ".top-actions>#ux128SearchBtn",
  ".top-actions>#ux7HeaderQuickAddBtn"
]) assert.ok(css.includes(token),`14.0.3 CSS missing: ${token}`);

for(const token of [
  'headerAdd.id="ux7HeaderQuickAddBtn"',
  'headerAdd.setAttribute("aria-label","Быстрое добавление")',
  'headerAdd.onclick=()=>openModal("ux7QuickSheet")'
]) assert.ok(ui.includes(token),`14.0.3 ui.js missing: ${token}`);

assert.ok(e2e.includes('mobile header exposes search and Quick Add only'));
assert.ok(e2e.includes('["ux128SearchBtn","ux7HeaderQuickAddBtn"]'));
assert.ok(e2e.includes("14\\.0\\.3-rc"));
assert.ok(prev.includes("Android targetVersion must be >= 14.0.2"));
assert.equal(cfg.targetVersion,"14.0.3");
assert.equal(cfg.channel,"rc");
assert.equal(cfg.stateVersion,18);

console.log("OK — Life RPG 14.0.3 semantic mobile-header hotfix contract passed");
