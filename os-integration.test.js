"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname,els={};
const context=vm.createContext({
  console,Date,Math,JSON,Intl,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},requestAnimationFrame:fn=>{if(typeof fn==="function")fn();return 0},structuredClone:global.structuredClone,crypto:global.crypto,
  document:{getElementById:id=>els[id]||null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{},createElement:()=>({}),body:{classList:{add(){},remove(){},toggle(){}}},documentElement:{style:{setProperty(){}}},readyState:"complete"},
  window:{addEventListener:()=>{},removeEventListener:()=>{},scrollTo:()=>{},requestAnimationFrame:fn=>{if(typeof fn==="function")fn();return 0},location:{reload:()=>{},replace:()=>{}},LifePlatform:{refreshIcons(){},status(){return"test"}}},
  navigator:{},location:{reload:()=>{},replace:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},Notification:function(){},confirm:()=>true,prompt:()=>"300",alert(){},Blob:global.Blob,URL:global.URL
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","state.js","finance.js","imports.js","work.js","tennis.js","knowledge.js","gamification.js","pwa.js","ui.js"]){
  new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context)
}
const run=code=>new vm.Script(code).runInContext(context);
run(`ux7InstallShell=()=>{}; initUi=()=>{}; loadState=()=>{};`);
new vm.Script(fs.readFileSync(path.join(root,"bootstrap.js"),"utf8"),{filename:"bootstrap.js"}).runInContext(context);

(async()=>{
  // Knowledge: first review is immediate; after it, the next interval is 1 day, then 3 days.
  run(`S=deepClone(DEFAULT_STATE); S.settings.readingReviewDays=7; S.readingLogs=[{id:"k1",bookId:"b",dateKey:localDateKey(),minutes:30,pages:10,note:"Тезис",application:""}]; save=async()=>{}; audit=()=>{};`);
  assert.equal(run(`knowledgeReviewQueue().length`),1);
  assert.equal(run(`knowledgeReviewState(S.readingLogs[0]).interval`),1);
  await run(`markKnowledgeReviewed("k1")`);
  assert.equal(run(`S.readingLogs[0].reviewCount`),1);
  assert.equal(run(`knowledgeReviewState(S.readingLogs[0]).interval`),1);
  assert.equal(run(`knowledgeReviewQueue().length`),0);
  run(`S.readingLogs[0].reviewedAt=new Date(Date.now()-2*86400000).toISOString();`);
  assert.equal(run(`knowledgeReviewQueue().length`),1);
  await run(`markKnowledgeReviewed("k1")`);
  assert.equal(run(`S.readingLogs[0].reviewCount`),2);
  assert.equal(run(`knowledgeReviewState(S.readingLogs[0]).interval`),3);

  // Review backlog is not silently capped at 30.
  run(`S=deepClone(DEFAULT_STATE); S.readingLogs=Array.from({length:35},(_,i)=>({id:"r"+i,bookId:"b",dateKey:localDateKey(),minutes:1,pages:0,note:"n"+i}));`);
  assert.equal(run(`knowledgeReviewQueue().length`),35);

  // Knowledge weekly regularity compares days/week, not 28-day total against a weekly target.
  run(`S=deepClone(DEFAULT_STATE); S.settings.readingWeeklyDaysTarget=7; S.settings.readingDailyMin=30; S.readingLogs=[]; for(let i=0;i<8;i++)S.readingLogs.push({id:"d"+i,bookId:"b",dateKey:localDateKey(addDays(new Date(),-i*3)),minutes:30,pages:5});`);
  assert.ok(run(`knowledgeDecisionEngine().some(x=>x.kind==="consistency")`));

  // Month plan scales with configured reading days/week.
  run(`S.settings.readingWeeklyDaysTarget=5; S.settings.readingDailyMin=30;`);
  assert.equal(run(`knowledgeMonthData().planned`),run(`Math.round(new Date().getDate()*30*5/7)`));

  // CRM stale threshold uses the Work OS setting consistently.
  run(`S=deepClone(DEFAULT_STATE); S.settings.workStaleDays=30; S.crmDeals=[{id:"d",name:"Deal",potential:100000,stage:"Контакт",probability:20,nextStep:"Позвонить",nextDate:localDateKey(addDays(new Date(),2)),closeDate:"",updatedAt:new Date(Date.now()-20*86400000).toISOString()}];`);
  assert.equal(run(`crmDecisionEngine().some(x=>x.kind==="stale")`),false);
  run(`S.settings.workStaleDays=10;`);
  assert.equal(run(`crmDecisionEngine().some(x=>x.kind==="stale")`),true);

  // Life OS never hides hard obligations behind the configurable soft cap.
  run(`S=deepClone(DEFAULT_STATE); S.settings.lifeDailyPriorityLimit=2; lifeOsCandidates=()=>[
    {id:"h1",area:"Финансы",kind:"x",title:"H1",meta:"",score:150,hard:true,minutes:10},
    {id:"h2",area:"Работа",kind:"x",title:"H2",meta:"",score:140,hard:true,minutes:10},
    {id:"h3",area:"Система",kind:"x",title:"H3",meta:"",score:130,hard:true,minutes:10},
    {id:"h4",area:"Финансы",kind:"x",title:"H4",meta:"",score:120,hard:true,minutes:10},
    {id:"s1",area:"Знания",kind:"x",title:"S1",meta:"",score:70,hard:false,minutes:10}
  ];`);
  assert.equal(run(`lifeOsDailyPlan().plan.length`),4);
  assert.equal(run(`lifeOsDailyPlan().plan.every(x=>x.hard)`),true);
  assert.equal(run(`lifeOsDailyPlan().overload`),true);

  // Semantic IDs de-duplicate one underlying obligation even when wording differs.
  assert.equal(run(`lifeOsDedupCandidates([{id:"same",area:"Финансы",title:"A",score:100},{id:"same",area:"Финансы",title:"B",score:90}]).length`),1);

  // Life score explains the same configured weekly targets as the domain OS modules.
  run(`S=deepClone(DEFAULT_STATE); S.settings.tennisWeeklyTarget=4; S.settings.tennisMonthlyTarget=12; S.settings.readingWeeklyDaysTarget=7; S.tennis=[]; for(let i=0;i<3;i++)S.tennis.push({id:"t"+i,dateKey:localDateKey(addDays(new Date(),-i)),min:60,load:5}); S.readingLogs=[]; for(let i=0;i<3;i++)S.readingLogs.push({id:"q"+i,bookId:"b",dateKey:localDateKey(addDays(new Date(),-i)),minutes:30,pages:0});`);
  const details=run(`lifeScore().details`);
  assert.ok(details.find(x=>x.name==="Теннис").reason.includes("/4"));
  assert.ok(details.find(x=>x.name==="Знания").reason.includes("/7"));

  // Dynamically injected OS cards must participate in UX7 view switching.
  for(const file of ["work.js","tennis.js","knowledge.js","bootstrap.js"]){
    const src=fs.readFileSync(path.join(root,file),"utf8");
    const dynamic=[...src.matchAll(/data-ux7-view="[^"]+"\s+class="([^"]+)"/g)];
    assert.ok(dynamic.length>0,`${file}: no dynamic UX7 cards found`);
    assert.ok(dynamic.every(m=>m[1].split(/\s+/).includes("ux7-card")),`${file}: dynamic card missing ux7-card`);
  }

  console.log("OK — cross-domain OS integration tests passed");
})().catch(e=>{console.error(e);process.exit(1)});
