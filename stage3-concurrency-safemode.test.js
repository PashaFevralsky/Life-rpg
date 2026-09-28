"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname,read=p=>fs.readFileSync(path.join(root,p),"utf8"),storage=new Map(),RealDate=Date,FIXED="2026-09-28T12:00:00+05:00";
class FixedDate extends RealDate{constructor(...a){super(...(a.length?a:[FIXED]))}static now(){return new RealDate(FIXED).getTime()}static parse(v){return RealDate.parse(v)}static UTC(...a){return RealDate.UTC(...a)}}
const context=vm.createContext({console,Date:FixedDate,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,structuredClone:global.structuredClone,crypto:global.crypto,Blob:global.Blob,URL:global.URL,Map,Set,String,Array,Object,RegExp,document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>({}),addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},window:{addEventListener:()=>{},scrollTo:()=>{},location:{}},navigator:{},location:{},localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},Notification:function(){},confirm:()=>true,prompt:()=>"",toast:()=>{},audit:()=>{},render:()=>{},workXpOnDate:()=>0,readingBaseXpOnDate:()=>0,crmCompleteness:()=>({ok:true,done:0,total:0}),computeTennisElo:()=>({rating:1000})});
context.window.window=context.window;context.window.document=context.document;context.globalThis=context;
for(const file of ["core.js","state.js"])new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);
(async()=>{
  const rolled=JSON.parse(JSON.stringify(run(`(()=>{S=deepClone(DEFAULT_STATE);storageLastDurableState=deepClone(S);const attempted=deepClone(S);attempted.profile.name="attempt";S=deepClone(attempted);return [storageRollbackMemoryIfCurrent(attempted),S.profile.name]})()`)));
  assert.deepEqual(rolled,[true,"Павел"]);
  const kept=JSON.parse(JSON.stringify(run(`(()=>{S=deepClone(DEFAULT_STATE);storageLastDurableState=deepClone(S);const attempted=deepClone(S);attempted.profile.name="attempt";S=deepClone(attempted);S.profile.goal="newer-local";return [storageRollbackMemoryIfCurrent(attempted),S.profile.name,S.profile.goal]})()`)));
  assert.deepEqual(kept,[false,"attempt","newer-local"]);
  const state=read("state.js"),imports=read("imports.js"),finance=read("finance.js"),ui=read("ui.js"),boot=read("bootstrap.js"),share=read("share-hub.js");
  assert.ok(state.includes("storageRollbackMemoryIfCurrent(attempted)")&&state.includes("storageStateMatches(S,attempted)"));
  assert.ok(state.includes("await commitStateAtomically(()=>{")&&state.includes("Производные данные пересчитаны"));
  assert.ok(!imports.includes("catch(e){S=before;await persist();"));
  assert.ok(imports.includes("attempted=deepClone(S);await persist();statementImportPackage=null;aiImportQueue=[]"));
  assert.ok(ui.includes("finally{if(safe)S=before}")&&boot.includes("finally{if(safe)S=before}"));
  assert.ok(share.includes('share131AutoRoute(row){if(typeof storageSafeModeActive==="function"&&storageSafeModeActive())return false'));
  assert.ok(finance.includes("const take=need=>")&&finance.includes("moneyAdd(balance,income,-debt,-living,-extraDebt)")&&finance.includes("income=moneyAdd(income,v)"));
  for(const [file,needle] of [["personal-os.js","function personalData()"],["tracking-os.js","function growthData()"],["data-os.js","function entityStore(key)"],["projects-os.js","function projectStore()"],["tasks-os.js","function taskStore()"],["goals-os.js","function goalStore()"],["routines-os.js","function routineStore()"],["review-os.js","function reviewStore()"],["calendar-os.js","function calendarStore()"],["inbox-os.js","function inboxStore()"],["decision-os.js","function decisionPreferenceStore()"],["rules-os.js","function ruleToggles()"],["intelligence-13.2.js","function intelligence132Store()"],["gpt-exchange-13.5.js","function gpt135Store()"],["secure-ai-bridge-13.4.js","function ai134Store()"],["share-hub.js","function share131State()"]]){
    const src=read(file),pos=src.indexOf(needle);assert.ok(pos>=0);assert.ok(src.slice(pos,pos+1000).includes("storageSafeModeActive"),file);
  }
  console.log("OK — Stage 3.3 concurrency, true read-only Safe Mode, statement rollback and cents cash paths");
})().catch(e=>{console.error(e);process.exit(1)});