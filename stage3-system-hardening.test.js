"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname,storage=new Map(),RealDate=Date,FIXED="2026-09-27T12:00:00+02:00";
class FixedDate extends RealDate{constructor(...a){super(...(a.length?a:[FIXED]))}static now(){return new RealDate(FIXED).getTime()}static parse(v){return RealDate.parse(v)}static UTC(...a){return RealDate.UTC(...a)}}
const context=vm.createContext({
  console,Date:FixedDate,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,Blob:global.Blob,URL:global.URL,Map,Set,String,Array,Object,RegExp,
  document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>({}),addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{}},navigator:{},location:{},
  localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  Notification:function(){},confirm:()=>true,prompt:()=>"",toast:()=>{},audit:()=>{},render:()=>{},
  workXpOnDate:()=>0,readingBaseXpOnDate:()=>0,crmCompleteness:()=>({ok:true,done:0,total:0}),computeTennisElo:()=>({rating:1000})
});
context.window.window=context.window;context.window.document=context.document;context.globalThis=context;
for(const file of ["core.js","state.js"])new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

assert.ok(run(`storage137CompareCandidates(
  {raw:{updated:"2026-09-27T10:00:00Z",settings:{storageSync137:{revision:9}}},source:"lifeRpg4"},
  {raw:{updated:"2026-09-27T11:00:00Z",settings:{storageSync137:{revision:8}}},source:"IndexedDB"})<0`),
  "higher revision must beat a newer wall-clock timestamp");

assert.ok(run(`storage137CompareCandidates(
  {raw:{updated:"2026-09-27T10:00:00Z",settings:{}},source:"lifeRpg4"},
  {raw:{updated:"2026-09-27T11:00:00Z",settings:{}},source:"IndexedDB"})>0`),
  "legacy revision-0 copies must still use updated timestamp");

assert.throws(()=>run(`(()=>{const x=deepClone(DEFAULT_STATE);x.accounts=[{id:"dup",name:"A"},{id:"dup",name:"B"}];return validateStateShape(x)})()`),/Дублирующийся ID/);
assert.throws(()=>run(`(()=>{const x=deepClone(DEFAULT_STATE);x.bankTransfers=[{id:"t1",fromAccountId:"bad id",toAccountId:""}];return validateStateShape(x)})()`),/Небезопасный ID/);

(async()=>{
  context.recovery133CleanupBackups=async limit=>limit;
  assert.equal(await run(`cleanupBackups(30)`),60,"legacy cleanup must delegate to Recovery retention");

  storage.set("lifeRpgRecovery133SafeMode","1");
  assert.equal(run(`storageSafeModeActive()`),true);
  const code=await run(`persist().then(()=>"",e=>e.code||"")`);
  assert.equal(code,"LIFE_RPG_SAFE_MODE","Safe Mode must block durable writes");
  storage.delete("lifeRpgRecovery133SafeMode");

  const name=await run(`(async()=>{S=deepClone(DEFAULT_STATE);S.profile.name="before";persist=async()=>{throw new Error("storage fail")};try{await commitStateAtomically(()=>{S.profile.name="after"})}catch{}return S.profile.name})()`);
  assert.equal(name,"before","atomic state mutation must roll memory back on persistence failure");

  const state=fs.readFileSync("state.js","utf8"),recovery=fs.readFileSync("recovery-center-13.3.js","utf8"),cal=fs.readFileSync("calibration-os.js","utf8"),focus=fs.readFileSync("focus-os.js","utf8"),pred=fs.readFileSync("predictive-trends-13.2.2.js","utf8"),hub=fs.readFileSync("import-hub.js","utf8"),imports=fs.readFileSync("imports.js","utf8");
  assert.ok(state.includes("recovery133CleanupBackups(Math.max(60,limit))"));
  assert.ok(recovery.includes("withStorageSafeWrite(()=>commitStateAtomically"));
  assert.ok(cal.includes('async function calibrationOnBoot(){if((typeof storageSafeModeActive==="function"&&storageSafeModeActive())')&&cal.includes('return {skipped:true};'),"Calibration boot must skip in Safe Mode");
  assert.ok(focus.includes("storageSafeModeActive())return;"));
  assert.ok(pred.includes("storageSafeModeActive())return false;"));
  assert.ok(hub.includes("S=before;storageLoadBlocked=beforeLoadBlocked"));
  assert.ok(imports.includes("await commitStateAtomically(async()=>{result=await applyImportedCandidates"));
  assert.equal((fs.readFileSync("index.html","utf8").match(/;persist\(\)/g)||[]).length,0);
  console.log("OK — Stage 3.2 system hardening: revision ordering, atomic restore/import, unified retention, Safe Mode, ID integrity");
})().catch(e=>{console.error(e);process.exit(1)});
