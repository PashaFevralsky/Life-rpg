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
function assertContains(file,token){
  if(!read(file).includes(token)) throw new Error(`${token}: missing in ${file}`);
}

// 1) Android mobile header cleanup after 14.0.2 real-device review.
// Keep only two primary actions on mobile header: search + quick add.
// Hide duplicate header-search/command-palette action and move backup/share out of the top bar.
// Also tighten action geometry so the profile subtitle regains horizontal room.
{
  const file="android-ui-14.css";
  let css=read(file);
  if(css.includes("Life RPG 14.0.3 — mobile header cleanup")) throw new Error("14.0.3 CSS hotfix already present");
  css += `

/* Life RPG 14.0.3 — mobile header cleanup
   Real-device follow-up after 14.0.2 RC:
   limit mobile header to two primary actions and free width for identity text. */
@media(max-width:850px){
  .ui82.ui139 .top-actions{
    gap:10px!important;
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

  /* On mobile we keep the two central primary actions only:
     search + quick-add. The extra search/palette and backup action leave the header. */
  .ui82.ui139 .top-actions>.iconbtn:nth-child(1),
  .ui82.ui139 .top-actions>.iconbtn:nth-child(n+4){
    display:none!important;
  }

  .ui82.ui139 .top-actions>.iconbtn:nth-child(2),
  .ui82.ui139 .top-actions>.iconbtn:nth-child(3){
    display:grid!important;
  }

  .ui82.ui139 .hero :is(.meta,.subtitle,.subline,.sub,.muted,.level-meta,.title-meta,.profile-meta,.identity-meta),
  .ui82.ui139 .hero-head :is(.meta,.subtitle,.subline,.sub,.muted,.level-meta,.title-meta,.profile-meta,.identity-meta),
  .ui82.ui139 .today-hero :is(.meta,.subtitle,.subline,.sub,.muted,.level-meta,.title-meta,.profile-meta,.identity-meta){
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
}
`;
  write(file,css);
}

// 2) Update static Android UI contract to watch the new mobile header rules.
replaceOnce("android-ui-14.test.js",
`  ".top-actions>.iconbtn",
  "width:20px!important"
])`,
`  ".top-actions>.iconbtn",
  "width:20px!important",
  ".top-actions>.iconbtn:nth-child(1)",
  ".top-actions>.iconbtn:nth-child(n+4)",
  "white-space:nowrap"
])`,
"Android UI static hotfix 14.0.3 contract");

// 3) Strengthen mobile E2E for the simplified header.
replaceOnce("android-ui-14.e2e.test.js",
`await expect(page).toHaveTitle(/Life RPG 14\\.0\\.2-rc\\./);`,
`await expect(page).toHaveTitle(/Life RPG 14\\.0\\.3-rc\\./);`,
"Android RC UI title 14.0.3");

{
  const file="android-ui-14.e2e.test.js";
  let e2e=read(file);
  if(e2e.includes('test("Android RC mobile header shows exactly two primary actions"')) throw new Error("14.0.3 mobile-header E2E already present");
  e2e += `

test("Android RC mobile header shows exactly two primary actions",async({page})=>{
  const errors=await boot(page,390,844);
  const actions=await page.locator(".top-actions>.iconbtn").evaluateAll(nodes=>nodes
    .filter(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return !el.hidden&&s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0;
    })
    .map(el=>{
      const r=el.getBoundingClientRect();
      return {width:r.width,height:r.height,text:(el.getAttribute("aria-label")||el.textContent||"").trim()};
    }));
  expect(actions.length,"mobile header should expose only two primary actions").toBe(2);
  for(const a of actions){
    expect(a.width,"header action width").toBeGreaterThanOrEqual(47);
    expect(a.width,"header action width").toBeLessThanOrEqual(49);
    expect(a.height,"header action height").toBeGreaterThanOrEqual(47);
    expect(a.height,"header action height").toBeLessThanOrEqual(49);
  }
  expect(errors).toEqual([]);
});
`;
  write(file,e2e);
}

// 4) Bump Android RC target to 14.0.3. State schema remains unchanged.
{
  const file="android-release-config.json";
  const c=JSON.parse(read(file));
  if(c.targetVersion!=="14.0.2"||c.channel!=="rc")
    throw new Error(`Expected 14.0.2/rc, got ${c.targetVersion}/${c.channel}`);
  c.targetVersion="14.0.3";
  c.notes="Android 14.0.3 RC: mobile header cleanup with two primary actions and improved title-line space.";
  write(file,JSON.stringify(c,null,2)+"\n");
}

replaceOnce("release-readiness-14.0.test.js",
`assert.equal(cfg.targetVersion,"14.0.2");`,
`assert.equal(cfg.targetVersion,"14.0.3");`,
"readiness targetVersion 14.0.3");

replaceOnce("android-release-gate.test.js",
`assert.equal(cfg.targetVersion,"14.0.2");`,
`assert.equal(cfg.targetVersion,"14.0.3");`,
"release gate targetVersion 14.0.3");

replaceOnce("android-release-gate.test.js",
`assert.match(meta.versionName,/^14\\.0\\.2-rc\\.\\d+$/);
assert.ok(meta.versionCode>14000116,"14.0.2 RC must update over installed 14.0.1 RC run 16");`,
`assert.match(meta.versionName,/^14\\.0\\.3-rc\\.\\d+$/);
assert.ok(meta.versionCode>14000217,"14.0.3 RC must update over installed 14.0.2 RC run 17");`,
"release gate version line 14.0.3");

// 5) Focused regression contract.
const test=`"use strict";
const fs=require("fs"),assert=require("node:assert/strict");
const css=fs.readFileSync("android-ui-14.css","utf8");
const e2e=fs.readFileSync("android-ui-14.e2e.test.js","utf8");
const cfg=JSON.parse(fs.readFileSync("android-release-config.json","utf8"));

for(const token of [
  "Life RPG 14.0.3 — mobile header cleanup",
  ".top-actions>.iconbtn:nth-child(1)",
  ".top-actions>.iconbtn:nth-child(n+4)",
  "white-space:nowrap",
  "display:none!important"
]) assert.ok(css.includes(token),\`14.0.3 UI CSS missing: \${token}\`);

assert.ok(e2e.includes("mobile header should expose only two primary actions"));
assert.ok(e2e.includes("14\\\\.0\\\\.3-rc"));
assert.equal(cfg.targetVersion,"14.0.3");
assert.equal(cfg.channel,"rc");
assert.equal(cfg.stateVersion,18);

console.log("OK — Life RPG 14.0.3 mobile-header UI hotfix contract passed");
`;
write("ui-hotfix-14.0.3.test.js",test);

{
  const file="package.json";
  const p=JSON.parse(read(file));
  if(!String(p.scripts?.test||"").includes("ui-hotfix-14.0.3.test.js"))
    p.scripts.test+=" && node ui-hotfix-14.0.3.test.js";
  write(file,JSON.stringify(p,null,2)+"\n");
}

write(marker,`# Life RPG 14.0.3 — Mobile Header Cleanup

Scope: Android UI only. State schema remains v18.

Observed on 14.0.2 RC:
- top header still looked crowded;
- four action buttons consumed too much width;
- duplicate search/palette presence hurt clarity;
- profile subtitle lost horizontal room.

Changes:
- mobile header limited to two primary actions;
- duplicate mobile top-bar search/palette action hidden;
- mobile top-bar backup/share action hidden from header;
- 48×48 action geometry preserved;
- profile subtitle area gets more room via nowrap/ellipsis handling;
- Android RC target bumped to 14.0.3.
`);

for(const [file,token] of [
  ["android-ui-14.css","Life RPG 14.0.3 — mobile header cleanup"],
  ["android-ui-14.e2e.test.js","Android RC mobile header shows exactly two primary actions"],
  ["android-release-config.json",'"targetVersion": "14.0.3"'],
  ["ui-hotfix-14.0.3.test.js","14.0.3 mobile-header UI hotfix contract"]
]) assertContains(file,token);

console.log("OK — Life RPG 14.0.3 UI hotfix applied");
