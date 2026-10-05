"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const ui=fs.readFileSync("ui.js","utf8");
assert.ok(ui.includes('window.scrollTo({top:0,behavior:"auto"})'),"section switch must use immediate scroll");
const fn=(ui.match(/function switchTab\([^)]*\)\{[^\n]*\}/)||[])[0]||"";
assert.ok(fn&&!fn.includes('behavior:"smooth"'),"switchTab must not animate section scroll");
console.log("OK — mobile section navigation is immediately stable");
