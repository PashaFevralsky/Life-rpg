"use strict";

const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const {webcrypto}=require("node:crypto");
const {TextEncoder,TextDecoder}=require("node:util");

const source=fs.readFileSync("recovery-center-13.3.js","utf8");
const memory=new Map();
const context={
  console,
  crypto:webcrypto,
  TextEncoder,TextDecoder,
  structuredClone,
  URLSearchParams,
  location:{search:""},
  localStorage:{getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},
  document:{documentElement:{classList:{toggle(){}}},getElementById(){return null},createElement(){return {style:{},click(){}}},head:{appendChild(){}}},
  navigator:{},
  Blob:globalThis.Blob,
  File:globalThis.File||class File extends Blob{constructor(parts,name,opts){super(parts,opts);this.name=name}},
  confirm:()=>true,prompt:()=>"pw",toast(){},render(){},audit(){},
  APP_VERSION:"13.2.2",STATE_VERSION:18,
  S:{version:18,settings:{},entities:{projects:[],tasks:[],goals:[],routines:[],routineLogs:[],reviews:[],inbox:[],calendarEvents:[]}},
  db:{},
  uid:()=>"id-1",localDateKey:()=>"2026-09-25",bytesToBase64:bytes=>Buffer.from(bytes).toString("base64"),base64ToBytes:s=>new Uint8Array(Buffer.from(s,"base64")),
  deepClone:structuredClone,
  escapeHtml:v=>String(v??""),
  validateStateShape:s=>{assert.equal(typeof s,"object");if(!s||Array.isArray(s))throw new Error("bad state")},
  normalizeState:s=>structuredClone(s),
  dataIntegrityIssues:()=>[],
  openDB:async()=>context.db,
  dbGet:async()=>null,
  dbGetAll:async()=>[],
  dbPut:async()=>{},
  dbDelete:async()=>{},
  persist:async()=>{},save:async()=>{},
  createPreActionSnapshot:async()=>1,
  cleanupBackups:async()=>0,
  recoverySnapshotsCache:[]
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:"recovery-center-13.3.js"});

(async()=>{
  const canonicalA=await vm.runInContext('recovery133Canonical({b:1,a:{y:2,x:3}})',context);
  const canonicalB=await vm.runInContext('recovery133Canonical({a:{x:3,y:2},b:1})',context);
  assert.equal(canonicalA,canonicalB,"canonical JSON must be key-order invariant");

  const digestA=await vm.runInContext('recovery133Digest({b:1,a:2})',context);
  const digestB=await vm.runInContext('recovery133Digest({a:2,b:1})',context);
  assert.equal(digestA,digestB,"checksum must be deterministic");
  assert.match(digestA,/^sha256:[0-9a-f]{64}$/);

  assert.equal(vm.runInContext('recovery133KindFromLabel("Ручной checkpoint 13.3")',context),"manual");
  assert.equal(vm.runInContext('recovery133KindFromLabel("Перед полным восстановлением")',context),"rollback");
  assert.equal(vm.runInContext('recovery133KindFromLabel("Перед ремонтом связей")',context),"operation");
  assert.equal(vm.runInContext('recovery133SnapshotKind({label:""})',context),"daily");

  const stats=await vm.runInContext('recovery133StateStats({entities:{tasks:[{id:1}],projects:[{id:2}]},debts:[{}],payments:[{}],workLogs:[],tennis:[],books:[],readingLogs:[],expenses:[],incomeLogs:[],crmDeals:[],auditLog:[],trash:[]})',context);
  assert.equal(stats.total,4);

  const check=await vm.runInContext(`(async()=>{const state={version:18,settings:{},entities:{projects:[],tasks:[],goals:[],routines:[],routineLogs:[],reviews:[],inbox:[],calendarEvents:[]}};const meta=await recovery133BuildMeta(state,{kind:"manual",label:"test",ts:1});return recovery133VerifySnapshot({ts:1,label:"test",state,meta})})()`,context);
  assert.equal(check.ok,true,"fresh snapshot must verify");

  const tampered=await vm.runInContext(`(async()=>{const state={version:18,settings:{},entities:{projects:[],tasks:[],goals:[],routines:[],routineLogs:[],reviews:[],inbox:[],calendarEvents:[]}};const meta=await recovery133BuildMeta(state,{kind:"manual",label:"test",ts:1});state.settings.changed=true;return recovery133VerifySnapshot({ts:1,label:"test",state,meta})})()`,context);
  assert.equal(tampered.ok,false,"tampered snapshot must fail checksum");
  assert.equal(tampered.checksumOk,false);

  const bundle=await vm.runInContext('recovery133PrepareBundle()',context);
  assert.equal(bundle.format,"life-rpg-disaster-recovery-v1");
  assert.equal(bundle.stateVersion,18);
  const parsed=await vm.runInContext(`recovery133ParseBundleText(${JSON.stringify(JSON.stringify(bundle))})`,context);
  assert.equal(parsed.bundleChecksum,bundle.bundleChecksum,"bundle must self-verify");

  const encrypted=await vm.runInContext(`recovery133EncryptJson(${JSON.stringify(bundle)},"secret")`,context);
  assert.equal(encrypted.format,"life-rpg-disaster-recovery-encrypted-v1");
  context.__encrypted=encrypted;
  const decrypted=await vm.runInContext('recovery133DecryptJson(__encrypted,"secret")',context);
  assert.equal(decrypted.bundleChecksum,bundle.bundleChecksum,"encrypted bundle round-trip must preserve payload");

  await vm.runInContext('recovery133SetSafeMode(true,"test")',context);
  assert.equal(vm.runInContext('recovery133SafeModeActive()',context),true);
  await vm.runInContext('recovery133SetSafeMode(false,"test")',context);
  assert.equal(vm.runInContext('recovery133SafeModeActive()',context),false);

  assert.ok(source.includes('Life RPG 13.3.0 — Backup, Recovery, Integrity & Safe Mode'));
  assert.equal(fs.readFileSync("bootstrap.js","utf8").includes('"recovery-center-13.3.js"'),true);
  assert.equal(fs.readFileSync("bootstrap.js","utf8").includes('["ensureRecovery133Ui","renderRecovery133"]'),true);
  assert.equal(fs.readFileSync("vite.config.mjs","utf8").includes('cacheId:"life-rpg-13.2.2"'),true);
  assert.ok(JSON.parse(fs.readFileSync("package.json","utf8")).scripts.test.includes("recovery-13.3.test.js"));

  console.log("Recovery 13.3 tests: OK");
})().catch(e=>{console.error(e);process.exit(1)});
