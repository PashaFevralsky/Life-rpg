"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const RealDate=Date,FIXED="2026-03-30T12:00:00+02:00";
class FixedDate extends RealDate{constructor(...a){super(...(a.length?a:[FIXED]))}static now(){return new RealDate(FIXED).getTime()}}
const root=__dirname,els={};
const context=vm.createContext({
  console,Date:FixedDate,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,Blob:global.Blob,URL:global.URL,
  document:{getElementById:id=>els[id]||null,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>({}),addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{}},navigator:{},location:{},localStorage:{getItem:()=>null,setItem:()=>{}},
  confirm:()=>true,prompt:()=>"",toast:()=>{},audit:()=>{},save:async()=>{},render:()=>{},escapeHtml:String,
  workMonth:()=>({sales:0,contacts:0,followups:0,lpr:0,meetings:0,proposals:0,wins:0,pipeline:0}),
  workWeek:()=>({sales:0,contacts:0,followups:0,lpr:0,meetings:0,proposals:0,wins:0,pipeline:0}),
  monthIncome:()=>0,monthExpenses:()=>0,monthPayments:()=>0,totalDebt:()=>0,
  financialHealthData:()=>({p:{cashGapDate:""},fresh:0}),crmForecastData:()=>({plan:0,sales:0,coverage:0}),crmOverdue:()=>[],
  dataIntegrityIssues:()=>[],decisionEngineData:()=>({p:{cashGapDate:""}}),projectSummary:()=>({active:0,atRisk:0,overdue:0,avg:0}),
  projectStore:()=>[],projectCompletedThisMonth:()=>0,taskSummary:()=>({active:0,overdue:0,due:0,high:0,doneMonth:0}),
  goalSummary:()=>({active:0,atRisk:0,overdue:0,avg:0,doneMonth:0}),routine28Stats:()=>({scheduled:0,done:0,rate:0}),
  executionPlan:()=>({unscheduled:[],late:[],critical:0,capacityFactor:1}),calibrationSummary:()=>null,
  lifeOsDailyPlan:()=>({hardAll:[],deferred:[],plan:[]}),lifeOsCandidates:()=>[],habitStrengthRows:()=>[],
  currentBook:()=>context.S.books.find(x=>x.status==="reading")||null,nextQueuedBook:()=>null,
  compactRub:n=>String(n),rub:n=>String(n),pct:n=>String(n),workTarget:(k,f)=>f,
  addXp:()=>{},removeXp:()=>{},syncAutoDailyQuests:()=>{},trashPush:()=>{},createPreActionSnapshot:async()=>1,
  sessionMatches:x=>Array.isArray(x.matches)?x.matches:[],sessionWinLoss:x=>({w:0,l:0}),
  tennisHuaweiAll:()=>[]
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","tennis.js","knowledge.js","gamification.js","personal-os.js","inbox-os.js","journal-os.js","life-os.js","review-os.js","tennis-decision.js"])
  new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

run(`S={
  settings:{readingDailyMin:30,readingWeeklyDaysTarget:5,readingReviewDays:7,tennisMonthlyTarget:12,tennisWeeklyTarget:3,personalOS:{journal:[],decisions:[],people:[],interactions:[],timeboxes:[],focusSessions:[],chores:[],choreLogs:[],inventory:[],shopping:[],importFingerprints:[],dashboard:{order:[],hidden:[],compact:false},activeFocus:{}}},
  entities:{tasks:[],reviews:[],inbox:[]},checks:{},workLogs:[],payments:[],incomeLogs:[],expenses:[],crmDeals:[],xpEvents:[],stats:{Карьера:0},
  books:[{id:"b",title:"Book",status:"reading",totalPages:100,currentPage:0}],
  readingLogs:[
    {id:"past",bookId:"b",dateKey:"2026-03-28",minutes:30,pages:10,note:"past",application:"use"},
    {id:"future",bookId:"b",dateKey:"2026-03-31",minutes:300,pages:90,note:"future",application:"future"},
    {id:"bad",bookId:"b",dateKey:"2026-02-31",minutes:300,pages:90,note:"bad",application:"bad"}
  ],
  tennis:[
    {id:"tp",dateKey:"2026-03-28",createdAt:"2026-03-28T12:00:00",min:60,load:5,type:"Тренировка",matches:[]},
    {id:"tf",dateKey:"2026-03-31",createdAt:"2026-03-31T12:00:00",min:120,load:9,type:"Турнир",matches:[]},
    {id:"tb",dateKey:"2026-02-31",createdAt:"2026-02-28T12:00:00",min:120,load:9,type:"Турнир",matches:[]}
  ]
}`);

// Book progress and knowledge base derive from factual reading sessions only.
run(`recomputeBookProgress("b")`);
assert.equal(run(`S.books[0].currentPage`),10);
assert.equal(run(`knowledgeFactualReadingLogs().length`),1);
assert.equal(run(`knowledgeReviewQueue().length`),1);

// Month and decision metrics ignore same-month future tennis/reading facts.
const month=run(`currentMonthReport()`);
assert.equal(month.tennis,1);
assert.equal(month.tournaments,0);
assert.equal(month.readMinutes,30);
assert.equal(run(`tennisDecision22Sessions(30).length`),1);
assert.equal(run(`tennisDecision22MonthPace(new Date()).sessions`),1);

// Journal weekly summary also uses factual domain rows.
const jw=run(`journalWeekSummary()`);
assert.equal(jw.readMin,30);
assert.equal(jw.tennis,1);
assert.equal(jw.tennisMin,60);

// Life OS reads the same factual sources.
const score=run(`lifeScore()`);
assert.ok(score.details.find(x=>x.name==="Теннис").reason.includes("месяц 1/12"));
assert.ok(score.details.find(x=>x.name==="Знания").reason.includes("применений 1"));

// Impossible explicit inbox date is sanitized, and age uses calendar days across DST.
assert.equal(run(`inboxNormalize({text:"x",dateKey:"2026-02-31"}).dateKey`),"");
assert.equal(run(`inboxAgeDays({createdAt:"2026-03-28T23:30:00+01:00"})`),2);
assert.equal(run(`personalDaysSince("2026-03-28T23:30:00+01:00")`),2);

// Review age is calendar-based too.
run(`S.entities.reviews=[{id:"rw",kind:"week",periodKey:"old",savedAt:"2026-03-23T23:30:00+01:00",plan:{focusAreas:["Работа"],focusProjectIds:[],pauseProjectIds:[]}}]`);
assert.equal(run(`reviewDaysSince(S.entities.reviews[0].savedAt)`),7);
assert.equal(run(`reviewNeedsWeekly()`),true);

console.log("OK — Stage 2.12 factual consistency: future/invalid facts excluded and calendar-day ages aligned");
