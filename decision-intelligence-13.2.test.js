"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert"),root=__dirname,read=n=>fs.readFileSync(path.join(root,n),"utf8");
const intel=read("intelligence-13.2.js"),core=read("core.js"),boot=read("bootstrap.js"),vite=read("vite.config.mjs"),life=read("life-os.js"),pkg=JSON.parse(read("package.json")),play=read("playwright.config.mjs"),manifest=read("manifest.webmanifest");
assert.ok(core.includes('APP_VERSION="13.2.1"'));assert.ok(core.includes("STATE_VERSION=18"));assert.ok(manifest.includes("Life RPG 13.2.1"));assert.ok(vite.includes('cacheId:"life-rpg-13.2.1"'));
assert.ok(boot.includes('"intelligence-13.2.js"'));assert.ok(boot.includes('["ensureIntelligence132Ui","renderIntelligence132"]'));assert.ok(vite.includes('"intelligence-13.2.js"'));assert.ok(life.includes('intelligence132RankCandidates'));
for(const name of ["intelligence132ConfidenceScore","intelligence132RankCandidates","intelligence132RecordOutcome","intelligence132LearningSummary","intelligence132Anomalies","intelligence132Scenario","intelligence132Counterfactual","intelligence132Hysteresis"])assert.ok(intel.includes(`function ${name}`),`${name} missing`);
assert.ok(!/fetch\(["'`]https?:/i.test(intel),"Decision Intelligence must remain local-first");assert.ok(pkg.scripts.test.includes("decision-intelligence-13.2.test.js"));assert.ok(play.includes("decision-intelligence-13.2.e2e.test.js"));

const realDate=Date;
const ctx={console,Date:realDate,Math,Number,String,Array,Object,Map,Set,JSON,Promise,TextEncoder,TextDecoder,URL,Blob,crypto:global.crypto,
  S:{settings:{},accounts:[],expenses:[],incomeLogs:[],payments:[],workLogs:[],tennis:[],readingLogs:[],crmDeals:[],entities:{}},
  document:{getElementById(){return null},querySelector(){return null},activeElement:null},navigator:{},globalThis:null,
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),validDateKey:s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||"")),
  localDateKey(d=new realDate()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},
  addDays(d,n){const x=new realDate(d);x.setDate(x.getDate()+n);return x},parseLocal(s){const [y,m,d]=s.split("-").map(Number);return new realDate(y,m-1,d,12)},
  uid:()=>"u"+Math.random().toString(36).slice(2),rub:n=>`${Math.round(+n||0)} ₽`,escapeHtml:String,decisionToken:encodeURIComponent,
  audit(){},save:async()=>{},renderIntelligence132(){},ux7Go(){},lifeOsRegisterCandidateProvider(){},lifeOsRegisterRouteHandler(){},
  accountsModeActive:()=>true,taskAll:()=>[],training129Quality:()=>({sessions:10}),training129LoadProfile:()=>({interpretable:true,ratio:1,weeklyBase:1000,acute:{load:700},baseSessions:8}),calendarOverloadedDays:()=>[],
  decisionEngineData:()=>({p:{cashGapDate:""}}),buildFinancialProjection:(days,opts={})=>({minBalance:(opts.oneOffExpense||0)>500?-100:1000,cashGapDate:(opts.oneOffExpense||0)>500?"2026-10-01":"",endingBalance:500}),calendarDayLoad:()=>({minutes:100,capacity:180})};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(intel,ctx);
const run=code=>vm.runInContext(code,ctx);

let ranked=JSON.parse(run(`JSON.stringify(intelligence132RankCandidates([
 {id:"finance:deadline",area:"Финансы",kind:"deadline",title:"Платёж сегодня",meta:"10 000 ₽",score:70,hard:true,minutes:10,confidence:"high"},
 {id:"knowledge:read",area:"Знания",kind:"read",title:"Чтение",meta:"30 минут",score:62,hard:false,minutes:30,confidence:"medium"}
]))`));
assert.equal(ranked[0].id,"finance:deadline");assert.ok(ranked[0].score>=120,"hard rule must stay above soft priorities");assert.equal(ranked[0].ruleType,"hard");assert.ok(ranked[0].confidenceScore>=80);assert.ok(Array.isArray(ranked[0].evidence)&&ranked[0].evidence.length>0);assert.ok(String(ranked[0].counterfactual).length>20);
assert.ok(Number.isFinite(ranked[1].urgency)&&Number.isFinite(ranked[1].impact)&&Number.isFinite(ranked[1].risk)&&Number.isFinite(ranked[1].effortCost));

run(`intelligence132Store().journal=[
 {signature:"knowledge|read",outcome:"helped"},{signature:"knowledge|read",outcome:"helped"},{signature:"knowledge|read",outcome:"done"}
]`);
const learn=JSON.parse(run(`JSON.stringify(intelligence132LearnedAdjustment({area:"Знания",kind:"read"}))`));assert.equal(learn.n,3);assert.ok(learn.adjustment>0&&learn.adjustment<=8,"learning adjustment must be bounded and outcome-based");

// A strong recent expense surge against a stable prior baseline should surface as an anomaly.
run(`(()=>{const f=(off,amount)=>({dateKey:localDateKey(addDays(new Date(),-off)),amount});S.expenses=[];for(let i=7;i<28;i++)S.expenses.push(f(i,100));for(let i=0;i<7;i++)S.expenses.push(f(i,350));})()`);
const anomalies=JSON.parse(run(`JSON.stringify(intelligence132Anomalies())`));assert.ok(anomalies.some(x=>x.id==="finance-spend-surge"),"expense anomaly missing");

const scenario=JSON.parse(run(`JSON.stringify(intelligence132Scenario({spend:1000,incomeFactor:100,trainingMinutes:60,trainingRpe:8,extraWorkMinutes:60,extraKnowledgeMinutes:30}))`));
assert.equal(scenario.finance.afterGap,"2026-10-01");assert.ok(scenario.training.projectedRatio>1);assert.ok(scenario.calendar.total>scenario.calendar.capacity);assert.ok(scenario.warnings.length>=2);

// Hysteresis: crossing a tier threshold by only a few points must not cause immediate oscillation.
run(`intelligence132Store().candidateState={"x":{tier:"high",score:62,lastSeen:new Date().toISOString()}}`);const h=run(`intelligence132Hysteresis({id:"x"},57)`);assert.ok(h>=61,"hysteresis did not hold prior tier near threshold");
console.log("OK — Decision Intelligence 13.2: evidence, confidence, hard/soft arbitration, outcome learning, anomalies, scenarios and hysteresis passed");
