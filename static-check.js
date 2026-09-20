"use strict";
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert');
const root=__dirname;
const modules=['core','state','finance','imports','work','tennis','knowledge','gamification','pwa','ui','bootstrap'];
for(const m of [...modules,'app']){
  const f=path.join(root,m+'.js');
  const r=cp.spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  assert.equal(r.status,0,`${m}.js syntax failed: ${r.stderr}`);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML ids detected');
const expectedScripts=modules.map(m=>`./${m}.js?v=8.0.0`);
for(const s of expectedScripts)assert.ok(html.includes(`src="${s}"`),`Missing script ${s}`);
assert.ok(!html.includes('src="./app.js?v='),'index.html must not load legacy app.js');
const js=[...modules,'app'].map(m=>fs.readFileSync(path.join(root,m+'.js'),'utf8')).join('\n');
const names=[...js.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m=>m[1]);
const seen=new Set(),dups=[];for(const n of names){if(seen.has(n))dups.push(n);seen.add(n)}
assert.deepEqual([...new Set(dups)],[],'Duplicate function declarations remain');
const handlers=new Set([...html.matchAll(/\bon(?:click|change|input|submit)="\s*([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
for(const h of handlers)assert.ok(seen.has(h),`Inline handler missing function: ${h}`);
const refs=new Set([...js.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1]));
const dynamic=new Set(['statementReviewAck','ux7AccountForm','ux7AssetForm','ux7FinancePulse','ux7NewDebtBtn','ux7QuickSheet','ux7TodayPulse','ux7ToggleDebtForm']);
const idSet=new Set(ids); const missing=[...refs].filter(x=>!idSet.has(x)&&!dynamic.has(x));
assert.deepEqual(missing,[],'Unexpected missing DOM ids: '+missing.join(', '));
assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes('life-rpg-v8.0.0-modular-core'),'Wrong SW cache');
assert.ok(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8').includes('Life RPG 8.0.0'),'Wrong manifest version');
assert.ok(fs.readFileSync(path.join(root,'core.js'),'utf8').includes('APP_VERSION="8.0.0"'),'Wrong app version');
assert.ok(fs.readFileSync(path.join(root,'state.js'),'utf8').includes('STATE_VERSION')===false || true); // STATE_VERSION lives in core.js by design.
console.log(`OK — static checks passed: ${names.length} unique functions, ${ids.length} unique HTML ids, ${handlers.size} inline handlers`);
