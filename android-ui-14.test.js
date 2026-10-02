"use strict";
const fs=require("fs"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
const css=read("android-ui-14.css");
const prepare=read("android-release-prepare.mjs");
const gate=read("android-release-gate.test.js");
const workflow=read(".github/workflows/android-rc.yml");
const pw=read("playwright.android-rc.config.mjs");
const e2e=read("android-ui-14.e2e.test.js");

for(const token of [
  "--life-ui-nav-clearance",
  "background:#0f1218!important",
  "scroll-padding-bottom",
  '#finance>.ux7-section-head .ux7-tabs',
  '#more>.ux7-section-head .ux7-tabs',
  '#lifeOpsDayClose .life-ops-check',
  '[data-section="finance"] .ux7-fab',
  '[data-section="more"][data-view="settings"] .ux7-fab',
  "max-height:calc(100dvh",
  ":focus-visible"
]) assert.ok(css.includes(token),`android-ui-14.css missing ${token}`);

assert.ok(prepare.includes('"android-ui-14.css"'),"Android prepare must copy UI hardening CSS");
assert.ok(prepare.includes('href="./android-ui-14.css"'),"Android prepare must inject UI hardening CSS");
assert.ok(gate.includes('"android-ui-14.css"'),"Android release gate must require UI CSS");
assert.ok(workflow.includes("Android RC UI geometry gate"),"RC workflow must run Android UI browser gate");
assert.ok(workflow.includes("android-ui-14.test.js"),"RC workflow must run Android UI static gate");
assert.ok(pw.includes("android-ui-14.e2e.test.js")&&pw.includes("4174"),"Android RC Playwright config is incomplete");

for(const phrase of ["bottom navigation","all five sections","modal","360","430"])
  assert.ok(e2e.toLowerCase().includes(phrase.toLowerCase()),`E2E intent missing: ${phrase}`);

console.log("OK — Life RPG 14.0 Android UI hardening static gate passed");
