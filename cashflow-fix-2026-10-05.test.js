"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict");
const RealDate=Date;
const FIXED=new RealDate("2026-10-05T12:00:00+02:00").getTime();
class FakeDate extends RealDate{
  constructor(...args){super(...(args.length?args:[FIXED]))}
  static now(){return FIXED}
}
const context=vm.createContext({
  console,Date:FakeDate,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,
  document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}}},
  navigator:{},location:{reload:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  Notification:function(){},confirm:()=>true,prompt:()=>"",Blob:global.Blob,URL:global.URL
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","state.js","finance.js"])new vm.Script(fs.readFileSync(path.join(__dirname,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

run(`S=deepClone(DEFAULT_STATE);
S.settings.reportStart="2026-10-01";
S.settings.campaignStart="2026-10-01";
S.settings.incomeEvents=[];
S.settings.monthlyDebtGoal=0;
S.settings.dailySpendLimit=0;
S.envelopeLimits={"Жизнь":50000};
S.envelopeCarryovers={};
S.expenses=[{id:"spent",dateKey:"2026-10-03",date:"2026-10-03T12:00:00+02:00",amount:7160,category:"Жизнь",regularPaymentId:""}];
S.regularPayments=[];
S.debts=[];
S.payments=[];
S.accounts=[{id:"main",name:"Основной",verifiedBalance:100000,verifiedAt:"2026-10-05T10:00:00Z",active:true}];
S.settings.primaryAccountId="main";
S.cashAdjustments=[];S.bankTransfers=[];S.fundTransfers=[];S.reservations=[];`);

assert.equal(run("projectedLivingBudgetRemaining(new Date(2026,9,5,12))"),42840,"remaining October living budget should be 42,840");

const flow=run("dailyCashFlow(27,'safe')");
const totalLiving=Array.from(flow.rows).reduce((s,x)=>s+x.living,0);
assert.equal(Math.round(totalLiving*100)/100,42840,"daily cash-flow must spend the remaining monthly living budget exactly once");
assert.equal(flow.end,57160,"without other events 100,000 cash minus 42,840 living must end at 57,160");
assert.equal(flow.deficit,null,"the old harmonic overcount must not create a false cash gap");

const projection=run("buildFinancialProjection(27)");
assert.equal(projection.living,42840,"90-day projection engine must use the same stateful living allocator");
assert.equal(projection.endingBalance,57160,"projection ending balance must match the corrected living budget");

run(`S=deepClone(DEFAULT_STATE);
S.settings.reportStart="2026-10-01";S.settings.campaignStart="2026-10-01";
S.settings.incomeEvents=[];S.settings.monthlyDebtGoal=0;S.settings.dailySpendLimit=1000;
S.envelopeLimits={};S.envelopeCarryovers={};S.expenses=[];S.regularPayments=[];S.debts=[];S.payments=[];
S.accounts=[{id:"main",name:"Основной",verifiedBalance:100000,verifiedAt:"2026-10-05T10:00:00Z",active:true}];
S.settings.primaryAccountId="main";S.cashAdjustments=[];S.bankTransfers=[];S.fundTransfers=[];S.reservations=[];`);
const baseFlow=run("dailyCashFlow(27,'safe')");
const baseLiving=Array.from(baseFlow.rows).reduce((s,x)=>s+x.living,0);
assert.equal(baseLiving,27000,"without envelopes the projection must respect the fixed 1,000/day cap");

console.log("OK — cash-flow living budget is consumed once, projection engines agree, no false harmonic deficit");
