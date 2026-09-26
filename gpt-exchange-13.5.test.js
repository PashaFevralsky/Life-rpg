"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert");
const base=fs.readFileSync("gpt-exchange-13.5.js","utf8");
const ext=fs.readFileSync("gpt-exchange-guidance-13.5.1.js","utf8");

assert.equal(/\bfetch\s*\(/.test(base+ext),false,"GPT Exchange must remain offline");
assert.equal(/workers\.dev|env\.AI|OPENAI_API_KEY|BRIDGE_ACCESS_TOKEN/.test(ext),false,"Guidance layer must not add backend/API configuration");
assert.ok(ext.includes("todayTop3")&&ext.includes("weekFocus")&&ext.includes("guardrails")&&ext.includes("domainNotes"));
assert.ok(ext.includes("gpt1351EnsureLifeOsLayer"));
assert.ok(ext.includes("previousGpt"));

const context={
  console,Date,Math,JSON,Set,Map,WeakSet,
  S:{settings:{},entities:{tasks:[],calendarEvents:[]},accounts:[],debts:[],crmDeals:[],tennis:[],books:[]},
  clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  validDateKey:x=>/^\d{4}-\d{2}-\d{2}$/.test(x),
  localDateKey:()=> "2026-09-26",
  APP_VERSION:"13.2.2",STATE_VERSION:18
};
context.globalThis=context;vm.createContext(context);
vm.runInContext(base,context,{filename:"gpt-exchange-13.5.js"});
vm.runInContext(ext,context,{filename:"gpt-exchange-guidance-13.5.1.js"});

const schema=vm.runInContext("gpt135ResponseSchema()",context);
assert.equal(schema.format,"life-rpg-gpt-response-v1");
assert.ok(schema.guidance&&schema.guidance.todayTop3&&schema.guidance.weekFocus);

const normalized=vm.runInContext(`gpt135NormalizeResponse({
  format:"life-rpg-gpt-response-v1",version:1,packageId:"pkg-test",summary:"План",
  tasks:[],calendar:[],recommendations:[],assumptions:[],
  guidance:{
    headline:"Главное — ликвидность",
    validThrough:"2026-10-02",
    todayTop3:[{title:"Сверить деньги",area:"Финансы",reason:"Есть отрицательный прогноз"}],
    weekFocus:[{title:"CRM",area:"Работа",outcome:"Все открытые сделки имеют следующий шаг"}],
    guardrails:["Не повышать необязательные расходы"],
    domainNotes:[{area:"Финансы",status:"critical",title:"Кассовый риск",detail:"Нужна сверка"}],
    reviewPrompt:"Повторить обмен после обновления остатков"
  }
})`,context);
assert.equal(normalized.guidance.todayTop3.length,1);
assert.equal(normalized.guidance.todayTop3[0].area,"Финансы");
assert.equal(normalized.guidance.domainNotes[0].status,"critical");
assert.equal(normalized.guidance.validThrough,"2026-10-02");

vm.runInContext("gpt135Store()",context);
context.S.settings.gptExchange135.activeGuidance={...normalized.guidance,appliedAt:"2026-09-26T12:00:00Z",packageId:"pkg-test"};
const exported=vm.runInContext("gpt135BuildContext()",context);
assert.ok(exported.previousGpt);
assert.equal(exported.previousGpt.activeGuidance.headline,"Главное — ликвидность");
assert.ok(exported.sources.includes("Previous GPT Exchange"));

const backward=vm.runInContext(`gpt135NormalizeResponse({
  format:"life-rpg-gpt-response-v1",version:1,packageId:"old",summary:"Старый ответ",
  tasks:[],calendar:[],recommendations:[],assumptions:[]
})`,context);
assert.equal(backward.guidance,null,"Old 13.5 responses must remain valid");

console.log("GPT Exchange 13.5.1 guidance tests: OK");
