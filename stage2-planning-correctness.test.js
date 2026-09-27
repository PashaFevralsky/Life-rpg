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
  confirm:()=>true,prompt:()=>"",Blob:global.Blob,URL:global.URL,
  lifeOsSettingNumber:(k,f)=>f,reviewCurrent:()=>false,
  activeAccounts:()=>[],accountBalanceById:()=>0,debtById:()=>null,
  workXpOnDate:()=>0,readingBaseXpOnDate:()=>0
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","state.js","projects-os.js","goals-os.js","calendar-os.js"])new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

run(`localDateKey=()=> "2026-03-28"`);
assert.equal(run(`projectDaysTo("2026-03-30")`),2);
assert.equal(run(`projectDateKey("2026-02-31")`),"");
const ph=run(`projectHealth({deadline:"2026-03-30",nextDate:"",progress:10,createdAt:"2026-03-01T12:00:00",updatedAt:"2026-03-27T12:00:00"})`);
assert.equal(ph.deadlineDays,2);
assert.equal(ph.overdueDeadline,false);

const gn=run(`goalNormalize({id:"g",deadline:"2026-02-31",projectIds:["p","p",""],createdAt:"2026-03-01T12:00:00"})`);
assert.equal(gn.deadline,"");
assert.deepEqual(Array.from(gn.projectIds),["p"]);

run(`S.entities.projects=[]`);
const gh=run(`goalHealth(goalNormalize({id:"g2",title:"G",deadline:"2026-03-30",createdAt:"2026-03-01T12:00:00",manualProgress:10,projectIds:[]}))`);
assert.equal(gh.days,2);

assert.equal(run(`calendarNormalizeManual({id:"c",title:"Bad",dateKey:"2026-02-31"}).dateKey`),"");
assert.equal(run(`calendarNormalizeManual({id:"c",title:"Good",dateKey:"2028-02-29"}).dateKey`),"2028-02-29");

run(`S=deepClone(DEFAULT_STATE);S.entities={
  projects:[{id:"p1",title:"Closed",status:"done",deadline:"",nextDate:""}],
  tasks:[{id:"t1",title:"Still open",status:"active",projectId:"p1",blockedByIds:[],dueDate:"",plannedDate:"",notBefore:""}],
  goals:[],calendarEvents:[]
}`);
const issues=run(`dataIntegrityIssues().map(x=>x.title)`);
assert.ok(Array.from(issues).some(x=>x.includes("Активная задача привязана к закрытому проекту")));

console.log("OK — Stage 2.5 planning correctness: DST-safe deadlines, strict dates, closed-project diagnostics");
