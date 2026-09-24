import {readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const read=p=>readFileSync(p,'utf8');
const write=(p,s)=>writeFileSync(p,s,'utf8');
function replaceOnce(s,from,to,label){
  if(!s.includes(from))throw new Error(`12.0.3 patch: anchor not found — ${label}`);
  return s.replace(from,to);
}
function bump(s){return s.replaceAll('12.0.2','12.0.3')}

// Version metadata. STATE_VERSION intentionally stays 18.
{
  const pkg=JSON.parse(read('package.json'));
  pkg.version='12.0.3';
  if(!pkg.scripts.test.includes('stabilization-12.0.3.test.js'))pkg.scripts.test+=' && node stabilization-12.0.3.test.js';
  write('package.json',JSON.stringify(pkg,null,2)+'\n');

  const lock=JSON.parse(read('package-lock.json'));
  lock.version='12.0.3';
  if(lock.packages?.[''])lock.packages[''].version='12.0.3';
  write('package-lock.json',JSON.stringify(lock,null,2)+'\n');
}

for(const p of ['core.js','index.html','vite.config.mjs','pwa.js','bootstrap.js','mobile-layout.css','ui.js','architecture.test.js','dist-audit.test.js','static-check.js','manifest.webmanifest']){
  write(p,bump(read(p)));
}

// 1) OCR must not block cold boot. Tesseract is loaded only on first OCR action.
{
  let s=read('index.html');
  s=replaceOnce(s,'<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"></script>\n','', 'remove eager Tesseract');
  write('index.html',s);

  let im=read('imports.js');
  const loader=`let financialOcrLoader=null;\nfunction ensureFinancialOcrLoaded(){\n  if(window.Tesseract?.recognize)return Promise.resolve(window.Tesseract);\n  if(financialOcrLoader)return financialOcrLoader;\n  financialOcrLoader=new Promise((resolve,reject)=>{\n    const ready=()=>window.Tesseract?.recognize?resolve(window.Tesseract):reject(new Error("OCR-модуль загрузился некорректно"));\n    const existing=document.querySelector('script[data-life-ocr="tesseract"]');\n    if(existing){existing.addEventListener("load",ready,{once:true});existing.addEventListener("error",()=>reject(new Error("Не удалось загрузить OCR-модуль")),{once:true});return}\n    const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";s.async=true;s.dataset.lifeOcr="tesseract";s.onload=ready;s.onerror=()=>reject(new Error("Не удалось загрузить OCR-модуль"));document.head.appendChild(s)\n  }).catch(e=>{financialOcrLoader=null;throw e});\n  return financialOcrLoader\n}\nasync function loadFinancialOcrOrReport(status){\n  try{if(status)status.textContent="Загружаю OCR-модуль…";await ensureFinancialOcrLoaded();return true}\n  catch(e){if(status)status.innerHTML='<span class="csv-bad">OCR-модуль не загрузился. Нужен интернет.</span>';return false}\n}\n\n`;
  im=replaceOnce(im,'async function runFinancialOcr(file,onProgress=()=>{}){',loader+'async function runFinancialOcr(file,onProgress=()=>{}){\n  await ensureFinancialOcrLoaded();','lazy OCR loader');
  im=replaceOnce(im,'const list=[...files].slice(0,20),status=$("smartInboxStatus");if(!list.length)return;if(!window.Tesseract){status.innerHTML=\'<span class="csv-bad">OCR-модуль не загрузился. Нужен интернет.</span>\';return}',
    'const list=[...files].slice(0,20),status=$("smartInboxStatus");if(!list.length)return;if(!await loadFinancialOcrOrReport(status))return','smart inbox lazy OCR');
  im=replaceOnce(im,'const list=[...files].slice(0,20);if(!list.length)return;if(!window.Tesseract){$("screenshotImportStatus").innerHTML=\'<span class="csv-bad">OCR-модуль не загрузился. Для распознавания нужен интернет.</span>\';return}',
    'const list=[...files].slice(0,20),status=$("screenshotImportStatus");if(!list.length)return;if(!await loadFinancialOcrOrReport(status))return','screenshot lazy OCR');
  im=replaceOnce(im,'if(!file)return;if(!window.Tesseract){$("bankSyncStatus").innerHTML=\'<span class="csv-bad">OCR-модуль не загрузился. Нужен интернет.</span>\';return}const id=selectedBankSyncAccountId()',
    'if(!file)return;const status=$("bankSyncStatus");if(!await loadFinancialOcrOrReport(status))return;const id=selectedBankSyncAccountId()','balance lazy OCR');
  write('imports.js',im);
}

// 2) Start downloading Personal OS runtime files together. async=false on each script keeps execution deterministic.
//    Also avoid re-routing every hidden section after every state render.
{
  let b=read('bootstrap.js');
  b=replaceOnce(b,'if(!window.__LIFE_RPG_MODULES_PRELOADED__)for(const file of LIFE_RPG_RUNTIME_MODULES)await lifeRuntimeLoadScript(file);',
    'if(!window.__LIFE_RPG_MODULES_PRELOADED__)await Promise.all(LIFE_RPG_RUNTIME_MODULES.map(lifeRuntimeLoadScript));','parallel runtime preload');
  b=replaceOnce(b,
    'requestAnimationFrame(()=>{lifeRefreshReleaseLabels();renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();for(const id of Object.keys(UX7_META))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false);window.LifePlatform?.refreshIcons?.();if(typeof dashboardApply==="function")dashboardApply()})',
    'requestAnimationFrame(()=>{lifeRefreshReleaseLabels();renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();const active=document.querySelector(".section.active")?.id||"today";for(const id of Object.keys(UX7_META)){const section=$(id);if(id===active||section?.querySelector(".ux7-card:not(.ux7-view-ready)"))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false)}window.LifePlatform?.refreshIcons?.();if(typeof dashboardApply==="function")dashboardApply()})',
    'incremental view sync');
  write('bootstrap.js',b);

  let ui=read('ui.js');
  ui=replaceOnce(ui,
    'const section=$(sectionId);if(!section)return;const valid=(UX7_META[sectionId]?.tabs||[]).map(x=>x[0]);if(valid.length&&!valid.includes(view))view=UX7_DEFAULTS[sectionId]||valid[0];UX7_PREFS[sectionId]=view;ux7SavePrefs();',
    'const section=$(sectionId);if(!section)return;const valid=(UX7_META[sectionId]?.tabs||[]).map(x=>x[0]);if(valid.length&&!valid.includes(view))view=UX7_DEFAULTS[sectionId]||valid[0];const previous=UX7_PREFS[sectionId];UX7_PREFS[sectionId]=view;if(previous!==view)ux7SavePrefs();',
    'avoid redundant UX preference writes');
  ui=replaceOnce(ui,
    'section.querySelectorAll(".ux7-card").forEach(card=>{const views=(card.dataset.ux7View||"").split(/\\s+/);card.classList.toggle("ux7-hidden",!views.includes(view))});',
    'section.querySelectorAll(".ux7-card").forEach(card=>{const views=(card.dataset.ux7View||"").split(/\\s+/);card.classList.toggle("ux7-hidden",!views.includes(view));card.classList.add("ux7-view-ready")});',
    'mark routed cards');
  write('ui.js',ui);
}

// 3) Safer fresh defaults and imported identifiers. No state migration.
{
  let st=read('state.js');
  st=replaceOnce(st,'campaignStart:"2026-09-19"','campaignStart:localDateKey()','dynamic campaign start');
  st=replaceOnce(st,'function validateStateShape(raw){',
`function isSafeStateId(value){\n  const s=String(value??"");\n  return s.length>0&&s.length<=180&&!/[\\s'"<>\\u0060\\\\]/.test(s)\n}\nfunction validateStateShape(raw){`,'safe state id helper');
  st=replaceOnce(st,
    'for(const x of arr){const id=String(x?.id||"").trim();if(!id)continue;if(seen.has(id))throw new Error(`Дублирующийся ID entities.${key}: ${id}`);seen.add(id)}}};',
    'for(const x of arr){const id=String(x?.id||"").trim();if(!id)continue;if(!isSafeStateId(id))throw new Error(`Небезопасный ID entities.${key}`);if(seen.has(id))throw new Error(`Дублирующийся ID entities.${key}: ${id}`);seen.add(id)}}};',
    'entity id validation');
  st=replaceOnce(st,
    'if(!["bankImportIds","screenshotImportIds"].includes(key)&&raw[key].some(x=>!x||typeof x!=="object"||Array.isArray(x)))throw new Error(`Повреждённая запись в ${key}`)}',
    'if(!["bankImportIds","screenshotImportIds"].includes(key)&&raw[key].some(x=>!x||typeof x!=="object"||Array.isArray(x)))throw new Error(`Повреждённая запись в ${key}`);if(!["bankImportIds","screenshotImportIds"].includes(key))for(const x of raw[key])if(x?.id!=null&&!isSafeStateId(x.id))throw new Error(`Небезопасный ID в ${key}`)}',
    'record id validation');
  st=replaceOnce(st,
    'for(const x of raw.tennis||[])if(x.matches!=null&&(!Array.isArray(x.matches)||x.matches.some(m=>!m||typeof m!=="object")))throw new Error("Повреждённый список матчей");',
    'for(const x of raw.tennis||[]){if(x.matches!=null&&(!Array.isArray(x.matches)||x.matches.some(m=>!m||typeof m!=="object")))throw new Error("Повреждённый список матчей");for(const m of x.matches||[])if(m?.id!=null&&!isSafeStateId(m.id))throw new Error("Небезопасный ID матча")}for(const d of raw.debts||[])for(const p of d?.parts||[])if(p?.id!=null&&!isSafeStateId(p.id))throw new Error("Небезопасный ID части долга");',
    'nested id validation');
  write('state.js',st);
}

// 4) One service-worker owner: production dist/sw.js is generated by VitePWA/Workbox.
write('sw.js',`/* Life RPG 12.0.3 — source placeholder only.\n   Production dist/sw.js is generated by VitePWA/Workbox during npm run build.\n   Keep this file inert: it must not register install/fetch/activate handlers. */\n`);

// 5) Regression gates updated for the stabilization architecture.
{
  let a=read('architecture.test.js');
  a=replaceOnce(a,
    "assert.ok(sw.includes('life-rpg-v12.0.3-cleanup'));assert.ok(vite.includes('cacheId:\"life-rpg-12.0.3\"'));assert.ok(sw.includes('cache:\"reload\"'));",
    "assert.ok(vite.includes('cacheId:\"life-rpg-12.0.3\"'));assert.ok(!sw.includes('addEventListener(\"fetch\"')&&!sw.includes(\"addEventListener('fetch'\"),'source sw.js must be inert; Workbox owns production SW');",
    'architecture SW ownership');
  a=replaceOnce(a,
    'assert.ok(workflow.includes(\'node dist-audit.test.js\'));',
    'assert.ok(workflow.includes(\'node dist-audit.test.js\'));assert.ok(!html.includes("tesseract.min.js"));assert.ok(read("imports.js").includes("ensureFinancialOcrLoaded"));assert.ok(bootstrap.includes("Promise.all(LIFE_RPG_RUNTIME_MODULES.map(lifeRuntimeLoadScript))"));assert.ok(read("state.js").includes("function isSafeStateId"));',
    'architecture stabilization gates');
  // The old source SW no longer contains module/cache lists.
  a=a.replace(/assert\.ok\(sw\.includes\('cache:\"reload\"'\)\);/g,'');
  write('architecture.test.js',a);

  let sc=read('static-check.js');
  sc=replaceOnce(sc,
    "assert.ok(sw.includes('life-rpg-v12.0.3-cleanup'),'Wrong source SW cache');assert.ok(vite.includes('cacheId:\"life-rpg-12.0.3\"'),'Generated Workbox cacheId missing');assert.ok(sw.includes('cache:\"reload\"'),'SW install must force fresh shell assets');assert.ok(sw.includes('RUNTIME_VERSION=\"12.0.3\"'),'Wrong SW runtime version');\nfor(const m of runtimeModules)assert.ok(sw.includes(`\"${m}.js\"`),`SW missing ${m}.js`);",
    "assert.ok(vite.includes('cacheId:\"life-rpg-12.0.3\"'),'Generated Workbox cacheId missing');assert.ok(!sw.includes('addEventListener(\"fetch\"')&&!sw.includes(\"addEventListener('fetch'\"),'Source SW must be inert; Workbox owns production SW');",
    'static SW ownership');
  sc=replaceOnce(sc,
    "assert.ok(fs.existsSync(path.join(root,'tennis-huawei.test.js')),'Huawei regression test missing');",
    "assert.ok(!html.includes('tesseract.min.js'),'Tesseract must be lazy-loaded');assert.ok(fs.readFileSync(path.join(root,'imports.js'),'utf8').includes('ensureFinancialOcrLoaded'),'Lazy OCR loader missing');assert.ok(bootstrap.includes('Promise.all(LIFE_RPG_RUNTIME_MODULES.map(lifeRuntimeLoadScript))'),'Runtime files must preload concurrently');assert.ok(state.includes('function isSafeStateId'),'Imported ID validation missing');assert.ok(state.includes('campaignStart:localDateKey()'),'Fresh campaign start must be dynamic');assert.ok(fs.existsSync(path.join(root,'tennis-huawei.test.js')),'Huawei regression test missing');",
    'static stabilization gates');
  write('static-check.js',sc);
}

write('stabilization-12.0.3.test.js',`"use strict";\nconst fs=require("fs"),path=require("path"),assert=require("assert");\nconst root=__dirname,read=n=>fs.readFileSync(path.join(root,n),"utf8");\nconst html=read("index.html"),imports=read("imports.js"),bootstrap=read("bootstrap.js"),state=read("state.js"),vite=read("vite.config.mjs"),core=read("core.js"),sw=read("sw.js"),ui=read("ui.js");\nassert.ok(core.includes('APP_VERSION="12.0.3"'));\nassert.ok(core.includes("STATE_VERSION=18"),"12.0.3 must not migrate user state");\nassert.ok(!html.includes("tesseract.min.js"),"OCR must not block cold boot");\nassert.ok(imports.includes("ensureFinancialOcrLoaded"));\nassert.ok(imports.includes("data-life-ocr"));\nassert.ok(bootstrap.includes("Promise.all(LIFE_RPG_RUNTIME_MODULES.map(lifeRuntimeLoadScript))"));\nassert.ok(bootstrap.includes("ux7-card:not(.ux7-view-ready)"));\nassert.ok(ui.includes('card.classList.add("ux7-view-ready")'));\nassert.ok(state.includes("campaignStart:localDateKey()"));\nassert.ok(state.includes("function isSafeStateId"));\nassert.ok(!sw.includes('addEventListener("fetch"')&&!sw.includes("addEventListener('fetch'"));\nassert.ok(vite.includes('strategies:"generateSW"'));\nassert.ok(vite.includes('cacheId:"life-rpg-12.0.3"'));\nconsole.log("OK — Life RPG 12.0.3 stabilization gates passed");\n`);

write('CHANGELOG-12.0.3.txt',`Life RPG 12.0.3 — Stabilization & Performance\n\n- Tesseract OCR is lazy-loaded only when a bank screenshot is processed.\n- Personal OS runtime files start downloading together while preserving deterministic execution order.\n- View routing no longer rewrites all hidden sections after every state render.\n- Redundant UX preference writes were removed.\n- Production service worker has one owner: VitePWA/Workbox; source sw.js is inert.\n- Imported record/entity IDs with unsafe DOM/action characters are rejected.\n- A fresh financial campaign starts on the actual first-use date instead of a hard-coded September 2026 date.\n- STATE_VERSION remains 18; no user-data migration is required.\n`);

write('README.txt',`Life RPG 12.0.3 — Stabilization & Performance\n\nReplace/update is applied automatically by cleanup-12.0.2.mjs through the existing GitHub Actions migration job.\nSTATE_VERSION remains 18. Existing user data is not migrated.\n\nMain changes: lazy OCR, parallel runtime preload, incremental view sync, safer imported IDs, dynamic fresh campaign date, Workbox-only production service worker.\n`);

// Keep a clean workflow copy in the repository root; .github/workflows is replaced manually after this migration.
write('DEPLOY-PAGES-WORKFLOW.yml',`name: Build and deploy Life RPG\n\non:\n  push:\n    branches: [main]\n  workflow_dispatch:\n\npermissions:\n  contents: read\n  pages: write\n  id-token: write\n\nconcurrency:\n  group: life-rpg-pages\n  cancel-in-progress: true\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm\n      - name: Install dependencies\n        run: npm ci --no-audit --no-fund\n      - name: Run tests\n        run: npm test\n      - name: Build Vite + Workbox PWA\n        run: npm run build\n      - name: Verify production service worker\n        run: node dist-audit.test.js\n      - name: Install Chromium for E2E\n        run: npx playwright install --with-deps chromium\n      - name: Run mobile browser E2E\n        run: npm run test:e2e\n      - name: Configure Pages\n        uses: actions/configure-pages@v5\n      - name: Upload Pages artifact\n        uses: actions/upload-pages-artifact@v3\n        with:\n          path: ./dist\n\n  deploy:\n    needs: build\n    if: needs.build.result == 'success'\n    environment:\n      name: github-pages\n      url: \${{ steps.deployment.outputs.page_url }}\n    runs-on: ubuntu-latest\n    steps:\n      - name: Deploy to GitHub Pages\n        id: deployment\n        uses: actions/deploy-pages@v4\n`);

// The existing migration job commits this deletion together with all changes, so the patch runs exactly once.
const self=fileURLToPath(import.meta.url);
if(existsSync(self))rmSync(self);
console.log('Life RPG 12.0.3 patch applied; cleanup script removed itself.');
