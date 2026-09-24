"use strict";
const fs=require("fs"),assert=require("assert"),path=require("path");
const root=__dirname,dist=path.join(root,"dist"),sw=fs.readFileSync(path.join(dist,"sw.js"),"utf8");
for(const f of ["index.html","core.js","bootstrap.js","focus-os.js","people-os.js","capture2-os.js","manifest.webmanifest"]){assert.ok(fs.existsSync(path.join(dist,f)),`dist missing ${f}`)}
assert.ok(sw.includes("life-rpg-12.0.3"),"generated Workbox SW does not contain the 12.0.3 cache namespace");
assert.ok(!sw.includes("life-rpg-12.0.0"),"generated Workbox SW still contains the old cache namespace");
console.log("OK — production dist / Workbox SW audit passed");
