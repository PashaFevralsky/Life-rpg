"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const RealDate=Date,FIXED="2026-03-30T12:00:00+02:00";
class FixedDate extends RealDate{
  constructor(...args){super(...(args.length?args:[FIXED]))}
  static now(){return new RealDate(FIXED).getTime()}
}
const root=__dirname,growth={knowledgeNotes:[],trackers:[],events:[]};
const context=vm.createContext({
  console,Date:FixedDate,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,TextEncoder,TextDecoder,Blob:global.Blob,URL:global.URL,
  document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>({click(){}}),addEventListener:()=>{},activeElement:null,body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}},LifePlatform:{}},navigator:{},location:{reload:()=>{}},
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},confirm:()=>true,prompt:()=>"",
  growthData:()=>growth,lifeOsRegisterCandidateProvider:()=>{},lifeOsRegisterRouteHandler:()=>{},
  share131DownloadBlob:()=>{},audit:()=>{},save:async()=>{},render:()=>{},toast:()=>{},
  accountsModeActive:()=>true,activeAccounts:()=>[],accountBalanceById:()=>0,debtById:()=>null,rub:n=>`${Math.round(+n||0)} ₽`,
  training129Quality:()=>({sessions:0}),training129LoadProfile:()=>({interpretable:false}),
  taskAll:()=>[],calendarOverloadedDays:()=>[],calendarDayLoad:()=>({minutes:0,capacity:180,level:"ok"}),
  workPaceData:()=>({}),work121PaceForecast:()=>({}),buildFinancialProjection:()=>({}),operatingCashBalance:()=>0,
  lifeOsDailyPlan:()=>({plan:[]}),workXpOnDate:()=>0
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","state.js","knowledge.js","knowledge-growth.js","knowledge-decision.js","intelligence-13.2.js","predictive-trends-13.2.2.js"])
  new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

run(`S=deepClone(DEFAULT_STATE);S.settings.readingDailyMin=30;S.settings.readingWeeklyDaysTarget=5;S.books=[{id:"b",title:"B",status:"reading",totalPages:500,currentPage:20}];S.readingLogs=[
 {id:"r1",bookId:"b",dateKey:"2026-03-30",minutes:30,pages:10,note:"past",application:""},
 {id:"r2",bookId:"b",dateKey:"2026-04-01",minutes:300,pages:200,note:"future",application:""},
 {id:"r3",bookId:"b",dateKey:"2026-02-31",minutes:300,pages:200,note:"bad",application:""}
]`);
assert.equal(run(`knowledgeFactualReadingLogs().length`),1);
assert.equal(run(`readingWindowLogs(28).length`),1);
assert.equal(run(`readingPaceData().pages`),10);
assert.equal(run(`readingDaysThisWeek()`),1);
assert.equal(run(`knowledgeGrowthForecast().pages`),10);

run(`S.readingLogs=[{id:"rr",bookId:"b",dateKey:"2026-03-20",minutes:30,pages:5,note:"x",reviewedAt:"2026-03-28T23:30:00+01:00",reviewCount:1}]`);
const review=run(`knowledgeReviewState(S.readingLogs[0])`);
assert.equal(review.dueKey,"2026-03-29");
assert.equal(run(`knowledge124DaysOverdue("2026-03-28")`),2);

assert.equal(run(`intelligence132DaysSince("2026-04-01")`),null);
assert.equal(run(`intelligence132DaysSince("2026-03-28")`),2);

run(`S.expenses=[{dateKey:"2026-03-29",amount:1},{dateKey:"2026-01-01",amount:1},{dateKey:"2026-04-01",amount:1}];
S.incomeLogs=[{dateKey:"2026-03-29",amount:1},...Array.from({length:20},(_,i)=>({dateKey:"2025-12-"+String((i%20)+1).padStart(2,"0"),amount:1}))]`);
assert.equal(run(`intelligence132Observations({area:"Финансы"})`),2);

run(`S.readingLogs=[{dateKey:"2026-03-27"},{dateKey:"2026-04-10"},{dateKey:"2026-02-31"}]`);
assert.equal(run(`intelligence132CandidateDate({area:"Знания"})`),"2026-03-27");
assert.equal(run(`intelligence132Freshness({area:"Знания"}).days`),3);

assert.equal(run(`predictive1322DateDiff("2026-03-28","2026-03-30")`),2);
assert.equal(run(`predictive1322DaysOld("2026-04-01")`),null);
assert.equal(run(`predictive1322FreshnessScore("2026-04-01")`),45);

run(`S.readingLogs=[{id:"bad",bookId:"b",dateKey:"2026-02-31",minutes:30,pages:1}]`);
assert.ok(Array.from(run(`dataIntegrityIssues().map(x=>x.title)`)).some(x=>x.includes("Некорректная дата сессии чтения")));

console.log("OK — Stage 2.8 knowledge/intelligence correctness: factual dates, DST-safe review, bounded confidence windows");
