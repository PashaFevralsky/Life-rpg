"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
const ui=read("ui.js"),ux=read("ux-12.8.js"),training=read("training-os.js"),share=read("share-hub.js"),css=read("interface-13.9.css"),e2e=read("android-ui-14.e2e.test.js"),trainingE2e=read("training-12.9.e2e.test.js"),prev=read("ui-hotfix-14.0.3.test.js"),pkg=JSON.parse(read("package.json")),cfg=JSON.parse(read("android-release-config.json"));

for(const token of ["function prepareModalAccessibility","aria-modal","aria-labelledby","function ux7BindTabKeyboard","ArrowRight","ArrowLeft","aria-controls","tabIndex=on?0:-1",'data-ui139-action="recent"'])
  assert.ok(ui.includes(token),`14.0.4 UI accessibility token missing: ${token}`);

assert.ok(ux.includes('ux128QuickButton("task","Задача"'),"Quick Add task action missing");
for(const action of ["inbox","recent","search","import"])assert.ok(!ux.includes(`ux128QuickButton("${action}"`),`service action ${action} leaked into Quick Add`);
assert.ok(!ui.includes("Можно потратить?</span></button>"),"decision action must not remain in Quick Add");
assert.ok(training.includes("function training129PatchQuick(){}"),"Training OS must not inject Quick Add action");
assert.ok(share.includes("function share131PatchQuickSheet(){}"),"Share Hub must not inject Quick Add action");
assert.ok(!training.includes("data-training129-action"),"Training OS Quick Add marker must be removed");
assert.ok(!share.includes("data-share131-action"),"Share Hub Quick Add marker must be removed");
assert.ok(trainingE2e.includes("reachable from Life OS and More"),"Training E2E must cover the retained navigation path");

const m=css.match(/\.ui82\.ui139 \.navbtn\{[\s\S]*?color:(#[0-9a-f]{6})/i);assert.ok(m,"bottom nav color not found");
function rgb(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)}
function lum(h){const f=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4,[r,g,b]=rgb(h).map(f);return .2126*r+.7152*g+.0722*b}
function contrast(a,b){const x=lum(a),y=lum(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+.05)/(lo+.05)}
assert.ok(contrast(m[1],"#0f1218")>=4.5,`bottom-nav contrast below AA: ${contrast(m[1],"#0f1218")}`);

assert.ok(e2e.includes("dynamic sheets expose dialog semantics"));
assert.ok(e2e.includes("internal tabs use roving keyboard navigation"));
assert.ok(e2e.includes("Quick Add contains eight entry actions only"));
assert.ok(prev.includes("Android targetVersion must be >= 14.0.3"));

const vm=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(cfg.targetVersion||""));
assert.ok(vm,`Invalid Android targetVersion: ${cfg.targetVersion}`);
const versionCode=(+vm[1])*1000000+(+vm[2])*10000+(+vm[3])*100;
assert.ok(versionCode>=14000400,`Android targetVersion must be >= 14.0.4, got ${cfg.targetVersion}`);
assert.equal(cfg.channel,"rc");
assert.equal(cfg.stateVersion,18);
assert.ok(pkg.scripts.test.includes("ui-audit-hotfix-14.0.4.test.js"));

console.log(`OK — Life RPG 14.0.4 audited UI hotfix contract retained for Android ${cfg.targetVersion}`);
