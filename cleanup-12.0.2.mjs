import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=process.cwd();
const VERSION="12.0.2";
const STATE_VERSION=18;

const p=file=>path.join(ROOT,file);
const read=file=>{
  if(!fs.existsSync(p(file)))throw new Error(`Missing required file: ${file}`);
  return fs.readFileSync(p(file),"utf8")
};
const write=(file,content)=>{
  fs.mkdirSync(path.dirname(p(file)),{recursive:true});
  fs.writeFileSync(p(file),content.endsWith("\n")?content:content+"\n","utf8")
};
const replaceRequired=(file,from,to)=>{
  let s=read(file);
  if(!s.includes(from)){
    if(s.includes(to))return false;
    throw new Error(`${file}: expected text not found: ${String(from).slice(0,100)}`)
  }
  write(file,s.split(from).join(to));
  return true
};
const replaceOptional=(file,from,to)=>{
  if(!fs.existsSync(p(file)))return false;
  const s=read(file);if(!s.includes(from))return false;
  write(file,s.split(from).join(to));return true
};
const putIfMissing=(file,marker,insertBefore,block)=>{
  let s=read(file);if(s.includes(marker))return false;
  if(!s.includes(insertBefore))throw new Error(`${file}: insertion anchor not found`);
  s=s.replace(insertBefore,block+insertBefore);write(file,s);return true
};

console.log(`Life RPG ${VERSION} cleanup: start`);

// 1) Canonical release version. State schema intentionally remains v18.
replaceRequired("core.js",'/* Life RPG 12.0.1 — Core utilities and constants */',`/* Life RPG ${VERSION} — Core utilities and constants */`);
replaceRequired("core.js",'const APP_VERSION="12.0.1";',`const APP_VERSION="${VERSION}";`);

let sw=read("sw.js");
sw=sw.replace('life-rpg-v12.0.1-refactor',`life-rpg-v${VERSION}-cleanup`)
     .replaceAll('12.0.1',VERSION)
     .replace('"knowledge-growth.js","tennis-growth.js","rpg-growth.js"', '"knowledge-growth.js","tennis-growth.js","tennis-huawei.js","rpg-growth.js"');
if(!sw.includes('"tennis-huawei.js"'))throw new Error("sw.js: tennis-huawei.js was not registered");
write("sw.js",sw);

replaceRequired("manifest.webmanifest","12.0.1",VERSION);
replaceRequired("index.html","11.1.1",VERSION);

let vite=read("vite.config.mjs").replaceAll("12.0.1",VERSION);
if(!vite.includes('"tennis-huawei.js"'))throw new Error("vite.config.mjs: tennis-huawei.js missing from classicRuntime");
write("vite.config.mjs",vite);

// Remove the old runtime text-rewrite compatibility hack now that index.html is canonical.
let bootstrap=read("bootstrap.js").replace("/* Life RPG 12.0.1 — modular runtime bootstrap + Growth OS + Personal OS */",`/* Life RPG ${VERSION} — modular runtime bootstrap + Growth OS + Personal OS */`);
const oldRefresh=`function lifeRefreshReleaseLabels(){
  document.title=\`Life RPG \${APP_VERSION}\`;
  window.__LIFE_RPG_HTML_VERSION__=APP_VERSION;
  try{
    const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];let n;
    while((n=w.nextNode()))if(n.nodeValue?.includes("11.1.1"))nodes.push(n);
    for(const x of nodes)x.nodeValue=x.nodeValue.replaceAll("11.1.1",APP_VERSION)
  }catch{}
}`;
const newRefresh=`function lifeRefreshReleaseLabels(){
  document.title=\`Life RPG \${APP_VERSION}\`;
  window.__LIFE_RPG_HTML_VERSION__=APP_VERSION
}`;
if(bootstrap.includes(oldRefresh))bootstrap=bootstrap.replace(oldRefresh,newRefresh);
else if(!bootstrap.includes(newRefresh))throw new Error("bootstrap.js: legacy release-label block not found");
write("bootstrap.js",bootstrap);

// 2) npm metadata and deterministic install.
const pkg=JSON.parse(read("package.json"));
pkg.version=VERSION;
if(!pkg.scripts?.test)throw new Error("package.json: test script missing");
if(!pkg.scripts.test.includes("tennis-huawei.test.js"))pkg.scripts.test+=" && node tennis-huawei.test.js";
write("package.json",JSON.stringify(pkg,null,2));

const lock=JSON.parse(read("package-lock.json"));
lock.version=VERSION;
if(!lock.packages?.[""])throw new Error("package-lock.json: root package block missing");
lock.packages[""].version=VERSION;
write("package-lock.json",JSON.stringify(lock,null,2));

// 3) Static/architecture gates know about Huawei and the cleanup contract.
let staticCheck=read("static-check.js");
staticCheck=staticCheck.replace(
  "const growthModules=['tracking-os','knowledge-growth','tennis-growth','rpg-growth'];",
  "const growthModules=['tracking-os','knowledge-growth','tennis-growth','tennis-huawei','rpg-growth'];"
);
staticCheck=staticCheck.replace('life-rpg-v12.0.1-refactor',`life-rpg-v${VERSION}-cleanup`).replaceAll("12.0.1",VERSION);
staticCheck=staticCheck.replace("Legacy HTML shell reconciliation missing","Release label sync missing");
const staticBlock=`const packageLock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));assert.equal(packageLock.version,'${VERSION}','package-lock version drift');assert.equal(packageLock.packages?.['']?.version,'${VERSION}','package-lock root version drift');
const deployWorkflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-pages.yml'),'utf8');assert.ok(deployWorkflow.includes('npm ci --no-audit --no-fund'),'CI must use npm ci');assert.ok(!html.includes('11.1.1'),'Legacy HTML version remains');assert.ok(html.includes('?v=${VERSION}'),'HTML asset version missing');
assert.ok(fs.existsSync(path.join(root,'tennis-huawei.test.js')),'Huawei regression test missing');assert.ok(fs.existsSync(path.join(root,'layout-all.e2e.test.js')),'Full layout E2E missing');assert.ok(fs.readFileSync(path.join(root,'playwright.config.mjs'),'utf8').includes('layout-all.e2e.test.js'),'Full layout E2E not configured');assert.ok(require('./package.json').scripts.test.includes('tennis-huawei.test.js'),'Huawei test not in npm test');
`;
if(!staticCheck.includes("package-lock version drift")){
  const anchor=`console.log(\`OK — static checks passed for Life RPG ${VERSION} refactor: \${names.length} unique functions, \${runtimeModules.length} runtime modules\`);`;
  if(!staticCheck.includes(anchor))throw new Error("static-check.js: console anchor missing");
  staticCheck=staticCheck.replace(anchor,staticBlock+anchor);
}
write("static-check.js",staticCheck);

let arch=read("architecture.test.js");
arch=arch.replaceAll("12.0.1",VERSION).replace(`life-rpg-v${VERSION}-refactor`,`life-rpg-v${VERSION}-cleanup`);
arch=arch.replace('"knowledge-growth.js","tennis-growth.js","rpg-growth.js"', '"knowledge-growth.js","tennis-growth.js","tennis-huawei.js","rpg-growth.js"');
if(!arch.includes('const lock=JSON.parse(read("package-lock.json"))')){
  arch=arch.replace(
    /(const pkg=JSON\.parse\(read\("package\.json"\)\).*?;\n)/,
    `$1const lock=JSON.parse(read("package-lock.json"));\n`
  );
}
if(!arch.includes("package-lock root version mismatch")){
  const marker=`assert.equal(pkg.version,"${VERSION}");`;
  if(!arch.includes(marker))throw new Error("architecture.test.js: package version assertion missing");
  arch=arch.replace(marker,`${marker}assert.equal(lock.version,"${VERSION}");assert.equal(lock.packages?.[""]?.version,"${VERSION}","package-lock root version mismatch");`);
}
arch=arch.replace(
  "assert.ok(workflow.includes('npm run build'));",
  "assert.ok(workflow.includes('npm ci --no-audit --no-fund'));assert.ok(workflow.includes('npm run build'));"
);
arch=arch.replace(
  "assert.ok(html.includes(\"life-rpg-booting\"));",
  `assert.ok(html.includes("life-rpg-booting"));assert.ok(!html.includes("11.1.1"));assert.ok(playwright.includes("layout-all.e2e.test.js"));assert.ok(pkg.scripts.test.includes("tennis-huawei.test.js"));`
);
write("architecture.test.js",arch);

for(const file of ["dist-audit.test.js","e2e.test.js","personal-os.e2e.test.js","personal-os.test.js"]){
  if(fs.existsSync(p(file)))write(file,read(file).replaceAll("12.0.1",VERSION))
}
replaceOptional("mobile-layout.test.js","11.1.1",VERSION);

// Cosmetic test/source labels: no domain behavior change.
for(const file of [
  "regression.test.js","operational.test.js","final-audit.test.js","reading-list.test.js",
  "visual-layout.test.js","visual-system.test.js","money-core.test.js","domain-deep.test.js",
  "render-smoke.test.js","platform.js","pwa.js","styles.css"
]){
  replaceOptional(file,"10.0.2",VERSION)
}
replaceOptional("mobile-layout.css","11.1.1",VERSION);
replaceOptional("README-TENNIS-HUAWEI.txt","APP_VERSION remains 12.0.1","APP_VERSION is 12.0.2");
replaceOptional("README-TENNIS-HUAWEI.txt","STATE_VERSION remains 18","STATE_VERSION remains 18");

// 4) Huawei parser regression test.
const huaweiTest=`"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert");
const source=fs.readFileSync(require("path").join(__dirname,"tennis-huawei.js"),"utf8");
const sandbox={
  console,window:{},
  document:{readyState:"loading",addEventListener(){},getElementById(){return null},querySelector(){return null}},
  Number,Math,Date,String,Object,Array,Set,Map,Promise,
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
  validDateKey:s=>/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(String(s||"")),
  growthData:()=>({tennisWearables:[]}),
  S:{tennis:[]}
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);vm.runInContext(source,sandbox);

const sample=\`HUAWEI WATCH FIT 4 Pro
настольный теннис
23.09.2026, 20:08
1 730 ккал
Расход калорий при нагрузке
1 567 ккал
Длительность
01:39:20
Средний пульс
179 уд/мин
Максимум
196
Экстрим 75 мин
Анаэробный 21 мин
Аэробная 1 мин
Сжигание жира 0 мин
Разминка <1 мин
Стресс от аэробной тренировки
4,7
Стресс от анаэробной тренировки
5,0
Время на восстановление
75 ч
Начало/Конец
151/144\`;

const x=JSON.parse(JSON.stringify(sandbox.tennisHuaweiParseText(sample)));
assert.equal(x.dateKey,"2026-09-23");
assert.equal(x.durationSec,5960);
assert.equal(x.totalCalories,1730);assert.equal(x.activeCalories,1567);
assert.equal(x.avgHr,179);assert.equal(x.maxHr,196);
assert.equal(x.extremeMin,75);assert.equal(x.anaerobicMin,21);assert.equal(x.aerobicMin,1);
assert.equal(x.fatBurnMin,0);assert.equal(x.warmupMin,0.5);
assert.equal(x.aerobicEffect,4.7);assert.equal(x.anaerobicEffect,5);
assert.equal(x.recoveryHours,75);assert.equal(x.recoveryStartHr,151);assert.equal(x.recoveryEndHr,144);
assert.equal(sandbox.tennisHuaweiDurationToSec("01:39:20"),5960);
assert.equal(sandbox.tennisHuaweiValidate({...x,avgHr:197,maxHr:196}),"Средний пульс не может быть выше максимального");
assert.equal(sandbox.tennisHuaweiValidate({...x,totalCalories:1000,activeCalories:1200}),"Активные ккал не могут быть выше общих");
assert.ok(source.includes('T.recognize(file,"rus+eng"'),"Huawei OCR language contract missing");
assert.ok(source.includes("tennisWearables"),"Structured wearable store missing");
assert.ok(!/FileReader|readAsDataURL|base64/i.test(source),"Screenshot bytes must not be persisted");
console.log("OK — Life RPG ${VERSION} Huawei tennis regression tests passed");
`;
write("tennis-huawei.test.js",huaweiTest);

// 5) Full browser layout gate over every app subview at common phone widths.
const layoutTest=`import { test, expect } from "@playwright/test";

const widths=[360,390,412,430];
const views={
  today:["focus","progress"],
  finance:["overview","operations","bank","debts","analysis","more"],
  work:["overview","crm","log"],
  tennis:["overview","training","analytics"],
  more:["overview","knowledge","rewards","settings"]
};

async function boot(page,width){
  await page.setViewportSize({width,height:900});
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  return errors
}
async function inspect(page){
  return page.evaluate(()=>{
    const visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0};
    const vw=document.documentElement.clientWidth;
    const bodyOverflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-vw;
    const bad=[...document.querySelectorAll(".section.active .card,.section.active .btn,.section.active input,.section.active select,.section.active textarea,.bottom")]
      .filter(visible).map(el=>{const r=el.getBoundingClientRect();return {el,left:r.left,right:r.right,width:r.width}})
      .filter(x=>x.left<-1||x.right>vw+1)
      .map(x=>({tag:x.el.tagName,id:x.el.id||"",className:String(x.el.className||""),left:Math.round(x.left),right:Math.round(x.right),width:Math.round(x.width),text:String(x.el.textContent||"").trim().slice(0,80)}));
    const bottom=document.querySelector(".bottom"),shell=document.querySelector(".shell"),br=bottom?.getBoundingClientRect();
    const safe=bottom&&shell?(parseFloat(getComputedStyle(shell).paddingBottom)||0)-(br?.height||0):999;
    return {vw,bodyOverflow,bad,safe,bottom:br?{left:br.left,right:br.right,bottom:br.bottom}:null}
  })
}

for(const width of widths){
  test(\`all views fit \${width}px viewport\`,async({page})=>{
    const errors=await boot(page,width);
    for(const [section,list] of Object.entries(views)){
      for(const view of list){
        await page.evaluate(([s,v])=>{switchTab(s);ux7SetView(s,v,false)},[section,view]);
        await page.waitForTimeout(25);
        const g=await inspect(page);
        expect(g.bodyOverflow,\`\${section}/\${view}: body overflow \${g.bodyOverflow}px\`).toBeLessThanOrEqual(1);
        expect(g.bad,\`\${section}/\${view}: controls/cards outside viewport\`).toEqual([]);
        expect(g.safe,\`\${section}/\${view}: bottom safe area\`).toBeGreaterThanOrEqual(28);
        expect(g.bottom?.left??0,\`\${section}/\${view}: bottom nav left\`).toBeGreaterThanOrEqual(-1);
        expect(g.bottom?.right??width,\`\${section}/\${view}: bottom nav right\`).toBeLessThanOrEqual(width+1)
      }
    }
    if(width===360){
      for(const id of ["expenseModal","incomeModal","paymentModal","readingModal","bookModal","transferModal","syncModal","envelopeModal","encryptedBackupModal"]){
        if(!(await page.locator("#"+id).count()))continue;
        await page.evaluate(id=>openModal(id),id);await page.waitForTimeout(20);
        const m=await page.locator("#"+id+" .modal-card").boundingBox();
        expect(m,\`\${id} missing modal card\`).not.toBeNull();
        expect(m.x,\`\${id} left\`).toBeGreaterThanOrEqual(-1);
        expect(m.x+m.width,\`\${id} right\`).toBeLessThanOrEqual(width+1);
        expect(m.height,\`\${id} height\`).toBeLessThanOrEqual(900);
        await page.evaluate(id=>closeModal(id),id)
      }
    }
    expect(errors).toEqual([])
  })
}
`;
write("layout-all.e2e.test.js",layoutTest);

let pw=read("playwright.config.mjs");
pw=pw.replace(
  'testMatch:["e2e.test.js","personal-os.e2e.test.js"]',
  'testMatch:["e2e.test.js","personal-os.e2e.test.js","layout-all.e2e.test.js"]'
);
if(!pw.includes("layout-all.e2e.test.js"))throw new Error("playwright.config.mjs: layout test registration failed");
write("playwright.config.mjs",pw);

// Extra generic mobile containment guard. Does not change desktop geometry.
let mobile=read("mobile-layout.css");
const guard=`
/* 12.0.2 generic mobile containment gate */
@media(max-width:600px){
  .ui82 .card,.ui82 .formgrid,.ui82 .report-grid,.ui82 .split{min-width:0;max-width:100%}
  .ui82 .split>select,.ui82 .split>input,.ui82 .split>textarea{min-width:0;max-width:100%}
  .ui82 pre{max-width:100%;overflow:auto}
}
`;
if(!mobile.includes("12.0.2 generic mobile containment gate"))mobile+=guard;
write("mobile-layout.css",mobile);

// 6) Canonical CI after migration.
const finalWorkflow=`name: Build and deploy Life RPG

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci --no-audit --no-fund

      - name: Run tests
        run: npm test

      - name: Build Vite + Workbox PWA
        run: npm run build

      - name: Verify production service worker
        run: node dist-audit.test.js

      - name: Install Chromium for E2E
        run: npx playwright install --with-deps chromium

      - name: Run mobile browser E2E
        run: npm run test:e2e

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
write(".github/workflows/deploy-pages.yml",finalWorkflow);
write("DEPLOY-PAGES-WORKFLOW.yml",finalWorkflow);

// 7) Release docs.
write("README.md",`# Life RPG ${VERSION}

Local-first Personal OS / PWA.

Current release: ${VERSION}. State schema: v${STATE_VERSION}.

Release gate:
- npm ci
- static + regression + domain tests
- Huawei Tennis parser regression test
- Vite + Workbox production build
- production service-worker audit
- Chromium mobile E2E
- complete layout pass at 360 / 390 / 412 / 430 px
`);

write("CHANGELOG-12.0.2.txt",`Life RPG ${VERSION} — Cleanup

- Unified active release/version labels at ${VERSION}.
- STATE_VERSION remains ${STATE_VERSION}; no state migration.
- package.json and package-lock.json synchronized.
- CI switched from npm install to reproducible npm ci.
- Removed the 11.1.1 runtime text-rewrite compatibility hack.
- Huawei Tennis OCR/parser added to static/runtime contracts with a dedicated regression test.
- Full browser layout gate added for every main subview at 360, 390, 412 and 430 px.
- Added generic mobile containment rules for forms, controls, cards and preformatted OCR text.
- Existing finance/work/personal/tennis business logic was not changed.
`);

write("RELEASE-MANIFEST-12.0.2.json",JSON.stringify({
  version:VERSION,stateVersion:STATE_VERSION,type:"cleanup",
  changes:["version-unification","package-lock-sync","npm-ci","huawei-regression-gate","full-mobile-layout-e2e"],
  preserves:["state-v18","finance-logic","work-logic","tennis-domain-logic","local-first-storage"]
},null,2));

// Final consistency checks before self-removal.
const finalPkg=JSON.parse(read("package.json")),finalLock=JSON.parse(read("package-lock.json"));
if(finalPkg.version!==VERSION||finalLock.version!==VERSION||finalLock.packages[""].version!==VERSION)throw new Error("Version metadata did not converge");
if(!read("index.html").includes(`?v=${VERSION}`)||read("index.html").includes("11.1.1"))throw new Error("index.html version drift remains");
if(!read("sw.js").includes(`life-rpg-v${VERSION}-cleanup`)||!read("sw.js").includes('"tennis-huawei.js"'))throw new Error("sw.js cleanup contract failed");
if(!read(".github/workflows/deploy-pages.yml").includes("npm ci --no-audit --no-fund"))throw new Error("Final workflow is not deterministic");

console.log(`Life RPG ${VERSION} cleanup: complete`);

// The migration helper removes itself. The workflow commits the resulting clean tree.
const self=fileURLToPath(import.meta.url);
if(fs.existsSync(self))fs.unlinkSync(self);
