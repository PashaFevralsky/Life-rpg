"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
for(const f of ["product-core-14.1.1.js","product-core-14.1.1.e2e.test.js","bootstrap.js","vite.config.mjs","package.json","playwright.config.mjs"])assert.ok(fs.existsSync(f),`${f} missing`);

const mod=read("product-core-14.1.1.js"),boot=read("bootstrap.js"),vite=read("vite.config.mjs"),
      pkg=JSON.parse(read("package.json")),pw=read("playwright.config.mjs");

assert.ok(mod.includes("function productCore1411SetupStatus()"));
assert.ok(mod.includes("verifiedBalance!=null"),"default account without verified balance must not count");
assert.ok(mod.includes("settings.incomeEvents"),"income readiness must use factual schedule");
assert.ok(mod.includes("S?.regularPayments"),"obligations readiness missing");
assert.ok(mod.includes("settings.workMonthlyPlan"),"work readiness missing");
assert.ok(mod.includes("entities.tasks"),"execution readiness missing");
assert.ok(mod.includes("x.count>=2"),"Adaptive More needs a minimum usage threshold");
assert.ok(mod.includes('group.id="productCore1411Frequent"'));
assert.ok(mod.includes('card.id="productSetup1411Card"'));
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(mod),"14.1.1 must remain local-only");

assert.ok(boot.includes('"product-core-14.1.1.js"'),"14.1.1 runtime module missing");
assert.ok(boot.includes('["ensureProductCore1411Ui","renderProductCore1411"]'),"14.1.1 render pipeline missing");
assert.ok(boot.includes('if(typeof productCore1411Apply==="function")productCore1411Apply()'),"14.1.1 post-render apply missing");
assert.ok(vite.includes('"product-core-14.1.1.js"'),"14.1.1 must be copied to dist");
assert.ok(pkg.scripts.test.includes("product-core-14.1.1.test.js"),"14.1.1 static test not registered");
assert.ok(pw.includes("product-core-14.1.1.e2e.test.js"),"14.1.1 E2E not registered");

const release=JSON.parse(read("android-release-config.json"));
assert.equal(release.stateVersion,18,"14.1.1 must not migrate state");
console.log("OK — Life RPG 14.1.1 Setup Center + Adaptive More contract passed");
