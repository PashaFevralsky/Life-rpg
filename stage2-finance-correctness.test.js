"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname;
const context=vm.createContext({
  console,Date,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,
  document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}}},
  navigator:{},location:{reload:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  Notification:function(){},confirm:()=>true,prompt:()=>"",Blob:global.Blob,URL:global.URL
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","state.js","finance.js"])new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

// Fixed monthly due day must recover after February instead of drifting forever.
run(`S=deepClone(DEFAULT_STATE);S.debts=[{id:"loan",name:"Loan",balance:100000,initial:100000,rate:20,min:10000,dueDay:31,nextPaymentDate:"2026-01-31",nextPaymentAmount:10000,paymentMode:"fixed",parts:[]}];S.payments=[{id:"p1",debtId:"loan",debtIndex:0,amount:10000,dueMonth:"2026-01",monthKey:"2026-01"}]`);
run(`advanceDebtScheduleAfterPayment(S.debts[0],0)`);
assert.equal(run(`S.debts[0].nextPaymentDate`),"2026-02-28");
run(`S.payments.push({id:"p2",debtId:"loan",debtIndex:0,amount:10000,dueMonth:"2026-02",monthKey:"2026-02"});advanceDebtScheduleAfterPayment(S.debts[0],0)`);
assert.equal(run(`S.debts[0].nextPaymentDate`),"2026-03-31");

// Projection must preserve 31st -> Feb last day -> 31st -> Apr last day.
run(`S.payments=[];S.debts[0].nextPaymentDate="2026-01-31";S.debts[0].nextPaymentAmount=10000`);
const dates=run(`debtEventsBetween(new Date(2026,0,1),new Date(2026,3,30,23,59,59)).map(x=>x.dateKey)`);
assert.deepEqual(Array.from(dates),["2026-01-31","2026-02-28","2026-03-31","2026-04-30"]);

// A matched actual income replaces the planned estimate for that event, even when the actual amount differs.
run(`S=deepClone(DEFAULT_STATE);S.settings.incomeEvents=[{id:"salary",day:15,label:"Salary",amount:50000}];S.incomeLogs=[{id:"i1",dateKey:"2026-09-10",date:"2026-09-10T12:00:00",amount:30000,plannedEventId:"salary",plannedMonth:"2026-09",source:"Salary"}]`);
assert.equal(run(`plannedIncomeForecastAmount(S.settings.incomeEvents[0],2026,8,new Date(2026,8,14,12))`),0);
assert.equal(run(`plannedIncomeForecastAmount(S.settings.incomeEvents[0],2026,8,new Date(2026,8,16,12))`),0);

// Immediate-payment scenarios must target the highest EFFECTIVE rate, not the raw headline rate.
run(`S=deepClone(DEFAULT_STATE);S.settings.monthlyDebtGoal=50000;S.debts=[
{id:"parts",name:"Parts",balance:100000,initial:100000,rate:10,min:5000,dueDay:10,nextPaymentDate:"2026-10-10",nextPaymentAmount:5000,paymentMode:"fixed",parts:[{id:"x",name:"promo ended",balance:100000,rate:60}]},
{id:"plain",name:"Plain",balance:100000,initial:100000,rate:50,min:5000,dueDay:10,nextPaymentDate:"2026-10-10",nextPaymentAmount:5000,paymentMode:"fixed",parts:[]}
]`);
assert.equal(run(`highestRateDebtIndex()`),0);
assert.equal(run(`simulateWithImmediatePayment(10000).debt.id`),"parts");

console.log("OK — Stage 2.3 finance correctness: fixed due-day schedule, matched-income closure, effective-rate priority");
