"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname,read=n=>fs.readFileSync(path.join(root,n),"utf8");

const core=read("core.js"),pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json")),
      manifest=read("manifest.webmanifest"),html=read("index.html"),vite=read("vite.config.mjs"),
      bootstrap=read("bootstrap.js"),playwright=read("playwright.config.mjs");

assert.ok(core.includes('APP_VERSION="13.9.1"'));
assert.equal(pkg.version,"13.9.1");
assert.equal(lock.version,"13.9.1");
assert.equal(lock.packages?.[""]?.version,"13.9.1");
assert.ok(manifest.includes("Life RPG 13.9.1"));
assert.ok(html.includes("<title>Life RPG 13.9.1</title>"));
assert.ok(html.includes('window.__LIFE_RPG_HTML_VERSION__="13.9.1"'));
assert.ok(vite.includes('cacheId:"life-rpg-13.9.1"'));
assert.ok(pkg.scripts.test.includes("release-13.9.1.test.js"));
assert.ok(playwright.includes("release-13.9.1.e2e.test.js"));

for(const f of ["report-start-hotfix.js","ui-polish-13.7.5.js","README.txt",
  ".github/workflows/fix-report-start-race-13.7.5.yml",
  ".github/workflows/release-hotfix-13.7.5- v3.yml"]){
  assert.ok(!fs.existsSync(path.join(root,f)),`${f} must be removed`);
}
assert.ok(!bootstrap.includes("report-start-hotfix.js")&&!bootstrap.includes("ui-polish-13.7.5.js"));
assert.ok(!vite.includes("report-start-hotfix.js")&&!vite.includes("ui-polish-13.7.5.js"));

const RealDate=Date,FIXED="2026-09-28T12:00:00+02:00";
class FixedDate extends RealDate{
  constructor(...args){super(...(args.length?args:[FIXED]))}
  static now(){return new RealDate(FIXED).getTime()}
  static parse(v){return RealDate.parse(v)}
  static UTC(...args){return RealDate.UTC(...args)}
}

const ctx=vm.createContext({
  console,Date:FixedDate,Math,JSON,Intl,Number,Promise,
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,
  document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}}},
  navigator:{},location:{reload:()=>{}},
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  Notification:function(){},confirm:()=>true,prompt:()=>"",Blob:global.Blob,URL:global.URL
});
ctx.window.window=ctx.window;ctx.window.document=ctx.document;
for(const f of ["core.js","state.js","finance.js"])
  new vm.Script(fs.readFileSync(path.join(root,f),"utf8"),{filename:f}).runInContext(ctx);
const run=x=>new vm.Script(x).runInContext(ctx);

run(`S=deepClone(DEFAULT_STATE);
S.settings.reportStart="2026-10-01";
S.settings.campaignStart="2026-10-01";
S.settings.monthlyDebtGoal=91000;
S.settings.monthlyIncome=150000;
S.settings.incomeEvents=[
{id:"d5",day:5,label:"Доход 5",amount:50000},
{id:"d15",day:15,label:"Доход 15",amount:50000},
{id:"d20",day:20,label:"Доход 20",amount:50000}
];
S.envelopeLimits={"Еда":17000,"Транспорт":10000,"Дом":0,"Связь":2000,"Развлечения":1000,"Теннис":9000,"Покупки":2000,"Другое":8000};
S.envelopeCarryovers={"2026-10":{"Еда":1234}};
S.debts=[{id:"d",name:"D",balance:100000,initial:100000,rate:50,rateKnown:true,min:5000,dueDay:10,nextPaymentDate:"2026-10-10",nextPaymentAmount:5000,paymentMode:"fixed",parts:[]}];
S.payments=[{id:"oldp",localDate:"2026-09-15",monthKey:"2026-09",amount:1000,debtId:"d",debtIndex:0}];
S.expenses=[{id:"olde",dateKey:"2026-09-20",amount:999,category:"Еда"},{id:"newe",dateKey:"2026-10-02",amount:100,category:"Еда"}];
S.incomeLogs=[{id:"oldi",dateKey:"2026-09-20",amount:1000},{id:"newi",dateKey:"2026-10-05",amount:50000}];`);

assert.equal(run(`reportStartKey()`),"2026-10-01");
assert.equal(run(`reportingDateAllowed("2026-09-30")`),false);
assert.equal(run(`reportingDateAllowed("2026-10-01")`),true);
assert.equal(run(`monthExpenses("2026-09")`),0);
assert.equal(run(`monthIncome("2026-09")`),0);
assert.equal(run(`monthPayments("2026-09")`),0);
assert.equal(run(`monthCategorySpend("Еда","2026-09")`),0);
assert.equal(run(`monthExpenses("2026-10")`),100);
assert.equal(run(`monthIncome("2026-10")`),50000);
assert.equal(run(`envelopeCarry("Еда","2026-10")`),0);
assert.equal(run(`plannedIncomeForMonth()`),150000);
assert.equal(run(`plannedExtraDebtOnDate(new Date(2026,8,28,12))`),0);
assert.equal(run(`projectedDailyLiving(new Date(2026,8,28,12))`),0);
assert.equal(run(`remainingMinimumsThisMonth()`),0);
assert.equal(run(`financeMonthMetrics("2026-09").debtGoal`),0);
assert.equal(run(`financialPhase().id`),"scheduled");
assert.equal(run(`cashAdvice().recommended`),0);
assert.equal(run(`autopilotPlan().debtExtra`),0);
assert.equal(run(`nextPlannedIncomeDate(new Date(2026,8,28,12)).monthKey`),"2026-10");

const normalized=run(`(()=>{
  const x=deepClone(DEFAULT_STATE);
  x.settings.reportStart="2026-10-01";
  x.settings.campaignStart="2026-10-01";
  x.expenses=[{id:"hist",dateKey:"2026-09-20",amount:10,category:"Еда"}];
  x.xpEvents=[
    {id:"xpold",date:"2026-09-20T12:00:00",xp:100,stat:"Финансы"},
    {id:"xpnew",date:"2026-10-02T12:00:00",xp:50,stat:"Финансы"}
  ];
  x.xpEarned=150;
  return normalizeState(x)
})()`);
assert.equal(normalized.expenses.length,1,"factual pre-start history must be preserved");
assert.equal(normalized.xpEvents.length,0,"campaign XP must remain zero before reportStart");
assert.equal(normalized.xpEarned,0);

console.log("OK — Life RPG 13.9.1 release gate: version alignment, native report boundary, finance invariants and history preservation");
