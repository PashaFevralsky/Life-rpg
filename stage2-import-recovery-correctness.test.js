"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const RealDate=Date,FIXED="2026-09-27T12:00:00+02:00";
class FixedDate extends RealDate{constructor(...a){super(...(a.length?a:[FIXED]))}static now(){return new RealDate(FIXED).getTime()}}
const root=__dirname,els={aiImportStatus:{textContent:"",innerHTML:""},aiApplyBtn:{disabled:false,textContent:""},statementReviewAck:{checked:true}},toasts=[];
let uidN=0,persistResolve=null,persistCalls=0;
const baseState=()=>({
  settings:{primaryAccountId:"main",importHub127:{fingerprints:[],history:[]},learnImportRules:false},
  accounts:[{id:"main",name:"Main",active:true,verifiedBalance:0,verifiedAt:""}],
  debts:[],assets:[],incomeLogs:[],expenses:[],payments:[],bankTransfers:[],assetTransfers:[],
  cashAdjustments:[],importBatches:[],bankImportIds:[],screenshotImportIds:[],importRules:[],
  regularPayments:[],reservations:[],workLogs:[],tennis:[],reconciliationSessions:[],auditLog:[]
});
const context=vm.createContext({
  console,Date:FixedDate,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,TextEncoder,TextDecoder,Blob:global.Blob,URL:global.URL,
  S:baseState(),
  document:{getElementById:id=>els[id]||null,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>({click(){}}),addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{LifePlatform:{},addEventListener:()=>{}},navigator:{},location:{},localStorage:{getItem:()=>null,setItem:()=>{}},
  confirm:()=>true,prompt:()=>"",toast:m=>toasts.push(String(m)),render:()=>{},renderAiImportPreview:()=>{},renderImport127:()=>{},
  audit:()=>{},save:async()=>{},createPreActionSnapshot:async()=>1,persist:async()=>{},
  uid:()=>`u${++uidN}`,rub:n=>`${n}`,escapeHtml:String,
  $:id=>els[id]||null,accountName:()=>"",accountOptions:()=>"",debtById:()=>null,findDebtByName:()=>null,findAccountByName:()=>null,
  defaultAccountId:()=>"main",activeAccounts:()=>context.S.accounts.filter(a=>a.active!==false),accountsModeActive:()=>true,accountBalanceById:()=>0,primaryCashVerifiedAt:()=>false,
  consumeReservation:()=>[],restoreReservationUse:()=>{},reapplyReservationUse:()=>{},matchRegularPayment:()=>null,matchPlannedIncome:()=>null,
  matchDebtPaymentCandidate:()=>null,matchAssetByDescription:()=>null,classifyImportedExpense:()=>"Другое",refineFinancialCandidate:x=>x,
  importIsHistorical:()=>false,paymentIsBeforeDebtBaseline:()=>false,advanceDebtScheduleAfterPayment:()=>{},
  recordDebtBalanceCheckpoint:()=>{},paymentDueMonthForDebt:()=>"",checkAchievements:()=>{},
  recomputeTennisElo:()=>{},personalData:()=>({importFingerprints:[]}),growthData:()=>({}),growthTrackers:()=>[],
  growthLogEvent:()=>null,personalImportPreviewRows:()=>({valid:[],invalid:[],duplicates:[],total:0}),
  deepClone:x=>structuredClone(x)
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","imports.js","import-hub.js"])new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

(async()=>{
  context.tableBad={headers:["date","amount","description"],rows:[{"date":"31.02.2026","amount":"-100","description":"bad"},{"date":"28.09.2026","amount":"-100","description":"future"}]};
  context.tableGood={headers:["date","amount","description"],rows:[{"date":"27.09.2026","amount":"-100","description":"ok"}]};
  assert.equal(run(`import127BankPreview(tableBad).valid`),0);
  assert.equal(run(`import127BankPreview(tableGood).valid`),1);

  context.workBad={headers:["date","sales"],rows:[{"date":"31.02.2026","sales":"1000"}]};
  context.tennisBad={headers:["date","minutes"],rows:[{"date":"31.02.2026","minutes":"60"}]};
  assert.equal(run(`import127WorkPreview(workBad).valid`),0);
  assert.equal(run(`import127TennisPreview(tennisBad).valid`),0);

  let result=await run(`applyImportedCandidates([
   {include:true,dateKey:"2026-02-31",amount:100,type:"expense",desc:"bad"},
   {include:true,dateKey:"2026-09-28",amount:100,type:"expense",desc:"future"},
   {include:true,dateKey:"2026-09-27",amount:100,type:"expense",desc:"ok"}
  ],"csv")`);
  assert.equal(result.created.length,1);
  assert.equal(run(`S.expenses.length`),1);
  assert.equal(run(`S.expenses[0].dateKey`),"2026-09-27");

  assert.equal(run(`statementTxDateKey({date:"2026-02-31"})`),"");
  assert.equal(run(`statementTxDateKey({date:"2026-09-28"})`),"");
  assert.equal(run(`statementTxDateKey({date:"2026-09-27"})`),"2026-09-27");

  run(`S.settings.importHub127={fingerprints:["fp1"],history:[{id:"h1",rollback:"work",ids:["w1"],fps:["fp1"]}]};S.workLogs=[{id:"w1",date:"2026-09-27"}]`);
  await run(`import127Rollback("h1")`);
  assert.equal(run(`S.workLogs.length`),0);
  assert.equal(run(`import127Seen("fp1")`),false);

  run(`S.incomeLogs=[];aiImportQueue=[{id:"a1",include:true,type:"income",date:"2026-09-27",amount:500,source:"Test"}]`);
  let snapshotResolve=null;context.createPreActionSnapshot=()=>new Promise(r=>{snapshotResolve=r});
  context.persist=async()=>{persistCalls++};
  const p1=run(`applyAiImportQueue()`);
  const p2=run(`applyAiImportQueue()`);
  assert.equal(run(`S.incomeLogs.length`),0);
  assert.ok(toasts.some(x=>x.includes("уже применяется")));
  snapshotResolve(1);await p1;await p2;
  assert.equal(run(`S.incomeLogs.length`),1);
  assert.equal(persistCalls,1);

  run(`S.incomeLogs=[];aiImportQueue=[{id:"a2",include:true,type:"income",date:"2026-09-27",amount:700,source:"Retry"}]`);
  context.createPreActionSnapshot=async()=>1;context.persist=async()=>{throw new Error("storage fail")};
  let failed=false;try{await run(`applyAiImportQueue()`)}catch{failed=true}
  assert.equal(failed,true);
  assert.equal(run(`S.incomeLogs.length`),0);
  assert.equal(run(`aiImportQueue.length`),1);
  assert.equal(run(`AI_IMPORT_APPLY_PENDING`),false);

  console.log("OK — Stage 2.9 import/recovery correctness: factual dates, reversible fingerprints, atomic AI apply");
})().catch(e=>{console.error(e);process.exit(1)});
