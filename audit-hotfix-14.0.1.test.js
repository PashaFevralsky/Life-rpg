"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("node:assert/strict");

const elements={};
const ctx=vm.createContext({
  console,Date,Math,JSON,Intl,Promise,setTimeout,clearTimeout,setInterval:()=>0,structuredClone,crypto,
  document:{getElementById:id=>elements[id]||(elements[id]={textContent:"",innerHTML:"",value:"",checked:false,classList:{add(){},remove(){},contains(){return false}},addEventListener(){},closest(){return null}}),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},head:{appendChild(){}},body:{classList:{add(){},remove(){},contains(){return true}},appendChild(){}}},
  window:{addEventListener(){},location:{},Tesseract:null},navigator:{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  confirm:()=>true,prompt:()=>null,requestAnimationFrame:f=>f()
});
for(const f of ["core.js","state.js","finance.js","imports.js","work.js","tennis.js","knowledge.js","gamification.js","ui.js","life-ops.js","finance-rebuild-14.js"])vm.runInContext(fs.readFileSync(f,"utf8"),ctx,{filename:f});
const run=s=>vm.runInContext(s,ctx),plain=x=>JSON.parse(JSON.stringify(x));
const reset=()=>run(`S=deepClone(DEFAULT_STATE);S.settings.reportStart="";S.settings.reportStartMigration="";S.settings.miniBufferTarget=0;S.settings.emergencyFundTarget=0;S.settings.dailySpendLimit=1000;S.accounts=[{id:"a",name:"A",type:"Счёт",verifiedBalance:10000,verifiedAt:new Date().toISOString(),active:true}];S.settings.primaryAccountId="a";S.settings.incomeEvents=[];S.debts=[];S.reservations=[];S.expenses=[];S.incomeLogs=[];S.payments=[];S.workLogs=[];S.tennis=[];S.readingLogs=[];save=async()=>{};persist=async()=>{};render=()=>{};toast=()=>{};`);

(async()=>{
  reset();

  // Statement packages accept only explicitly supported semantic kinds.
  ctx.pkg={transactions:[{kind:"expense"},{kind:"expnese"}]};
  assert.equal(run("statementInvalidKinds(pkg).length"),1);
  assert.ok(run("STATEMENT_IMPORT_KINDS.has('refund')"));
  assert.ok(!run("STATEMENT_IMPORT_KINDS.has('debt_drawdown')"));

  // A verified balance anchor must be a real instant, not an ambiguous day.
  ctx.anchorDate={balanceAnchor:{balance:100,asOf:"2026-10-02"}};
  ctx.anchorIso={balanceAnchor:{balance:100,asOf:"2026-10-02T20:00:00+05:00"}};
  assert.equal(run("statementAnchorIso(anchorDate)"),"");
  assert.match(run("statementAnchorIso(anchorIso)"),/^2026-10-02T15:00:00\.000Z$/);

  // Refunds are valid ledger rows and survive Finance Rebuild snapshot validation.
  run(`S.expenses=[{id:"refund1",dateKey:"2026-10-02",date:"2026-10-02T12:00:00Z",amount:-350,accountId:"a",category:"Другое",note:"Возврат",isRefund:true,reservationUse:[]}]`);
  const snap=plain(run("financeRebuild14FinancialSnapshot(S)"));
  ctx.snap=snap;
  assert.doesNotThrow(()=>run("financeRebuild14ValidateSnapshot(snap)"));
  assert.equal(snap.expenses[0].amount,-350);

  // Expired reservations never reduce free cash and cannot be resurrected by undo.
  run(`S.reservations=[{id:"old",type:"living",remaining:500,status:"active",untilDate:"2026-01-01"},{id:"live",type:"living",remaining:200,status:"active",untilDate:"2099-01-01"}]`);
  assert.equal(run("reservedCashTotal()"),200);
  run(`restoreReservationUse([{id:"old",amount:50}])`);
  assert.equal(run("S.reservations[0].status"),"expired");

  // Unknown debt rates block rate-sensitive payoff logic rather than acting like 0%.
  run(`S.debts=[{id:"u",name:"Unknown",balance:5000,initial:5000,rate:0,rateKnown:false,min:100,nextPaymentDate:"2099-01-10",nextPaymentAmount:100,paymentMode:"fixed",active:true},{id:"k",name:"Known",balance:5000,initial:5000,rate:30,rateKnown:true,min:100,nextPaymentDate:"2099-01-10",nextPaymentAmount:100,paymentMode:"fixed",active:true}]`);
  assert.equal(run("financialPhase().id"),"rate_unknown");
  assert.equal(run("autopilotPlan().debtExtra"),0);
  assert.equal(run("autopilotPlan().best"),null);
  assert.equal(run("simulateDebt(1000).unreliable"),true);
  assert.equal(run("highestRateDebtIndex()"),-1);
  assert.ok(run("buildFinancialProjection(5).warnings.some(x=>x.includes('не подтверждена ставка'))"));

  // Life Ops sees outdoor Training OS sessions, not only table tennis.
  run(`globalThis.training129AllSessions=()=>[{id:"out",dateKey:localDateKey(),minutes:30,rpe:4,type:"easy",domain:"outdoor",source:"manual"}]`);
  assert.equal(run("lifeOpsTodayCounts().training"),1);

  // Editing today's row without changing array length re-opens a closed day.
  run(`S.checks[localDateKey()]={lifeOps:{confirmations:{expenses:true,income:true,payments:true,work:true,training:true},closed:true,closedAt:new Date().toISOString()}};S.expenses=[{id:"e",dateKey:localDateKey(),date:new Date().toISOString(),amount:10,note:"old"}];globalThis.__auditEdit=async()=>{S.expenses[0].note="new"};lifeOpsWrapActivity("__auditEdit")`);
  await run("__auditEdit()");
  assert.equal(run("lifeOpsIsClosed()"),false);

  // Android OCR is fail-closed; no remote JS may execute in the APK.
  run("globalThis.__LIFE_RPG_ANDROID__=true");
  await assert.rejects(run("ensureFinancialOcrLoaded()"),/внешний OCR-код отключён/);

  // Source contracts for Android privacy + strict schema/version.
  assert.ok(fs.readFileSync("tennis-huawei.js","utf8").includes("Android: внешний OCR-код отключён"));
  assert.ok(fs.readFileSync("android-release-patch.mjs","utf8").includes('android:allowBackup="false"'));
  assert.ok(fs.readFileSync("android-release-patch.mjs","utf8").includes('android:fullBackupContent="false"'));
  assert.ok(fs.readFileSync("platform.vite.mjs","utf8").includes('z.enum(["income","expense","refund","transfer","asset_transfer","debt_payment"])'));
  assert.equal(JSON.parse(fs.readFileSync("android-release-config.json","utf8")).targetVersion,"14.0.1");

  console.log("OK — 14.0.1 audit hotfix: statement validation, refunds, reservations, rates, Life Ops and Android privacy");
})().catch(e=>{console.error(e);process.exit(1)});
