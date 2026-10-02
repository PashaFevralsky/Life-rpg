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
  "verifiedAt",
  "financeRebuild14ProtectedSnapshot",
  "financeRebuild14AssertProtectedState",
  "financeRebuild14RestoreProgressFromPreRebuild"
]) assert.ok(src.includes(token),`missing ${token}`);

const ctx={
  console,Date,Math,Number,String,Array,Object,Set,Map,JSON,Promise,
  globalThis:null,structuredClone:global.structuredClone,
  deepClone:global.structuredClone,
  STATE_VERSION:18,
  validateStateShape:()=>true,
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



/* Finance-only replacement must preserve the entire non-financial progression domain. */
ctx.S={
  version:18,
  profile:{name:"Павел",goal:"Тест"},
  settings:{
    primaryAccountId:"old-main",monthlyIncome:99999,monthlyDebtGoal:777,
    workMonthlyPlan:5000000,campaignStart:"2026-09-01",reportStart:"2026-09-01",
    reportStartMigration:"report-boundary-core-v1",reportStartCleanupVersion:"13.9.1-core",
    reportStartEnvelopeFixVersion:"13.9.1-core",
    tennisElo:1234,tennisBaseElo:1000,tennisMonthlyTarget:12,readingDailyMin:30,
    lifeOps:{notificationsEnabled:true,closeTime:"20:30",followupTime:"22:00"}
  },
  xpEarned:3450,xpSpent:50,
  stats:{Финансы:400,Карьера:1500,Разум:500,Теннис:700,Тело:350,Отношения:0,Дисциплина:0},
  xpEvents:[{id:"xp1",date:"2026-09-20T12:00:00Z",xp:1000,stat:"Карьера"}],
  questDone:{"2026-10-01":true},
  achievements:{a:"2026-09-20T12:00:00Z"},rewardPurchases:[{id:"r1",cost:50,date:"2026-10-01"}],
  workLogs:[{id:"w1",dateKey:"2026-10-01"}],tennis:[{id:"t1",dateKey:"2026-10-01"}],
  books:[{id:"b1",title:"Book"}],readingLogs:[{id:"rl1",dateKey:"2026-10-01"}],
  crmDeals:[{id:"c1",name:"Client"}],workTargets:{contacts:20},
  entities:{projects:[{id:"p1"}],tasks:[{id:"task1"}],goals:[],routines:[],routineLogs:[],reviews:[],inbox:[],calendarEvents:[]},
  checks:{"2026-10-02":{lifeOps:{confirmations:{expenses:true,income:true,payments:true,work:true,training:true},closed:true}}},
  accounts:[{id:"old-main",name:"Old",type:"Счёт",verifiedBalance:1,verifiedAt:"2026-10-02T00:00:00Z",active:true}],
  debts:[],regularPayments:[],assets:[],envelopeLimits:{"Еда":1},envelopeCarryovers:{},
  payments:[],expenses:[],incomeLogs:[],bankImportIds:[],screenshotImportIds:[],bankTransfers:[],
  financeClosures:[],cashAdjustments:[],reservations:[],fundTransfers:[],assetTransfers:[],
  importBatches:[],reconciliationSessions:[],importRules:[],auditLog:[],trash:[],
  created:"2026-09-01T00:00:00Z",updated:"2026-10-02T00:00:00Z"
};
ctx.pkg=good;
assert.equal(run(`(()=>{
  const before=financeRebuild14ProtectedSnapshot(S);
  const after=financeRebuild14BaseState(financeRebuild14NormalizePackage(pkg));
  financeRebuild14AssertProtectedState(before,after);
  return JSON.stringify(financeRebuild14Canonical(before))===JSON.stringify(financeRebuild14Canonical(financeRebuild14ProtectedSnapshot(after)));
})()`),true,"Finance Rebuild changed protected non-financial state");

assert.equal(run(`financeRebuild14BaseState(financeRebuild14NormalizePackage(pkg)).xpEarned`),3450);
assert.equal(run(`financeRebuild14BaseState(financeRebuild14NormalizePackage(pkg)).workLogs.length`),1);
assert.equal(run(`financeRebuild14BaseState(financeRebuild14NormalizePackage(pkg)).tennis.length`),1);
assert.equal(run(`financeRebuild14BaseState(financeRebuild14NormalizePackage(pkg)).books.length`),1);
assert.equal(run(`financeRebuild14BaseState(financeRebuild14NormalizePackage(pkg)).entities.tasks.length`),1);

console.log("OK — Finance Rebuild non-financial preservation gate passed");

console.log("OK — Life RPG 14.0 Finance Rebuild contracts: validated package, baseline requirements and future-fact blocker");
