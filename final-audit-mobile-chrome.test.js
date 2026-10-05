"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const ui=fs.readFileSync("ui.js","utf8"),css=fs.readFileSync("interface-13.9.css","utf8"),android=fs.readFileSync("android-ui-14.css","utf8");
assert.ok(ui.includes('window.scrollTo({top:0,behavior:"auto"})'),"section switch must use immediate scroll");
assert.ok(!css.includes('.ux7-section-head .ux7-head-copy{\n    display:none!important;'),"compact header must not hide command actions");
assert.ok(css.includes('.ux7-head-actions>#commandPaletteBtn'),"compact sticky command button rule missing");
assert.ok(css.includes('padding-right:52px!important'),"sticky tabs must reserve room for command button");
assert.ok(android.includes("FINAL-AUDIT-R3-STICKY-COMMAND"),"Android sticky command spacing override missing");
console.log("OK — mobile sticky command palette remains reachable");
