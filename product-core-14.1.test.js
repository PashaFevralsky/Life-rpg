"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");

for(const f of ["product-core-14.1.js","product-core-14.1.e2e.test.js","bootstrap.js","vite.config.mjs","package.json","playwright.config.mjs","e2e.test.js"])assert.ok(fs.existsSync(f),`${f} missing`);

const mod=read("product-core-14.1.js"),boot=read("bootstrap.js"),vite=read("vite.config.mjs"),
      pkg=JSON.parse(read("package.json")),pw=read("playwright.config.mjs"),e2e=read("e2e.test.js");

assert.ok(mod.includes('PRODUCT_CORE141_USAGE_KEY="life-rpg-product-usage-v1"'));
assert.ok(mod.includes("function productCore141Apply()"));
assert.ok(mod.includes("function productUsage141Track(feature)"));
assert.ok(mod.includes('["lifeOsCommand","todayFlowCommand","decisionOsCommand","tasksOsCommand","routinesOsCommand","trackingOsCommand","focusOsCommand","executionOsCommand","today123Reserved","today123Deferred"]'));
assert.ok(mod.includes('["dailyEngine","todayPriorities"]'));
assert.ok(mod.includes('title.textContent="Что делать сейчас"'));
assert.ok(mod.includes('data-product-core-action="details"'));
assert.ok(mod.includes("localStorage.setItem(PRODUCT_CORE141_USAGE_KEY"));
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(mod),"Product usage must remain local-only");

assert.ok(boot.includes('"product-core-14.1.js"'),"Product Core runtime module missing");
assert.ok(boot.includes('["ensureProductCore141Ui","renderProductCore141"]'),"Product Core render pipeline missing");
assert.ok(boot.includes('dashboardApply();if(typeof productCore141Apply==="function")productCore141Apply()'),"Product Core must run after dashboard ordering");

assert.ok(vite.includes('"product-core-14.1.js"'),"Product Core must be copied to dist");
assert.ok(pkg.scripts.test.includes("product-core-14.1.test.js"),"Product Core static contract missing from npm test");
assert.ok(pw.includes("product-core-14.1.e2e.test.js"),"Product Core E2E missing from Playwright");
assert.ok(e2e.includes('data-product-core-action="task"'),"Critical E2E must use Product Core task entry");
assert.ok(e2e.includes('page.locator("#lifeOsCommand")).toBeHidden()'),"Critical E2E must assert default simplification");

const release=JSON.parse(read("android-release-config.json"));
assert.equal(release.stateVersion,18,"Product Core must not migrate state");
console.log("OK — Life RPG 14.1 Product Core v1 contract passed");
