"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname;
const context=vm.createContext({
  console,Date,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,
  document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{},activeElement:null,body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}}},
  navigator:{},location:{reload:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  confirm:()=>true,prompt:()=>"",Blob:global.Blob,URL:global.URL
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","state.js","work.js","work-growth.js"])new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

// Legacy/imported CRM is normalized once: invalid dates removed, closed-stage probabilities fixed.
const normalized=run(`normalizeState({crmDeals:[
  {id:"w",name:"Won",stage:"Выиграно",potential:600000,probability:35,nextDate:"2026-02-31",closeDate:"2026-13-01",decisionDate:"2028-02-29",realizationDate:"2026-00-10"},
  {id:"l",name:"Lost",stage:"Проиграно",potential:-10,probability:80}
]}).crmDeals`);
assert.equal(normalized[0].probability,100);
assert.equal(normalized[1].probability,0);
assert.equal(normalized[1].potential,0);
assert.equal(normalized[0].nextDate,"");
assert.equal(normalized[0].closeDate,"");
assert.equal(normalized[0].decisionDate,"2028-02-29");
assert.equal(normalized[0].realizationDate,"");

// Open stages preserve custom user probability; closed stages are deterministic.
assert.equal(run(`crmProbabilityForStage("Тендер",42)`),42);
assert.equal(run(`crmProbabilityForStage("Выиграно",42)`),100);
assert.equal(run(`crmProbabilityForStage("Проиграно",42)`),0);

// Invalid next dates are not overdue; they are treated as missing/invalid.
run(`S=deepClone(DEFAULT_STATE);S.crmDeals=[{id:"d",name:"Bad date",potential:600000,stage:"Тендер",probability:50,nextStep:"Позвонить",nextDate:"2026-02-31",closeDate:"2026-02-31",city:"Екб",client:"A",investor:"B",manufacturers:"X",competitor:"Y",projectDocs:"Р",lpr:"Иван",updatedAt:new Date().toISOString()}]`);
assert.equal(run(`crmOverdue().length`),0);
assert.equal(run(`crmDecisionEngine()[0].kind`),"next");
const quality=run(`crmDataQuality()`);
assert.equal(quality.missingNext,1);
assert.equal(quality.noClose,1);

// Large-deal completeness cannot be satisfied by impossible dates.
const complete=run(`crmCompleteness(S.crmDeals[0])`);
assert.equal(complete.ok,false);
assert.ok(complete.done<complete.total);
const gaps=run(`work121LargeDealGaps(S.crmDeals[0])`);
assert.ok(Array.from(gaps).includes("Следующий шаг + дата"));
assert.ok(Array.from(gaps).includes("Дата решения / тендера / закрытия"));

// Work Growth health treats impossible dates as absent rather than parsing/ordering them.
const health=run(`work121DealHealth(S.crmDeals[0])`);
assert.ok(Array.from(health.reasons).some(x=>x.includes("нет следующего шага или даты")));
assert.ok(Array.from(health.reasons).some(x=>x.includes("нет даты закрытия")));

console.log("OK — Stage 2.6 CRM correctness: strict dates, deterministic closed stages, defensive quality scoring");
