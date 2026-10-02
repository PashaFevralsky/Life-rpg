"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert"),src=fs.readFileSync("finance-rebuild-14.js","utf8");

for(const token of [
  'FINANCE_REBUILD14_FORMAT="life-rpg-finance-rebuild-v1"',
  "createPreActionSnapshot",
  "commitStateAtomically",
  "financeRebuild14PackageIssues",
  "financeRebuild14CurrentAudit",
  "ЗАМЕНИТЬ ФИНАНСЫ",
  "reservations",
  "bankImportIds",
  "balanceVerifiedAt",
  "verifiedAt"
]) assert.ok(src.includes(token),`missing ${token}`);

const ctx={
  console,Date,Math,Number,String,Array,Object,Set,Map,JSON,Promise,
  globalThis:null,structuredClone:global.structuredClone,
  deepClone:global.structuredClone,
  DEFAULT_STATE:{settings:{},envelopeLimits:{"Еда":0},accounts:[{id:"main",name:"Основной",type:"Счёт",verifiedBalance:null,verifiedAt:"",active:true}]},
  localDateKey:()=>"2026-10-02",
  validDateKey:s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||""))&&s<="2026-12-31",
  isSafeStateId:s=>String(s||"").length>0&&!/[\s'"<>`\\]/.test(String(s)),
  moneySum:a=>(a||[]).reduce((s,x)=>s+(+x||0),0),
  moneySub:(a,b)=>(+a||0)-(+b||0),
  rub:n=>`${Math.round(+n||0)} ₽`,
  escapeHtml:String,
  S:{settings:{},accounts:[],debts:[],regularPayments:[],assets:[],checks:{}}
};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const run=x=>vm.runInContext(x,ctx);

const good={
  format:"life-rpg-finance-rebuild-v1",version:1,
  settings:{primaryAccountId:"main",incomeEvents:[{day:5,label:"Зарплата",amount:50000}]},
  accounts:[{id:"main",name:"Основной",verifiedBalance:10000,verifiedAt:"2026-10-02T10:00:00Z",active:true}],
  debts:[{id:"d1",name:"Карта",balance:1000,initial:1000,rate:20,rateKnown:true,min:100,nextPaymentDate:"2026-10-10",nextPaymentAmount:100,balanceVerifiedAt:"2026-10-02T10:00:00Z"}],
  regularPayments:[{name:"Связь",amount:500,dueDay:9}],
  transactions:[{dateKey:"2026-10-01",amount:100,type:"expense",description:"Тест",accountId:"main"}]
};
ctx.pkg=good;
assert.equal(run(`financeRebuild14NormalizePackage(pkg).format`),"life-rpg-finance-rebuild-v1");
assert.equal(run(`financeRebuild14PackageIssues(financeRebuild14NormalizePackage(pkg)).blocker`),0);
assert.equal(run(`financeRebuild14Counts(financeRebuild14NormalizePackage(pkg)).transactions`),1);

ctx.bad={...good,accounts:[{id:"main",name:"Основной",verifiedBalance:10000,verifiedAt:""}]};
assert.ok(run(`financeRebuild14PackageIssues(financeRebuild14NormalizePackage(bad)).blocker`)>=1);

ctx.future={...good,transactions:[{dateKey:"2026-10-03",amount:100,type:"expense",description:"Будущее",accountId:"main"}]};
assert.ok(run(`financeRebuild14PackageIssues(financeRebuild14NormalizePackage(future)).blocker`)>=1);

assert.throws(()=>run(`financeRebuild14NormalizePackage({format:"wrong",version:1})`),/ожидается format/);

console.log("OK — Life RPG 14.0 Finance Rebuild contracts: validated package, baseline requirements and future-fact blocker");
