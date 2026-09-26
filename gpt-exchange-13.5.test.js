"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert");
const source=fs.readFileSync("gpt-exchange-13.5.js","utf8");

assert.ok(source.includes("life-rpg-gpt-context-v1"));
assert.ok(source.includes("life-rpg-gpt-response-v1"));
assert.ok(source.includes("createPreActionSnapshot"));
assert.ok(source.includes("taskCreate"));
assert.ok(source.includes("addCalendarPlan"));
assert.ok(source.includes("GPT Exchange"));
assert.ok(source.includes("delete S.settings.aiBridge134"));
assert.ok(source.includes('localStorage.removeItem("lifeRpgAiBridge134AccessToken")'));
assert.equal(/\bfetch\s*\(/.test(source),false,"GPT Exchange must not call network fetch");
assert.equal(/workers\.dev|env\.AI|OPENAI_API_KEY|BRIDGE_ACCESS_TOKEN/.test(source),false,"No backend/API configuration allowed");

const context={
  console,Date,Math,JSON,Set,Map,WeakSet,
  S:{settings:{},entities:{tasks:[],calendarEvents:[]},accounts:[],debts:[],crmDeals:[],tennis:[],books:[]},
  clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  validDateKey:x=>/^\d{4}-\d{2}-\d{2}$/.test(x),
  localDateKey:()=> "2026-09-26",
  APP_VERSION:"13.2.2",STATE_VERSION:18
};
context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:"gpt-exchange-13.5.js"});

const normalized=vm.runInContext(`gpt135NormalizeResponse({
  format:"life-rpg-gpt-response-v1",version:1,packageId:"pkg-test",summary:"План",
  tasks:[{title:"Позвонить клиенту",area:"Работа",priority:1,plannedDate:"2026-09-26",minutes:30,note:"Следующий шаг"}],
  calendar:[{title:"Тренировка",type:"Тренировка",dateKey:"2026-09-27",minutes:90,priority:2}],
  recommendations:["Не перегружать день"],assumptions:["Срок сделки не подтверждён"]
})`,context);
assert.equal(normalized.tasks.length,1);assert.equal(normalized.tasks[0].area,"Работа");assert.equal(normalized.tasks[0].priority,1);
assert.equal(normalized.calendar.length,1);assert.equal(normalized.calendar[0].dateKey,"2026-09-27");
assert.equal(normalized.recommendations[0].title,"Не перегружать день");

const schema=vm.runInContext("gpt135ResponseSchema()",context);
assert.equal(schema.format,"life-rpg-gpt-response-v1");
assert.ok(schema.tasks&&schema.calendar);

assert.throws(()=>vm.runInContext(`gpt135NormalizeResponse({format:"bad"})`,context),/Нужен формат/);
assert.throws(()=>vm.runInContext(`gpt135NormalizeResponse({format:"life-rpg-gpt-response-v1",calendar:[{title:"x",dateKey:"2026-09-20"}]})`,context),/в прошлом/);

console.log("GPT Exchange 13.5 tests: OK");
