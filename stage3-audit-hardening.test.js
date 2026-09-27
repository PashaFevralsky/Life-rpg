"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname,RealDate=Date,FIXED="2026-03-30T12:00:00+02:00";
class FixedDate extends RealDate{
  constructor(...a){super(...(a.length?a:[FIXED]))}
  static now(){return new RealDate(FIXED).getTime()}
  static parse(v){return RealDate.parse(v)}
  static UTC(...a){return RealDate.UTC(...a)}
}
const context=vm.createContext({
  console,Date:FixedDate,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,Blob:global.Blob,URL:global.URL,Map,Set,String,Array,Object,RegExp,
  document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>({}),addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{}},navigator:{},location:{},
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},Notification:function(){},confirm:()=>true,prompt:()=>"",
  toast:()=>{},audit:()=>{},save:async()=>{},render:()=>{},workXpOnDate:()=>0,readingBaseXpOnDate:()=>0,crmCompleteness:()=>({ok:true,done:0,total:0}),
  computeTennisElo:()=>({rating:1000})
});
context.window.window=context.window;context.window.document=context.document;context.globalThis=context;
for(const file of ["core.js","state.js","finance.js","personal-os.js","people-os.js"])
  new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);
context.knowledgeFactualReadingLogs=()=>run(`(S.readingLogs||[]).filter(x=>validActivityDate(String(x?.dateKey||"")))`);

// Backup/import hardening: nested Personal/Growth IDs and entity references must be safe.
assert.throws(()=>run(`(()=>{const x=deepClone(DEFAULT_STATE);x.version=18;x.settings.personalOS={people:[{id:"x');alert(1)//",name:"bad"}]};return normalizeState(x)})()`),/Небезопасный ID/);
assert.throws(()=>run(`(()=>{const x=deepClone(DEFAULT_STATE);x.version=18;x.entities.tasks=[{id:"task-1",title:"T",blockedByIds:["x'bad"]}];return normalizeState(x)})()`),/Небезопасный ID/);

// Invalid/future verification anchors must never be used as a financial baseline.
assert.equal(run(`safeVerificationTimestamp("not-a-date")`),"");
assert.equal(run(`safeVerificationTimestamp("2099-01-01T00:00:00Z")`),"");
run(`S=normalizeState((()=>{const x=deepClone(DEFAULT_STATE);x.accounts=[{id:"a",name:"A",verifiedBalance:1000,verifiedAt:"bad",active:true}];x.settings.primaryAccountId="a";return x})())`);
assert.equal(run(`S.accounts[0].verifiedAt`),"");
assert.equal(run(`accountsModeActive()`),false);
assert.equal(run(`accountBalanceById("a")`),0);

// Valid anchors remain active and post-anchor transactions use cent-exact arithmetic.
run(`S=normalizeState((()=>{const x=deepClone(DEFAULT_STATE);x.accounts=[{id:"a",name:"A",verifiedBalance:1000,verifiedAt:"2026-03-28T12:00:00+01:00",active:true}];x.settings.primaryAccountId="a";x.incomeLogs=[{id:"i1",accountId:"a",dateKey:"2026-03-29",date:"2026-03-29T12:00:00+02:00",amount:.1},{id:"i2",accountId:"a",dateKey:"2026-03-29",date:"2026-03-29T13:00:00+02:00",amount:.2}];return x})())`);
assert.equal(run(`accountsModeActive()`),true);
assert.equal(run(`accountBalanceById("a")`),1000.3);

// Asset anchors get the same safety rule and cent-exact delta application.
run(`S.assets=[{id:"asset",verifiedValue:100,verifiedAt:"bad",active:true}];S.assetTransfers=[{id:"at1",assetId:"asset",direction:"toAsset",amount:.2,dateKey:"2026-03-29",date:"2026-03-29T12:00:00+02:00"}]`);
assert.equal(run(`assetValueById("asset")`),100);
run(`S.assets[0].verifiedAt="2026-03-28T12:00:00+01:00"`);
assert.equal(run(`assetValueById("asset")`),100.2);

// Money aggregates and reservation restore/reapply must not accumulate floating-point residue.
run(`S.expenses=[{id:"e1",dateKey:"2026-03-29",amount:.1},{id:"e2",dateKey:"2026-03-29",amount:.2},{id:"e3",dateKey:"2026-03-29",amount:.1,regularPaymentId:"rent"},{id:"e4",dateKey:"2026-03-29",amount:.2,regularPaymentId:"rent"}]`);
assert.equal(run(`monthLivingExpenses("2026-03")`),.3);
assert.equal(run(`monthRegularExpenses("2026-03")`),.3);
assert.equal(run(`regularPaidAmount({id:"rent"},"2026-03")`),.3);
run(`S.reservations=[{id:"r1",type:"living",remaining:.1,status:"active",createdAt:"1"},{id:"r2",type:"living",remaining:.2,status:"active",createdAt:"2"}];globalThis.used=consumeReservation("living",.3)`);
assert.equal(run(`moneySum(used.map(x=>x.amount))`),.3);
assert.equal(run(`reservedCashTotal()`),0);
run(`restoreReservationUse(used)`);assert.equal(run(`reservedCashTotal()`),.3);
run(`reapplyReservationUse(used)`);assert.equal(run(`reservedCashTotal()`),0);

// Financial freshness is calendar-day based, not elapsed 24-hour blocks across DST.
run(`S.accounts=[{id:"a",name:"A",verifiedBalance:1000,verifiedAt:"2026-03-28T23:30:00+01:00",active:true}];S.settings.primaryAccountId="a";S.debts=[];S.settings.dailySpendLimit=1;S.settings.incomeEvents=[];S.expenses=[];S.incomeLogs=[];S.payments=[];S.bankTransfers=[];S.assetTransfers=[];S.fundTransfers=[];S.cashAdjustments=[];S.reservations=[];S.assets=[]`);
assert.equal(run(`financialHealthData().fresh`),2);

// Knowledge integrity must use factual reading sessions and ignore future/corrupt rows.
run(`S=deepClone(DEFAULT_STATE);S.settings.primaryAccountId="main";S.books=[{id:"b",title:"Book",status:"reading",totalPages:100,currentPage:10}];S.readingLogs=[{id:"past",bookId:"b",dateKey:"2026-03-29",pages:10,minutes:30},{id:"future",bookId:"b",dateKey:"2026-03-31",pages:90,minutes:30},{id:"bad",bookId:"b",dateKey:"2026-02-31",pages:90,minutes:30}]`);
const issues=run(`dataIntegrityIssues()`);
assert.equal(Array.from(issues).some(x=>String(x.title).includes("Прогресс книги требует пересчёта")),false);
assert.ok(Array.from(issues).some(x=>String(x.title).includes("Некорректная дата сессии чтения")));

// Missing account references are visible instead of silently disappearing from diagnostics.
run(`S=deepClone(DEFAULT_STATE);S.settings.primaryAccountId="main";S.incomeLogs=[{id:"income",accountId:"ghost",dateKey:"2026-03-29",amount:10}]`);
assert.ok(Array.from(run(`dataIntegrityIssues()`)).some(x=>String(x.title).includes("Доход ссылается на отсутствующий счёт")));

// People OS must reject impossible birthday dates; leap-day behavior stays explicit (Mar 1 in non-leap years).
assert.equal(run(`peopleBirthdayDays({birthday:"2026-02-31"})`),null);
assert.equal(run(`peopleNormalize({id:"p",name:"P",birthday:"2026-02-31"}).birthday`),"");
assert.equal(run(`peopleBirthdayDays({birthday:"2024-02-29"})`),336);

console.log("OK — Stage 3.1 audit hardening: backup IDs, verification anchors, cent arithmetic, factual diagnostics, People dates");
