"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert"),root=__dirname,read=n=>fs.readFileSync(path.join(root,n),"utf8");
const intel=read("intelligence-13.2.js"),calib=read("intelligence-calibration-13.2.1.js"),core=read("core.js"),boot=read("bootstrap.js"),vite=read("vite.config.mjs"),life=read("life-os.js"),pkg=JSON.parse(read("package.json")),play=read("playwright.config.mjs"),manifest=read("manifest.webmanifest");
assert.ok(core.includes('APP_VERSION="13.2.1"'));assert.ok(core.includes("STATE_VERSION=18"));assert.ok(manifest.includes("Life RPG 13.2.1"));assert.ok(vite.includes('cacheId:"life-rpg-13.2.1"'));
assert.ok(boot.includes('"intelligence-calibration-13.2.1.js"'));assert.ok(boot.includes('["ensureIntelligence1321Ui","renderIntelligence1321"]'));assert.ok(vite.includes('"intelligence-calibration-13.2.1.js"'));assert.ok(life.includes("intelligence1321SelectPlan"));
for(const name of ["intelligence1321CalibrationSummary","intelligence1321ConfidenceBuckets","intelligence1321ProviderHealth","intelligence1321FreshnessMonitor","intelligence1321Drift","intelligence1321SelectPlan","intelligence1321WhyNot","intelligence1321WeeklyReview","intelligence1321ResetLearning","intelligence1321ManualOverride"])assert.ok(calib.includes(`function ${name}`),`${name} missing`);
assert.ok(!/fetch\(["'`]https?:/i.test(calib),"Calibration layer must stay local-first");assert.ok(pkg.scripts.test.includes("intelligence-calibration-13.2.1.test.js"));assert.ok(play.includes("intelligence-calibration-13.2.1.e2e.test.js"));

const RealDate=Date,ctx={console,Date:RealDate,Math,Number,String,Array,Object,Map,Set,JSON,Promise,TextEncoder,TextDecoder,URL,Blob,crypto:global.crypto,
  S:{settings:{},accounts:[],expenses:[],incomeLogs:[],payments:[],workLogs:[],tennis:[],readingLogs:[],crmDeals:[],entities:{}},document:{getElementById(){return null},querySelector(){return null},activeElement:null,createElement(){return {click(){},set href(v){this._href=v},get href(){return this._href},download:""}}},navigator:{},globalThis:null,
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),validDateKey:s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||"")),localDateKey(d=new RealDate()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},addDays(d,n){const x=new RealDate(d);x.setDate(x.getDate()+n);return x},parseLocal(s){const [y,m,d]=s.split("-").map(Number);return new RealDate(y,m-1,d,12)},uid:()=>"u"+Math.random().toString(36).slice(2),rub:n=>`${Math.round(+n||0)} ₽`,escapeHtml:String,decisionToken:encodeURIComponent,audit(){},save:async()=>{},render(){},renderIntelligence132(){},toast(){},confirm:()=>true,ux7Go(){},lifeOsRegisterCandidateProvider(){},lifeOsRegisterRouteHandler(){},accountsModeActive:()=>true,taskAll:()=>[],training129Quality:()=>({sessions:10}),training129LoadProfile:()=>({interpretable:true,ratio:1,weeklyBase:1000,acute:{load:700},baseSessions:8}),calendarOverloadedDays:()=>[],decisionEngineData:()=>({p:{cashGapDate:""}}),buildFinancialProjection:()=>({minBalance:1000,cashGapDate:"",endingBalance:500}),calendarDayLoad:()=>({minutes:100,capacity:180}),URL:{createObjectURL:()=>"blob:x",revokeObjectURL(){}},setTimeout(){},lifeOsRawCandidates:()=>[]};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(intel,ctx);vm.runInContext(calib,ctx);const run=code=>vm.runInContext(code,ctx);

// Utility calibration and execution are deliberately separate.
run(`intelligence132Store().journal=[
 {type:"exposure",dateKey:localDateKey(),candidateId:"a",signature:"work|next",area:"Работа",source:"Work",score:90,confidenceScore:90,outcome:"helped",outcomeAt:new Date().toISOString()},
 {type:"exposure",dateKey:localDateKey(),candidateId:"b",signature:"work|next",area:"Работа",source:"Work",score:88,confidenceScore:80,outcome:"no-effect",outcomeAt:new Date().toISOString()},
 {type:"exposure",dateKey:localDateKey(),candidateId:"c",signature:"tasks|task",area:"Система",source:"Tasks",score:70,confidenceScore:70,outcome:"done",outcomeAt:new Date().toISOString()},
 {type:"exposure",dateKey:localDateKey(),candidateId:"d",signature:"tasks|task",area:"Система",source:"Tasks",score:65,confidenceScore:65,outcome:"missed",outcomeAt:new Date().toISOString()}
]`);
let summary=JSON.parse(run(`JSON.stringify(intelligence1321CalibrationSummary())`));assert.equal(summary.evaluatedUtility,2);assert.equal(summary.executionN,2);assert.equal(summary.helpRate,.5);assert.equal(summary.executionRate,.5);assert.ok(summary.brier>0);
const providers=JSON.parse(run(`JSON.stringify(intelligence1321ProviderHealth())`));assert.ok(providers.some(x=>x.provider==="Work"&&x.utilityN===2));

// Top-3 budget preserves HARD commitments and keeps a reserve.
let sel=JSON.parse(run(`JSON.stringify(intelligence1321SelectPlan([
 {id:"h",area:"Финансы",score:130,hard:true},{id:"w",area:"Работа",score:100,hard:false},{id:"t",area:"Тело",score:90,hard:false},{id:"k",area:"Знания",score:80,hard:false},{id:"w2",area:"Работа",score:70,hard:false}
]))`));assert.equal(sel.primary.length,3);assert.equal(sel.primary[0].id,"h");assert.ok(sel.reserve.length>=1);assert.ok(sel.primary.some(x=>x.area==="Работа")&&sel.primary.some(x=>x.area==="Тело"));
sel=JSON.parse(run(`JSON.stringify(intelligence1321SelectPlan([{id:"1",area:"Финансы",score:130,hard:true},{id:"2",area:"Финансы",score:129,hard:true},{id:"3",area:"Работа",score:128,hard:true},{id:"4",area:"Система",score:127,hard:true}]))`));assert.equal(sel.primary.length,4);assert.equal(sel.overload,true);

// Repeated manual override is weak, bounded and never affects HARD candidates.
run(`intelligence132Store().calibration={overrides:[0,1,2,3,4].map(i=>({signature:"knowledge|read",at:new Date().toISOString()})),policy:{overrideMinSamples:3,overrideCap:4,learningCap:8,minOutcomeSamples:3}}`);
assert.ok(run(`intelligence1321OverrideAdjustment({area:"Знания",kind:"read",hard:false})`)<=-2);assert.equal(run(`intelligence1321OverrideAdjustment({area:"Знания",kind:"read",hard:true})`),0);

// Safe reset creates a learning boundary but preserves the raw journal.
const before=run(`intelligence132Store().journal.length`);run(`intelligence132Store().candidateState={x:{score:90}}`);run(`intelligence1321Store().learningResetAt=new Date().toISOString();intelligence132Store().candidateState={};intelligence1321Store().overrides=[]`);assert.equal(run(`intelligence132Store().journal.length`),before);assert.equal(run(`Object.keys(intelligence132Store().candidateState).length`),0);

// Drift uses only enough samples and distinguishes distribution/score movement.
run(`(()=>{const st=intelligence132Store();st.journal=[];for(let i=0;i<12;i++)st.journal.push({type:"exposure",dateKey:localDateKey(addDays(new Date(),-(8+i))),area:i%2?"Работа":"Финансы",score:55,confidenceScore:65});for(let i=0;i<7;i++)st.journal.push({type:"exposure",dateKey:localDateKey(addDays(new Date(),-i)),area:"Работа",score:90,confidenceScore:88})})()`);
const drift=JSON.parse(run(`JSON.stringify(intelligence1321Drift())`));assert.equal(drift.status,"drift");assert.ok(drift.scoreDelta>15);assert.ok(drift.distributionShift>0);

// Proxy diagnostics are explicitly conservative.
run(`intelligence132Store().journal=[{type:"exposure",title:"FP",outcome:"no-effect",score:95,confidenceScore:90,rank:1},{type:"exposure",title:"Under",outcome:"helped",score:55,confidenceScore:70,rank:4}]`);const proxy=JSON.parse(run(`JSON.stringify(intelligence1321FalseSignalProxies())`));assert.equal(proxy.falsePositive.length,1);assert.equal(proxy.underPrioritized.length,1);
console.log("OK — Intelligence Calibration & Control 13.2.1: calibration, provider health, Top-3, drift, overrides and safe reset passed");
