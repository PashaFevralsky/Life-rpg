"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),{webcrypto}=require("node:crypto"),{TextEncoder}=require("node:util");

const source=fs.readFileSync("secure-ai-bridge-13.4.js","utf8"),workerSource=fs.readFileSync("ai-bridge-worker.mjs","utf8"),memory=new Map();
const context={
  console,crypto:webcrypto,TextEncoder,URL,WeakSet,structuredClone,navigator:{},
  localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},
  document:{getElementById(){return null},querySelector(){return null},activeElement:null},
  globalThis:null,APP_VERSION:"13.2.2",STATE_VERSION:18,
  S:{settings:{},debts:[{name:"Debt",remaining:100,rate:10,password:"never"}],crmDeals:[{name:"Deal",potential:500000,nextDate:"2026-09-25"}],books:[],tennis:[],entities:{tasks:[]}},
  localDateKey:()=>"2026-09-26",
  lifeOsDailyPlan:()=>({plan:[{id:"t1",area:"Работа",title:"Позвонить",score:90,hard:false,evidence:["CRM"]}],deferred:[],minutes:15,overload:false}),
  lifeOsGuardrails:()=>["guardrail"],calendarDayLoad:()=>({minutes:60,capacity:300}),
  decisionEngineData:()=>({p:{cashGapDate:""},apiKey:"must-redact"}),buildFinancialProjection:()=>({endingBalance:1000}),
  work121PaceForecast:()=>({plan:100,paceForecast:90}),tennisLoadProfile:()=>({ratio:1.1}),training129LoadProfile:()=>({ratio:1.0}),
  training129SuggestedWeek:()=>({days:3}),readingConsistencyData:()=>({weeklyDays:4}),knowledgeReviewQueue:()=>[],
  lifeOsRawCandidates:()=>[],intelligence132RankCandidates:()=>[],intelligence132Anomalies:()=>[],intelligence1321CalibrationSummary:()=>({sufficient:false}),
  intelligence1321Drift:()=>({status:"insufficient"}),predictive1322Forecasts:()=>[{key:"work-pace",domain:"work",horizon:7,title:"Темп",riskScore:50,confidence:70}],
  predictive1322Verification:()=>({n:0}),dataIntegrityIssues:()=>[],recovery133SafeModeActive:()=>false,
  escapeHtml:x=>String(x??""),toast(){},audit(){},persist:async()=>{},setTimeout,clearTimeout
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
  assert.equal(fact.protocol,"life-rpg-secure-ai-bridge-v1");assert.equal(fact.stateVersion,18);assert.equal(JSON.stringify(fact).includes("must-redact"),false);
  const req=await vm.runInContext('ai134BuildRequest("Что делать сегодня?","today")',context);
  assert.match(req.contextHash,/^sha256:/);assert.equal(req.body.attachments.length,0);assert.equal(req.body.client.module,"Free AI Bridge 13.4.1");
  const share=await vm.runInContext('(async()=>{const c=ai134BuildContext(),h=await ai134Hash(c);return ai134SharePrompt("Что делать?","today",c,h)})()',context);
  assert.match(share,/LIFE RPG → CHATGPT/);assert.match(share,/FACT_PACK/);assert.match(share,/Что делать/);
  assert.equal(source.includes("api.openai.com"),false);assert.equal(workerSource.includes("api.openai.com"),false);
  assert.equal(/OPENAI_API_KEY|OPENAI_MODEL|OPENAI_REASONING/.test(workerSource),false,"paid provider configuration must be absent");
  assert.ok(workerSource.includes("env.AI.run"));assert.ok(workerSource.includes("env.AI.toMarkdown"));
  assert.ok(workerSource.includes("@cf/zai-org/glm-4.7-flash"));assert.ok(workerSource.includes("@cf/google/gemma-4-26b-a4b-it"));
  assert.ok(source.includes("ai134ShareToChatGPT"));assert.ok(source.includes("Поделиться → ChatGPT"));
  assert.ok(fs.readFileSync("bootstrap.js","utf8").includes('"secure-ai-bridge-13.4.js"'));
  assert.ok(JSON.parse(fs.readFileSync("package.json","utf8")).scripts.test.includes("secure-ai-bridge-13.4.test.js"));

  const mod=await import("./ai-bridge-worker.mjs?test="+Date.now());
  let ran=null,converted=false;
  const env={ALLOWED_ORIGINS:"https://pashafevralsky.github.io",BRIDGE_ACCESS_TOKEN:"t",AI:{
    async toMarkdown(docs){converted=true;return docs.map(d=>({name:d.name,format:"text",data:"converted file",tokens:2}))},
    async run(model,args){ran={model,args};return {choices:[{message:{content:"Бесплатный ответ"}}],usage:{input_tokens:10,output_tokens:3}}}
  }};
  let res=await mod.default.fetch(new Request("https://worker.test/health",{headers:{Origin:"https://pashafevralsky.github.io"}}),env);
  let data=await res.json();assert.equal(res.status,200);assert.equal(data.provider,"cloudflare-workers-ai");assert.equal(data.tokenRequired,true);
  const body={protocol:"life-rpg-secure-ai-bridge-v1",requestId:"x",mode:"general",question:"test",context:{sources:["test"]},contextHash:"sha256:x",sharedText:"",attachments:[{name:"a.txt",mime:"text/plain",dataUrl:"data:text/plain;base64,dGVzdA=="}]};
  res=await mod.default.fetch(new Request("https://worker.test/v1/ask",{method:"POST",headers:{Origin:"https://pashafevralsky.github.io","Content-Type":"application/json","X-Life-RPG-Token":"t"},body:JSON.stringify(body)}),env);
  data=await res.json();assert.equal(res.status,200);assert.equal(data.answer,"Бесплатный ответ");assert.equal(data.model,"@cf/zai-org/glm-4.7-flash");assert.equal(converted,true);assert.equal(ran.model,"@cf/zai-org/glm-4.7-flash");
  res=await mod.default.fetch(new Request("https://worker.test/v1/ask",{method:"POST",headers:{Origin:"https://pashafevralsky.github.io","Content-Type":"application/json"},body:JSON.stringify(body)}),env);
  assert.equal(res.status,401);

  console.log("Free AI Bridge 13.4.1 tests: OK")
})().catch(e=>{console.error(e);process.exit(1)});
