"use strict";
const fs=require("fs"),assert=require("node:assert/strict");
const css=fs.readFileSync("android-ui-14.css","utf8");
const e2e=fs.readFileSync("android-ui-14.e2e.test.js","utf8");
const cfg=JSON.parse(fs.readFileSync("android-release-config.json","utf8"));
const audit=fs.readFileSync("audit-hotfix-14.0.1.test.js","utf8");

for(const token of [
  "Life RPG 14.0.2 — device UI hotfix",
  "--life-ui-nav-content-buffer:112px",
  "padding-bottom:calc(var(--life-ui-nav-clearance) + var(--life-ui-nav-content-buffer))!important",
  ".top-actions>.iconbtn",
  "width:48px!important",
  "width:20px!important"
]) assert.ok(css.includes(token),`14.0.2 UI CSS missing: ${token}`);

assert.ok(e2e.includes("navTop-24"));
assert.ok(e2e.includes("top action buttons share one visual geometry"));
assert.ok(e2e.includes("14\\.0\\.2-rc"));
assert.ok(audit.includes("Android targetVersion must be >= 14.0.1"));
assert.equal(cfg.targetVersion,"14.0.2");
assert.equal(cfg.channel,"rc");
assert.equal(cfg.stateVersion,18);

console.log("OK — Life RPG 14.0.2 real-device UI hotfix contract passed");
