"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert"),dist=path.join(__dirname,"dist"),read=n=>fs.readFileSync(path.join(dist,n),"utf8");
for(const f of ["index.html","core.js","bootstrap.js","integration-12.5.js","feedback-os.js","import-hub.js","ux-12.8.js","ux-12.8.css","focus-os.js","people-os.js","capture2-os.js","manifest.webmanifest"]){assert.ok(fs.existsSync(path.join(dist,f)),`dist missing ${f}`)}
const sw=read("sw.js");assert.ok(sw.includes("life-rpg-12.5.0"),"generated Workbox SW does not contain the 12.5.0 cache namespace");
assert.ok(read("core.js").includes('APP_VERSION="12.5.0"'),"dist core release mismatch");
const boot=read("bootstrap.js");assert.ok(boot.includes('"integration-12.5.js"'));assert.ok(boot.includes('"feedback-os.js"'));assert.ok(boot.includes('"import-hub.js"'));assert.ok(boot.includes('"ux-12.8.js"'),"dist bootstrap missing 12.8 UX");
assert.ok(read("ux-12.8.js").includes("Mobile UX & Interface Consolidation"));assert.ok(read("ux-12.8.css").includes("Life RPG 12.8"));
console.log("OK — production dist contains Life RPG 12.5.0 runtime through UX 12.8 and Workbox namespace");
