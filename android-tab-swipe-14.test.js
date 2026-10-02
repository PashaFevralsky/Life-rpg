"use strict";
const fs=require('fs'),assert=require('node:assert/strict');
const js=fs.readFileSync('android-tab-swipe-14.js','utf8');
const css=fs.readFileSync('android-tab-swipe-14.css','utf8');
const prep=fs.readFileSync('android-release-prepare.mjs','utf8');
const gate=fs.readFileSync('android-release-gate.test.js','utf8');
const ready=fs.readFileSync('release-readiness-14.0.test.js','utf8');
const wf=fs.readFileSync('.github/workflows/android-rc.yml','utf8');
const pw=fs.readFileSync('playwright.android-rc.config.mjs','utf8');

for(const token of [
  "edge:28","minX:64","ratio:1.35","maxMs:950",
  "leaveMs:90","enterMs:190","settleMs:34",
  "pointerType!=='touch'","x<CFG.edge","interactiveTarget","horizontalScroller","hasOpenModal",
  "next<0||next>=list.length","life-tab-swipe-transitioning",
  "ux7SetView(section.id,view,true)","life-rpg:tab-swipe","isTransitioning"
]) assert.ok(js.includes(token),`swipe runtime missing ${token}`);

for(const token of [
  'touch-action:pan-y pinch-zoom','prefers-reduced-motion',
  'lifeTabSwipeLeaveNext','lifeTabSwipeLeavePrev',
  'lifeTabSwipeEnterNext','lifeTabSwipeEnterPrev',
  'cubic-bezier(.22,.61,.36,1)'
]) assert.ok(css.includes(token),`swipe css missing ${token}`);

for(const token of ['android-tab-swipe-14.js','android-tab-swipe-14.css'])assert.ok(prep.includes(token),`prepare missing ${token}`);
for(const token of ['android-tab-swipe-14.js','android-tab-swipe-14.css'])assert.ok(gate.includes(token),`release gate missing ${token}`);
for(const token of ['android-tab-swipe-14.js','android-tab-swipe-14.css','android-tab-swipe-14.e2e.test.js'])assert.ok(ready.includes(token),`readiness missing ${token}`);
assert.ok(wf.includes('Test Android tab swipe source contract'));
assert.ok(pw.includes('android-tab-swipe-14.e2e.test.js'));
console.log('OK — Android smooth sub-tab swipe source contract passed');
