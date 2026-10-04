import fs from "node:fs";

const marker="UI-HOTFIX-14.0.3.md";
if(fs.existsSync(marker)) throw new Error("UI hotfix 14.0.3 is already applied");

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
function assertContains(file,token,label=token){
  if(!read(file).includes(token)) throw new Error(`${label}: missing in ${file}`);
}

// 1) Add a real header Quick Add action that opens the existing Quick Sheet.
//    The old visible "+" was installBtn (PWA install), not data entry.
replaceOnce(
  "ui.js",
  `  const fab=document.createElement("button");fab.id="ux7Fab";fab.className="ux7-fab";fab.type="button";fab.setAttribute("aria-label","Добавить");fab.textContent="＋";fab.onclick=()=>openModal("ux7QuickSheet");document.body.appendChild(fab)
}`,
  `  const fab=document.createElement("button");fab.id="ux7Fab";fab.className="ux7-fab";fab.type="button";fab.setAttribute("aria-label","Добавить");fab.textContent="＋";fab.onclick=()=>openModal("ux7QuickSheet");document.body.appendChild(fab)
  const headerAdd=document.createElement("button");headerAdd.id="ux7HeaderQuickAddBtn";headerAdd.className="iconbtn ux7-header-quick-add";headerAdd.type="button";headerAdd.setAttribute("aria-label","Быстрое добавление");headerAdd.innerHTML='<i data-lucide="plus"></i>';headerAdd.onclick=()=>openModal("ux7QuickSheet");document.querySelector(".top-actions")?.appendChild(headerAdd);window.LifePlatform?.refreshIcons?.(headerAdd)
}`,
  "header Quick Add creation"
);

// 2) Android mobile header cleanup using semantic IDs/roles, not nth-child order.
{
  const file="android-ui-14.css";
  let css=read(file);
  if(css.includes("Life RPG 14.0.3 — semantic mobile header cleanup"))
    throw new Error("14.0.3 CSS hotfix already present");

  css += `

/* Life RPG 14.0.3 — semantic mobile header cleanup
   Keep exactly two primary Today-header actions on Android:
   global search + real Quick Add. */
@media(max-width:850px){
  .ui82.ui139 .top{
    gap:12px;
  }
  .ui82.ui139 .profile-mini{
    min-width:0;
    flex:1 1 auto;
  }
  .ui82.ui139 .profile-mini>div:last-child{
    min-width:0;
  }
  .ui82.ui139 .top .profile-mini .sub{
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .ui82.ui139 .top-actions{
    display:flex!important;
    align-items:center;
    gap:10px!important;
    flex:0 0 auto;
  }

  /* Hide duplicate/irrelevant mobile-header actions by identity. */
  .ui82.ui139 .top-actions>#commandPaletteBtn,
  .ui82.ui139 .top-actions>#installBtn,
  .ui82.ui139 .top-actions>button[onclick*="exportBackup"]{
    display:none!important;
  }

  /* Keep only global search + Quick Add in a deterministic order. */
  .ui82.ui139 .top-actions>#ux128SearchBtn,
  .ui82.ui139 .top-actions>#ux7HeaderQuickAddBtn{
    display:grid!important;
    width:48px!important;
    min-width:48px!important;
    max-width:48px!important;
    height:48px!important;
    min-height:48px!important;
    max-height:48px!important;
    padding:0!important;
    place-items:center!important;
  }
  .ui82.ui139 .top-actions>#ux128SearchBtn{order:1}
  .ui82.ui139 .top-actions>#ux7HeaderQuickAddBtn{order:2}

  .ui82.ui139 .top-actions>:is(#ux128SearchBtn,#ux7HeaderQuickAddBtn) :is(svg,i){
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

// 3) Android UI E2E: 14.0.3 title + exactly the intended two actions.
replaceOnce(
  "android-ui-14.e2e.test.js",
  `await expect(page).toHaveTitle(/Life RPG 14\\.0\\.2-rc\\./);`,
  `await expect(page).toHaveTitle(/Life RPG 14\\.0\\.3-rc\\./);`,
  "Android RC UI title 14.0.3"
);

{
  const file="android-ui-14.e2e.test.js";
  let e2e=read(file);
  if(e2e.includes('test("Android RC mobile header exposes search and Quick Add only"'))
    throw new Error("14.0.3 mobile-header E2E already present");

  e2e += `

test("Android RC mobile header exposes search and Quick Add only",async({page})=>{
  const errors=await boot(page,390,844);
  const actions=await page.locator(".top-actions>.iconbtn").evaluateAll(nodes=>nodes
    .filter(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return !el.hidden&&s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0;
    })
    .map(el=>{
      const r=el.getBoundingClientRect(),icon=el.querySelector("svg,i"),ir=icon?.getBoundingClientRect();
      return {
        id:el.id,
        width:r.width,height:r.height,
        iconWidth:ir?.width||0,iconHeight:ir?.height||0
      };
    }));

  expect(actions.map(x=>x.id),"mobile Today header actions").toEqual(["ux128SearchBtn","ux7HeaderQuickAddBtn"]);

  for(const a of actions){
    expect(a.width,"header action width").toBeGreaterThanOrEqual(47);
    expect(a.width,"header action width").toBeLessThanOrEqual(49);
    expect(a.height,"header action height").toBeGreaterThanOrEqual(47);
    expect(a.height,"header action height").toBeLessThanOrEqual(49);
    expect(a.iconWidth,"header icon width").toBeGreaterThanOrEqual(19);
    expect(a.iconWidth,"header icon width").toBeLessThanOrEqual(21);
    expect(a.iconHeight,"header icon height").toBeGreaterThanOrEqual(19);
    expect(a.iconHeight,"header icon height").toBeLessThanOrEqual(21);
  }

  await page.locator("#ux7HeaderQuickAddBtn").click();
  await expect(page.locator("#ux7QuickSheet")).toHaveClass(/open/);
  expect(errors).toEqual([]);
});
`;
  write(file,e2e);
}

// 4) Bump Android RC target to 14.0.3. State schema remains v18.
{
  const file="android-release-config.json";
  const c=JSON.parse(read(file));
  if(c.targetVersion!=="14.0.2"||c.channel!=="rc")
    throw new Error(`Expected 14.0.2/rc, got ${c.targetVersion}/${c.channel}`);
  c.targetVersion="14.0.3";
  c.notes="Android 14.0.3 RC: semantic mobile header cleanup with global search and real Quick Add only.";
  write(file,JSON.stringify(c,null,2)+"\n");
}

replaceOnce(
  "release-readiness-14.0.test.js",
  `assert.equal(cfg.targetVersion,"14.0.2");`,
  `assert.equal(cfg.targetVersion,"14.0.3");`,
  "readiness targetVersion 14.0.3"
);

replaceOnce(
  "android-release-gate.test.js",
  `assert.equal(cfg.targetVersion,"14.0.2");`,
  `assert.equal(cfg.targetVersion,"14.0.3");`,
  "release gate targetVersion 14.0.3"
);

replaceOnce(
  "android-release-gate.test.js",
  `assert.match(meta.versionName,/^14\\.0\\.2-rc\\.\\d+$/);
assert.ok(meta.versionCode>14000116,"14.0.2 RC must update over installed 14.0.1 RC run 16");`,
  `assert.match(meta.versionName,/^14\\.0\\.3-rc\\.\\d+$/);
assert.ok(meta.versionCode>14000217,"14.0.3 RC must update over installed 14.0.2 RC run 17");`,
  "release gate version line 14.0.3"
);

// 5) Make the previous 14.0.2 UI regression forward-compatible.
//    It must continue to verify 14.0.2 fixes without pinning all later releases to 14.0.2.
replaceOnce(
  "ui-hotfix-14.0.2.test.js",
  `assert.ok(e2e.includes("14\\\\.0\\\\.2-rc"));
assert.ok(audit.includes("Android targetVersion must be >= 14.0.1"));
assert.equal(cfg.targetVersion,"14.0.2");`,
  `assert.ok(audit.includes("Android targetVersion must be >= 14.0.1"));
{
  const v=String(cfg.targetVersion||"").split(".").map(Number);
  assert.ok(v.length===3&&v.every(Number.isInteger)&&(v[0]>14||(v[0]===14&&(v[1]>0||(v[1]===0&&v[2]>=2)))),"Android targetVersion must be >= 14.0.2");
}`,
  "14.0.2 UI regression forward-compatible version contract"
);

// 6) Focused 14.0.3 regression contract.
const test=`"use strict";
const fs=require("fs"),assert=require("node:assert/strict");
const css=fs.readFileSync("android-ui-14.css","utf8");
const e2e=fs.readFileSync("android-ui-14.e2e.test.js","utf8");
const ui=fs.readFileSync("ui.js","utf8");
const prev=fs.readFileSync("ui-hotfix-14.0.2.test.js","utf8");
const cfg=JSON.parse(fs.readFileSync("android-release-config.json","utf8"));

for(const token of [
  "Life RPG 14.0.3 — semantic mobile header cleanup",
  ".top-actions>#commandPaletteBtn",
  ".top-actions>#installBtn",
  'button[onclick*="exportBackup"]',
  ".top-actions>#ux128SearchBtn",
  ".top-actions>#ux7HeaderQuickAddBtn"
]) assert.ok(css.includes(token),\`14.0.3 CSS missing: \${token}\`);

for(const token of [
  'headerAdd.id="ux7HeaderQuickAddBtn"',
  'headerAdd.setAttribute("aria-label","Быстрое добавление")',
  'headerAdd.onclick=()=>openModal("ux7QuickSheet")'
]) assert.ok(ui.includes(token),\`14.0.3 ui.js missing: \${token}\`);

assert.ok(e2e.includes('mobile header exposes search and Quick Add only'));
assert.ok(e2e.includes('["ux128SearchBtn","ux7HeaderQuickAddBtn"]'));
assert.ok(e2e.includes("14\\\\.0\\\\.3-rc"));
assert.ok(prev.includes("Android targetVersion must be >= 14.0.2"));
assert.equal(cfg.targetVersion,"14.0.3");
assert.equal(cfg.channel,"rc");
assert.equal(cfg.stateVersion,18);

console.log("OK — Life RPG 14.0.3 semantic mobile-header hotfix contract passed");
`;
write("ui-hotfix-14.0.3.test.js",test);

{
  const file="package.json";
  const p=JSON.parse(read(file));
  if(!String(p.scripts?.test||"").includes("ui-hotfix-14.0.3.test.js"))
    p.scripts.test+=" && node ui-hotfix-14.0.3.test.js";
  write(file,JSON.stringify(p,null,2)+"\n");
}

write(marker,`# Life RPG 14.0.3 — Semantic Mobile Header Cleanup

Scope: Android UI only. State schema remains v18.

Observed on 14.0.2 RC:
- four top-bar actions crowded the identity block;
- Command Palette and Global Search duplicated search intent;
- the visible plus was installBtn (PWA install), not Quick Add;
- backup already exists under More / Settings.

Changes:
- keep Global Search (#ux128SearchBtn);
- add real Quick Add (#ux7HeaderQuickAddBtn) opening the existing Quick Sheet;
- hide Command Palette button from Android Today header;
- hide PWA install button from Android Today header;
- hide top-bar backup button on Android; backup remains in More / Settings;
- preserve 48×48 controls with 20×20 icons;
- give profile subtitle more horizontal room;
- Android RC target bumped to 14.0.3;
- previous 14.0.2 regression made forward-compatible.
`);

for(const [file,token] of [
  ["ui.js",'headerAdd.id="ux7HeaderQuickAddBtn"'],
  ["android-ui-14.css","Life RPG 14.0.3 — semantic mobile header cleanup"],
  ["android-ui-14.e2e.test.js","Android RC mobile header exposes search and Quick Add only"],
  ["android-release-config.json",'"targetVersion": "14.0.3"'],
  ["ui-hotfix-14.0.2.test.js","Android targetVersion must be >= 14.0.2"],
  ["ui-hotfix-14.0.3.test.js","14.0.3 semantic mobile-header hotfix contract"]
]) assertContains(file,token);

console.log("OK — Life RPG 14.0.3 UI hotfix v2 applied");
