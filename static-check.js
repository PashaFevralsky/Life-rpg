"use strict";
const fs=require("fs"),path=require("path"),cp=require("child_process"),assert=require("assert");
const root=__dirname,read=n=>fs.readFileSync(path.join(root,n),"utf8");
const RELEASE="12.5.0",SHELL_ANCHOR="12.0.3";
const baseModules=["core.js","state.js","finance.js","imports.js","work.js","tennis.js","knowledge.js","gamification.js","pwa.js","ui.js"];
const bootstrap=read("bootstrap.js"),registry=bootstrap.match(/const\s+LIFE_RPG_RUNTIME_MODULES\s*=\s*\[(.*?)\];/s);
assert.ok(registry,"Runtime registry not found in bootstrap.js");
const runtimeFiles=[...registry[1].matchAll(/"([^"]+\.js)"/g)].map(m=>m[1]);
assert.ok(runtimeFiles.length>=35,`Runtime registry unexpectedly small: ${runtimeFiles.length}`);
assert.equal(new Set(runtimeFiles).size,runtimeFiles.length,"Duplicate runtime files in bootstrap registry");
const requiredRuntime=["work-growth.js","tennis-decision.js","knowledge-decision.js","today-execution.js","integration-12.5.js","feedback-os.js"];
for(const f of requiredRuntime)assert.ok(runtimeFiles.includes(f),`${f} missing from runtime registry`);
const files=[...baseModules,...runtimeFiles,"bootstrap.js","app.js"];
for(const f of files){const full=path.join(root,f);assert.ok(fs.existsSync(full),`${f} missing`);const r=cp.spawnSync(process.execPath,["--check",full],{encoding:"utf8"});assert.equal(r.status,0,`${f} syntax failed: ${r.stderr}`)}

const html=read("index.html"),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,"Duplicate HTML ids detected");
for(const f of baseModules)assert.ok(new RegExp(`src="\\./${f.replace(".","\\.")}\\?v=[^"]+"`).test(html),`Missing base script ${f}`);
assert.ok(/src="\.\/bootstrap\.js\?v=[^"]+"/.test(html),"Missing bootstrap.js");assert.ok(!html.includes('src="./app.js?v='),"index.html must not load legacy app.js");
for(const f of runtimeFiles)assert.ok(!new RegExp(`src="\\./${f.replace(".","\\.")}`).test(html),`${f} must be loaded by bootstrap`);

const js=[...baseModules,...runtimeFiles,"bootstrap.js","app.js"].map(read).join("\n"),names=[...js.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m=>m[1]),seen=new Set(),dups=[];for(const n of names){if(seen.has(n))dups.push(n);seen.add(n)}assert.deepEqual([...new Set(dups)],[],"Duplicate function declarations remain");
const handlers=new Set([...html.matchAll(/\bon(?:click|change|input|submit)="\s*([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));for(const h of handlers)assert.ok(seen.has(h),`Inline handler missing function: ${h}`);
const refs=new Set([...js.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1])),dynamic=new Set(["statementReviewAck","ux7AccountForm","ux7AssetForm","ux7FinancePulse","ux7Fab","ux7NewDebtBtn","ux7QuickSheet","ux7TodayPulse","ux7ToggleDebtForm"]),idSet=new Set(ids),missing=[...refs].filter(x=>!idSet.has(x)&&!dynamic.has(x));assert.deepEqual(missing,[],"Unexpected missing DOM ids: "+missing.join(", "));

const sw=read("sw.js"),manifest=read("manifest.webmanifest"),core=read("core.js"),vite=read("vite.config.mjs"),pwa=read("pwa.js"),state=read("state.js"),integration=read("integration-12.5.js"),feedback=read("feedback-os.js");
assert.ok(core.includes(`APP_VERSION="${RELEASE}"`),"Wrong runtime release");assert.ok(core.includes("STATE_VERSION=18"),"State schema changed unexpectedly");
assert.ok(manifest.includes(`Life RPG ${RELEASE}`),"Wrong manifest release");assert.ok(vite.includes(`cacheId:"life-rpg-${RELEASE}"`),"Generated Workbox cacheId missing");
assert.ok(!sw.includes('addEventListener("fetch"')&&!sw.includes("addEventListener('fetch'"),"Source SW must be inert; Workbox owns production SW");
assert.ok(bootstrap.includes("Promise.all(LIFE_RPG_RUNTIME_MODULES.map(lifeRuntimeLoadScript))"),"Runtime files must preload concurrently");
assert.ok(bootstrap.includes('["ensureIntegration125Ui","renderIntegration125"]'),"12.5 integration render step missing");assert.ok(bootstrap.includes('["ensureFeedback126Ui","renderFeedback126"]'),"12.6 feedback render step missing");
for(const f of runtimeFiles)assert.ok(vite.includes(`"${f}"`),`${f} not copied to dist`);
assert.ok(!bootstrap.includes("personal-stabilization-os.js"),"Compatibility shim must not be registered in bootstrap");assert.ok(vite.includes('"personal-stabilization-os.js"'),"Compatibility shim must still ship during cache transition");
assert.ok(!pwa.includes("location.reload()"),"PWA must not force reload");assert.ok(!read("ui.js").includes("location.replace(`./?v="),"UI must not force version redirect");
assert.ok(integration.includes('todayFlowCommand')&&integration.includes('today123Command'),"Legacy Today Flow consolidation missing");
assert.ok(integration.includes('knowledgeOsCommand')&&integration.includes('knowledge124Today'),"Knowledge summary consolidation missing");
assert.ok(feedback.includes("observed:observed.size"),"Feedback OS must distinguish observed execution from clicks");assert.ok(feedback.includes("No state migration")||feedback.includes("No state migration."),"Feedback OS state contract missing");
assert.ok(state.includes("function isSafeStateId"),"Imported ID validation missing");assert.ok(state.includes("campaignStart:localDateKey()"),"Fresh campaign start must be dynamic");
assert.ok(html.includes("life-rpg-booting"));assert.ok(html.includes(`?v=${SHELL_ANCHOR}`),"Compatibility shell asset anchor changed unexpectedly");
assert.ok(!html.includes("tesseract.min.js"),"Tesseract must be lazy-loaded");assert.ok(read("imports.js").includes("ensureFinancialOcrLoaded"),"Lazy OCR loader missing");
assert.ok(fs.existsSync(path.join(root,"reading-list.test.js")));assert.ok(fs.existsSync(path.join(root,"tennis-huawei.test.js")));assert.ok(fs.existsSync(path.join(root,"layout-all.e2e.test.js")));assert.ok(fs.existsSync(path.join(root,"feedback-12.6.test.js")));
const lock=JSON.parse(read("package-lock.json"));assert.equal(lock.version,"12.0.3","npm lock metadata changed unexpectedly");assert.equal(lock.packages?.[""]?.version,"12.0.3","npm lock root metadata changed unexpectedly");
const workflow=read(".github/workflows/deploy-pages.yml");assert.ok(workflow.includes("npm ci --no-audit --no-fund"));assert.ok(workflow.includes("npm run test:e2e"));
console.log(`OK — static checks passed for Life RPG ${RELEASE}: ${names.length} unique functions, ${runtimeFiles.length} runtime modules`);
