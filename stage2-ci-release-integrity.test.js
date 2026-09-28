"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert");
const root=__dirname,read=p=>fs.readFileSync(path.join(root,p),"utf8");
const pkg=JSON.parse(read("package.json")),core=read("core.js"),manifest=read("manifest.webmanifest"),vite=read("vite.config.mjs"),wf=read(".github/workflows/deploy-pages.yml");
const release=(core.match(/APP_VERSION="([^"]+)"/)||[])[1];
assert.equal(release,"13.7.4");
assert.equal(pkg.version,release,"package.json release must match runtime APP_VERSION");
assert.ok(manifest.includes(`Life RPG ${release}`),"manifest release mismatch");
assert.ok(vite.includes(`cacheId:"life-rpg-${release}"`),"Workbox cacheId release mismatch");
for(const expected of [
  "actions/checkout@v7",
  "actions/setup-node@v7",
  "actions/configure-pages@v6",
  "actions/upload-pages-artifact@v5",
  "actions/deploy-pages@v5"
])assert.ok(wf.includes(expected),`CI action version missing: ${expected}`);
assert.ok(wf.includes("node-version: 22"),"Application CI Node version changed unexpectedly");
console.log("OK — Stage 2.13 CI/release integrity: npm runtime release aligned and GitHub Actions modernized");
