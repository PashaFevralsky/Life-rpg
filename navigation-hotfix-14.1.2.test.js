"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
for(const f of ["navigation-hotfix-14.1.2.js","navigation-hotfix-14.1.2.e2e.test.js","bootstrap.js","vite.config.mjs","package.json","playwright.config.mjs","android-release-config.json"])
  assert.ok(fs.existsSync(f),`${f} missing`);
const nav=read("navigation-hotfix-14.1.2.js"),boot=read("bootstrap.js"),vite=read("vite.config.mjs"),pkg=JSON.parse(read("package.json")),pw=read("playwright.config.mjs"),rc=JSON.parse(read("android-release-config.json"));
for(const token of [
  "async function lifeNavigate(opts={})","async function lifeNavigateEntity(type,id=\"\",extra={})","function nav1412Reveal(node)",
  "productCore141SetExpanded(true,false)","ux7ToggleEditor(card,true)","ux7ToggleClarity(section)",
  "commandRoute=function(type,id)","lifeOsOpen=function(area,route=\"\",ctx={})","calendarOpenEvent=function(id)",
  "import127Route=function()","#aiImportPreview","#calibrationOsCommand","editWork=function(id)","editTennis=function(id)",
  "life-rpg:navigation-complete"
])assert.ok(nav.includes(token),`navigation token missing: ${token}`);
assert.ok(nav.includes('ux7Go=function(sectionId,view){return lifeNavigate'),"ux7Go must use the unified navigator");
assert.ok(nav.includes('if(targetSection)section=targetSection'),"target DOM section must override a stale route");
assert.ok(nav.includes('if(cardViews.length)view=cardViews[0]'),"target card view must override a stale view");
assert.ok(nav.includes('if(/project|goal/.test(s))return["more","overview"]'),"Recent project/goal routing must point to More");
assert.ok(boot.includes('"navigation-hotfix-14.1.2.js"'),"runtime module registration missing");
assert.ok(boot.includes('["ensureNavigationHotfix1412Ui","renderNavigationHotfix1412"]'),"render pipeline install missing");
assert.ok(vite.includes('"navigation-hotfix-14.1.2.js"'),"production copy missing");
assert.ok(pkg.scripts.test.includes("navigation-hotfix-14.1.2.test.js"),"static navigation contract not registered");
assert.ok(pw.includes("navigation-hotfix-14.1.2.e2e.test.js"),"navigation E2E not registered");
assert.equal(rc.stateVersion,18,"navigation hotfix must not migrate state");
assert.equal(rc.targetVersion,"14.1.2","navigation hotfix must stay within current 14.1.2 RC target");
assert.ok(!/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(nav),"navigation hotfix must remain local-only");
console.log("OK — Life RPG 14.1.2 navigation hardening contract passed");
