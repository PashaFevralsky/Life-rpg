"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),{webcrypto}=require("node:crypto"),{TextEncoder}=require("node:util");

const source=fs.readFileSync("secure-ai-bridge-13.4.js","utf8"),worker=fs.readFileSync("ai-bridge-worker.mjs","utf8"),memory=new Map();
const context={
  console,crypto:webcrypto,TextEncoder,URL,WeakSet,structuredClone,
  localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},
  document:{getElementById(){return null},querySelector(){return null},activeElement:null},
  globalThis:null,
  APP_VERSION:"13.2.2",STATE_VERSION:18,
  S:{settings:{},debts:[{name:"Debt",remaining:100,rate:10,password:"never"}],crmDeals:[{name:"Deal",potential:500000,nextDate:"2026-09-25"}],books:[],tennis:[],entities:{tasks:[]}},
  localDateKey:()=>"2026-09-26",
  lifeOsDailyPlan:()=>({plan:[{id:"t1",area:"Работа",title:"Позвонить",score:90,hard:false,evidence:["CRM"]}],deferred:[],minutes:15,overload:false}),
  lifeOsGuardrails:()=>["guardrail"],
  calendarDayLoad:()=>({minutes:60,capacity:300}),
  decisionEngineData:()=>({p:{cashGapDate:""},apiKey:"must-redact"}),
  buildFinancialProjection:()=>({endingBalance:1000}),
  work121PaceForecast:()=>({plan:100,paceForecast:90}),
  tennisLoadProfile:()=>({ratio:1.1}),
  training129LoadProfile:()=>({ratio:1.0}),
  training129SuggestedWeek:()=>({days:3}),
  readingConsistencyData:()=>({weeklyDays:4}),
  knowledgeReviewQueue:()=>[],
  lifeOsRawCandidates:()=>[],
  intelligence132RankCandidates:()=>[],
  intelligence132Anomalies:()=>[],
  intelligence1321CalibrationSummary:()=>({sufficient:false}),
  intelligence1321Drift:()=>({status:"insufficient"}),
  predictive1322Forecasts:()=>[{key:"work-pace",domain:"work",horizon:7,title:"Темп",riskScore:50,confidence:70}],
  predictive1322Verification:()=>({n:0}),
  dataIntegrityIssues:()=>[],
  recovery133SafeModeActive:()=>false,
  escapeHtml:x=>String(x??""),toast(){},audit(){},persist:async()=>{},
  setTimeout,clearTimeout
};
context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:"secure-ai-bridge-13.4.js"});

(async()=>{
  assert.equal(vm.runInContext('ai134NormalizeBaseUrl("https://bridge.example.test/v1/ask")',context),"https://bridge.example.test");
  assert.throws(()=>vm.runInContext('ai134NormalizeBaseUrl("http://bridge.example.test")',context),/HTTPS/);
  const plain=vm.runInContext('ai134Plain({ok:1,apiKey:"x",nested:{token:"y",value:2},password:"z"})',context);
  assert.deepEqual(JSON.parse(JSON.stringify(plain)),{ok:1,nested:{value:2}});
  vm.runInContext('ai134SetToken("bridge-secret")',context);
  assert.equal(vm.runInContext('ai134Token()',context),"bridge-secret");
  assert.equal(JSON.stringify(context.S).includes("bridge-secret"),false,"bridge token must not be stored in state/backups");
  const fact=vm.runInContext('ai134BuildContext()',context);
  assert.equal(fact.protocol,"life-rpg-secure-ai-bridge-v1");assert.equal(fact.stateVersion,18);
  assert.equal(JSON.stringify(fact).includes("must-redact"),false,"secret-like fields must be redacted");
  const req=await vm.runInContext('ai134BuildRequest("Что делать сегодня?","today")',context);
  assert.equal(req.body.protocol,"life-rpg-secure-ai-bridge-v1");assert.match(req.contextHash,/^sha256:/);assert.equal(req.body.attachments.length,0);
  assert.equal(source.includes("api.openai.com"),false,"client must never call OpenAI directly");
  assert.equal(source.includes("OPENAI_API_KEY"),false,"provider key must not exist in PWA module");
  assert.ok(worker.includes('env.OPENAI_API_KEY'));assert.ok(worker.includes('env.BRIDGE_ACCESS_TOKEN'));assert.ok(worker.includes('https://api.openai.com/v1/responses'));assert.ok(worker.includes('store:false'));assert.ok(worker.includes('gpt-6-luna'));
  assert.ok(fs.readFileSync("bootstrap.js","utf8").includes('"secure-ai-bridge-13.4.js"'));
  assert.ok(fs.readFileSync("bootstrap.js","utf8").includes('["ensureAi134Ui","renderAi134"]'));
  assert.ok(fs.readFileSync("vite.config.mjs","utf8").includes('"secure-ai-bridge-13.4.js"'));
  assert.ok(JSON.parse(fs.readFileSync("package.json","utf8")).scripts.test.includes("secure-ai-bridge-13.4.test.js"));
  assert.ok(fs.readFileSync("playwright.config.mjs","utf8").includes("secure-ai-bridge-13.4.e2e.test.js"));
  console.log("Secure AI Bridge 13.4 tests: OK")
})().catch(e=>{console.error(e);process.exit(1)});
