import fs from "node:fs";

const marker="UI-HOTFIX-14.0.2.md";
if(fs.existsSync(marker)) throw new Error("UI hotfix 14.0.2 is already applied");

function read(file){return fs.readFileSync(file,"utf8")}
function write(file,s){fs.writeFileSync(file,s)}
function replaceOnce(file,oldText,newText,label){
  let s=read(file);
  const first=s.indexOf(oldText),last=s.lastIndexOf(oldText);
  if(first<0) throw new Error(`${label}: anchor not found in ${file}`);
  if(first!==last) throw new Error(`${label}: anchor is not unique in ${file}`);
  s=s.slice(0,first)+newText+s.slice(first+oldText.length);
  write(file,s);
}
function assertContains(file,token){
  if(!read(file).includes(token))throw new Error(`${token}: missing in ${file}`);
}

// 1) Real-device Android UI correction.
{
  const file="android-ui-14.css";
  let css=read(file);
  if(css.includes("Life RPG 14.0.2 — device UI hotfix"))throw new Error("14.0.2 CSS hotfix already present");
  css += `

/* Life RPG 14.0.2 — device UI hotfix
   Real-device correction after 14.0.1 RC acceptance. */
:root{
  --life-ui-nav-content-buffer:112px;
}

@media(max-width:850px){
  .ui82.ui139 .shell{
    padding-bottom:calc(var(--life-ui-nav-clearance) + var(--life-ui-nav-content-buffer))!important;
  }
  .ui82.ui139 .section.active{
    padding-bottom:24px;
    scroll-padding-bottom:calc(var(--life-ui-nav-clearance) + 48px)!important;
  }
  .ui82.ui139 .section.active :is(
    .card,.log-item,.quest,.debt,.book,.crm-deal,.boss,.goal,.reward,
    input,select,textarea,button,[tabindex]
  ):not(.bottom):not(.bottom *){
    scroll-margin-bottom:calc(var(--life-ui-nav-clearance) + 48px)!important;
  }

  .ui82.ui139 .top-actions{
    display:flex;
    align-items:center;
    gap:8px;
    flex:0 0 auto;
  }
  .ui82.ui139 .top-actions>.iconbtn{
    width:48px!important;
    min-width:48px!important;
    max-width:48px!important;
    height:48px!important;
    min-height:48px!important;
    max-height:48px!important;
    padding:0!important;
    display:grid!important;
    place-items:center!important;
    overflow:hidden;
    font-size:19px!important;
    line-height:1!important;
  }
  .ui82.ui139 .top-actions>.iconbtn :is(svg,i){
    width:20px!important;
    min-width:20px!important;
    max-width:20px!important;
    height:20px!important;
    min-height:20px!important;
    max-height:20px!important;
    margin:0!important;
    flex:none!important;
  }
}
`;
  write(file,css);
}

// 2) Android device-like E2E contract.
replaceOnce(
  "android-ui-14.e2e.test.js",
  `await expect(page).toHaveTitle(/Life RPG 14\\.0\\.1-rc\\./);`,
  `await expect(page).toHaveTitle(/Life RPG 14\\.0\\.2-rc\\./);`,
  "Android RC UI title 14.0.2"
);

replaceOnce(
  "android-ui-14.e2e.test.js",
  `expect(end.lastBottom,\`${"${section}"}: final card must scroll above bottom navigation\`).toBeLessThanOrEqual(end.navTop-8);`,
  `expect(end.lastBottom,\`${"${section}"}: final card must scroll above bottom navigation\`).toBeLessThanOrEqual(end.navTop-24);`,
  "bottom navigation visual clearance"
);

{
  const file="android-ui-14.e2e.test.js";
  let e2e=read(file);
  if(e2e.includes('test("Android RC top action buttons share one visual geometry"'))throw new Error("Top-action E2E already present");
  e2e += `

test("Android RC top action buttons share one visual geometry",async({page})=>{
  const errors=await boot(page,390,844);
  const actions=await page.locator(".top-actions>.iconbtn").evaluateAll(nodes=>nodes
    .filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return !el.hidden&&s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0})
    .map(el=>{
      const r=el.getBoundingClientRect(),icon=el.querySelector("svg,i"),ir=icon?.getBoundingClientRect();
      return {width:r.width,height:r.height,fontSize:parseFloat(getComputedStyle(el).fontSize)||0,iconWidth:ir?.width||0,iconHeight:ir?.height||0}
    }));
  expect(actions.length,"Today header should expose visible actions").toBeGreaterThanOrEqual(2);
  for(const a of actions){
    expect(a.width,"header action width").toBeGreaterThanOrEqual(47);
    expect(a.width,"header action width").toBeLessThanOrEqual(49);
    expect(a.height,"header action height").toBeGreaterThanOrEqual(47);
    expect(a.height,"header action height").toBeLessThanOrEqual(49);
    expect(a.fontSize,"text-icon visual size").toBeGreaterThanOrEqual(18);
    expect(a.fontSize,"text-icon visual size").toBeLessThanOrEqual(20);
    if(a.iconWidth){
      expect(a.iconWidth,"SVG/icon width").toBeGreaterThanOrEqual(19);
      expect(a.iconWidth,"SVG/icon width").toBeLessThanOrEqual(21);
      expect(a.iconHeight,"SVG/icon height").toBeGreaterThanOrEqual(19);
      expect(a.iconHeight,"SVG/icon height").toBeLessThanOrEqual(21);
    }
  }
  expect(errors).toEqual([]);
});
`;
  write(file,e2e);
}

// 3) Android RC target 14.0.2; state schema unchanged.
{
  const file="android-release-config.json";
  const c=JSON.parse(read(file));
  if(c.targetVersion!=="14.0.1"||c.channel!=="rc")
    throw new Error(`Expected 14.0.1/rc, got ${c.targetVersion}/${c.channel}`);
  c.targetVersion="14.0.2";
  c.notes="Android 14.0.2 RC: real-device UI hotfix for bottom navigation clearance and consistent top action icon geometry.";
  write(file,JSON.stringify(c,null,2)+"\n");
}

replaceOnce(
  "release-readiness-14.0.test.js",
  `assert.equal(cfg.targetVersion,"14.0.1");`,
  `assert.equal(cfg.targetVersion,"14.0.2");`,
  "readiness targetVersion"
);

replaceOnce(
  "android-release-gate.test.js",
  `assert.equal(cfg.targetVersion,"14.0.1");`,
  `assert.equal(cfg.targetVersion,"14.0.2");`,
  "release gate targetVersion"
);

replaceOnce(
  "android-release-gate.test.js",
  `assert.match(meta.versionName,/^14\\.0\\.1-rc\\.\\d+$/);
assert.ok(meta.versionCode>14000099,"14.0.1 RC must update over signed 14.0.0 Stable");`,
  `assert.match(meta.versionName,/^14\\.0\\.2-rc\\.\\d+$/);
assert.ok(meta.versionCode>14000116,"14.0.2 RC must update over installed 14.0.1 RC run 16");`,
  "release gate 14.0.2 version line"
);

// 4) Make the earlier 14.0.1 audit regression forward-compatible.
// It should prove those fixes remain present, not pin the application forever to exactly 14.0.1.
replaceOnce(
  "audit-hotfix-14.0.1.test.js",
  `  assert.equal(JSON.parse(fs.readFileSync("android-release-config.json","utf8")).targetVersion,"14.0.1");`,
  `  {
    const v=String(JSON.parse(fs.readFileSync("android-release-config.json","utf8")).targetVersion||"").split(".").map(Number);
    assert.ok(v.length===3&&v.every(Number.isInteger)&&(v[0]>14||(v[0]===14&&(v[1]>0||(v[1]===0&&v[2]>=1)))),"Android targetVersion must be >= 14.0.1");
  }`,
  "audit hotfix forward-compatible version contract"
);

// 5) Focused regression test.
const test=`"use strict";
const fs=require("fs"),assert=require("node:assert/strict");
const css=fs.readFileSync("android-ui-14.css","utf8");
const e2e=fs.readFileSync("android-ui-14.e2e.test.js","utf8");
const cfg=JSON.parse(fs.readFileSync("android-release-config.json","utf8"));
const audit=fs.readFileSync("audit-hotfix-14.0.1.test.js","utf8");

for(const token of [
  "Life RPG 14.0.2 — device UI hotfix",
  "--life-ui-nav-content-buffer:112px",
  "padding-bottom:calc(var(--life-ui-nav-clearance) + var(--life-ui-nav-content-buffer))!important",
  ".top-actions>.iconbtn",
  "width:48px!important",
  "width:20px!important"
]) assert.ok(css.includes(token),\`14.0.2 UI CSS missing: \${token}\`);

assert.ok(e2e.includes("navTop-24"));
assert.ok(e2e.includes("top action buttons share one visual geometry"));
assert.ok(e2e.includes("14\\\\.0\\\\.2-rc"));
assert.ok(audit.includes("Android targetVersion must be >= 14.0.1"));
assert.equal(cfg.targetVersion,"14.0.2");
assert.equal(cfg.channel,"rc");
assert.equal(cfg.stateVersion,18);

console.log("OK — Life RPG 14.0.2 real-device UI hotfix contract passed");
`;
write("ui-hotfix-14.0.2.test.js",test);

{
  const file="package.json";
  const p=JSON.parse(read(file));
  if(!String(p.scripts?.test||"").includes("ui-hotfix-14.0.2.test.js"))
    p.scripts.test+=" && node ui-hotfix-14.0.2.test.js";
  write(file,JSON.stringify(p,null,2)+"\n");
}

write(marker,`# Life RPG 14.0.2 — Real-device UI Hotfix

Scope: Android UI only. State schema remains v18.

Observed on 14.0.1 RC:
- final content could sit too close to / beneath fixed bottom navigation;
- top action controls had inconsistent icon geometry.

Changes:
- larger Android bottom content clearance;
- stronger scroll padding and scroll margin;
- 48×48 px top action controls;
- 20×20 px vector icon geometry;
- stronger Android UI E2E checks;
- Android RC target 14.0.2;
- previous 14.0.1 audit regression made forward-compatible.
`);

for(const [file,token] of [
  ["android-ui-14.css","--life-ui-nav-content-buffer"],
  ["android-ui-14.e2e.test.js","top action buttons share one visual geometry"],
  ["android-release-config.json",'"targetVersion": "14.0.2"'],
  ["audit-hotfix-14.0.1.test.js","Android targetVersion must be >= 14.0.1"],
  ["ui-hotfix-14.0.2.test.js","14.0.2 real-device UI hotfix contract"]
])assertContains(file,token);

console.log("OK — Life RPG 14.0.2 UI hotfix v2 applied");
