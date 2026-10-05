"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
for(const f of ["product-core-14.1.2.js","product-core-14.1.2.e2e.test.js","bootstrap.js","vite.config.mjs","package.json","playwright.config.mjs"])
  assert.ok(fs.existsSync(f),`${f} missing`);

const mod=read("product-core-14.1.2.js"),boot=read("bootstrap.js"),vite=read("vite.config.mjs"),
      pkg=JSON.parse(read("package.json")),pw=read("playwright.config.mjs");

assert.ok(mod.includes('ux7RegisterClarityProvider("product-core-14.1.2"'));
assert.ok(mod.includes('"autopilotPlan"'));
assert.ok(mod.includes('"workOsCommand"'));
assert.ok(mod.includes('"tennisDecision22Next"'));
assert.ok(mod.includes('"decisionEngine","moneyEngineSummary"'));
assert.ok(mod.includes('"work121Pace","work121Activity","work121Concentration"'));
assert.ok(mod.includes('"tennisOsCommand","tennisOsPlan","tennisSkills","tennisMonthlyReport"'));
assert.ok(mod.includes('querySelector(".ux7-tab.active")'),"clarity refresh must follow the active DOM view");
assert.ok(!mod.includes("globalThis.UX7_PREFS"),"clarity refresh must not depend on lexical UX7 internals through globalThis");
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(mod),"14.1.2 must remain local-only");

assert.ok(boot.includes('"product-core-14.1.2.js"'),"runtime registration missing");
assert.ok(boot.includes('["ensureProductCore1412Ui","renderProductCore1412"]'),"render pipeline registration missing");
assert.ok(boot.includes('if(typeof productCore1412Apply==="function")productCore1412Apply()'),"post-render ordering missing");
assert.ok(vite.includes('"product-core-14.1.2.js"'),"dist copy missing");
assert.ok(pkg.scripts.test.includes("product-core-14.1.2.test.js"),"static test registration missing");
assert.ok(pw.includes("product-core-14.1.2.e2e.test.js"),"E2E registration missing");

const release=JSON.parse(read("android-release-config.json"));
assert.equal(release.stateVersion,18,"14.1.2 must not migrate state");
console.log("OK — Life RPG 14.1.2 Domain Focus contract passed");
