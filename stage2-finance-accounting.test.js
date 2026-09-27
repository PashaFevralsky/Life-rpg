"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname,els={emergencyMoveAmount:{value:"100"}};
const context=vm.createContext({
  console,Date,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,
  document:{getElementById:id=>els[id]||null,querySelectorAll:()=>[],addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}}},
  navigator:{},location:{reload:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  Notification:function(){},confirm:()=>true,prompt:()=>"",Blob:global.Blob,URL:global.URL,
  audit:()=>{},toast:()=>{},checkAchievements:()=>false,render:()=>{}
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","state.js","finance.js"])new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
context.save=async()=>{};
context.persist=async()=>{};
context.audit=()=>{};
context.toast=()=>{};
const run=code=>new vm.Script(code).runInContext(context);

(async()=>{
  run(`S=deepClone(DEFAULT_STATE);S.settings.incomeEvents=[{id:"e",day:31,label:"Month end",amount:25000}]`);
  assert.equal(run(`plannedIncomeToDate(new Date(2026,1,27,12))`),0);
  assert.equal(run(`plannedIncomeToDate(new Date(2026,1,28,12))`),25000);
  assert.equal(run(`plannedIncomeToDate(new Date(2026,3,30,12))`),25000);

  run(`S=deepClone(DEFAULT_STATE);S.regularPayments=[{id:"r",name:"Rent",amount:50000,dueDay:5,mandatory:true,active:true}];S.expenses=[{id:"x",dateKey:"2027-01-02",amount:50000,regularPaymentId:"r"}]`);
  const jan=run(`regularPaymentsBefore(new Date(2027,0,10,12),new Date(2026,11,20,12)).filter(x=>localDateKey(x.date)==="2027-01-05")`);
  assert.equal(jan.length,0);

  run(`S=deepClone(DEFAULT_STATE);S.accounts=[{id:"a",name:"A",verifiedBalance:1000,verifiedAt:"2026-09-01T00:00:00Z",active:true},{id:"b",name:"B",verifiedBalance:2000,verifiedAt:"2026-09-01T00:00:00Z",active:true}];S.settings.primaryAccountId="a";S.regularPayments=[{id:"rent",name:"Rent",amount:100,dueDay:1,category:"Дом",mandatory:true,active:true}];`);
  await run(`payRegularPayment("rent")`);
  assert.equal(run(`S.expenses[0].accountId`),"a");
  run(`S.settings.primaryAccountId="b"`);
  assert.equal(run(`S.expenses[0].accountId`),"a");

  els.emergencyMoveAmount.value="100";
  run(`S.settings.primaryAccountId="a";S.settings.emergencyFundBalance=0;S.reservations=[]`);
  await run(`moveEmergencyFund("toFund")`);
  assert.equal(run(`S.fundTransfers[0].accountId`),"a");
  run(`S.settings.primaryAccountId="b"`);
  assert.equal(run(`S.fundTransfers[0].accountId`),"a");

  const migrated=run(`(()=>{const x=deepClone(DEFAULT_STATE);x.accounts=[{id:"main",name:"Main",verifiedBalance:null,verifiedAt:"",active:true},{id:"a",name:"A",verifiedBalance:1000,verifiedAt:"2026-09-01T00:00:00Z",active:true}];x.settings.primaryAccountId="a";x.fundTransfers=[{id:"f",date:"2026-09-20T12:00:00",direction:"toFund",amount:100}];x.cashAdjustments=[{id:"c",date:"2026-09-20T12:00:00",delta:50}];return normalizeState(x)})()`);
  assert.equal(migrated.fundTransfers[0].accountId,"a");
  assert.equal(migrated.cashAdjustments[0].accountId,"a");

  console.log("OK — Stage 2.4 finance accounting: account attribution, short-month income, year boundary");
})().catch(e=>{console.error(e);process.exit(1)});
