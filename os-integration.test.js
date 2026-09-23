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
for(const file of ["data-os.js","projects-os.js","goals-os.js","review-os.js","calendar-os.js","tasks-os.js","routines-os.js","inbox-os.js","rules-os.js","insights-os.js","command-os.js","calibration-os.js","execution-os.js","decision-os.js","recovery-os.js","life-os.js"]){
  new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context)
}
const run=code=>new vm.Script(code).runInContext(context);
run(`window.__LIFE_RPG_MODULES_PRELOADED__=true; ux7InstallShell=()=>{}; initUi=()=>{}; loadState=async()=>{};`);
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
  run(`S=deepClone(DEFAULT_STATE); S.settings.lifeDailyPriorityLimit=2; globalThis.__realLifeOsCandidates=lifeOsCandidates; lifeOsCandidates=()=>[
    {id:"h1",area:"Финансы",kind:"x",title:"H1",meta:"",score:150,hard:true,minutes:10},
    {id:"h2",area:"Работа",kind:"x",title:"H2",meta:"",score:140,hard:true,minutes:10},
    {id:"h3",area:"Система",kind:"x",title:"H3",meta:"",score:130,hard:true,minutes:10},
    {id:"h4",area:"Финансы",kind:"x",title:"H4",meta:"",score:120,hard:true,minutes:10},
    {id:"s1",area:"Знания",kind:"x",title:"S1",meta:"",score:70,hard:false,minutes:10}
  ];`);
  assert.equal(run(`lifeOsDailyPlan().plan.length`),4);
  assert.equal(run(`lifeOsDailyPlan().plan.every(x=>x.hard)`),true);
  assert.equal(run(`lifeOsDailyPlan().overload`),true);
  run(`lifeOsCandidates=globalThis.__realLifeOsCandidates; delete globalThis.__realLifeOsCandidates;`);

  // Semantic IDs de-duplicate one underlying obligation even when wording differs.
  assert.equal(run(`lifeOsDedupCandidates([{id:"same",area:"Финансы",title:"A",score:100},{id:"same",area:"Финансы",title:"B",score:90}]).length`),1);

  // Life score explains the same configured weekly targets as the domain OS modules.
  run(`S=deepClone(DEFAULT_STATE); S.settings.tennisWeeklyTarget=4; S.settings.tennisMonthlyTarget=12; S.settings.readingWeeklyDaysTarget=7; S.tennis=[]; for(let i=0;i<3;i++)S.tennis.push({id:"t"+i,dateKey:localDateKey(addDays(new Date(),-i)),min:60,load:5}); S.readingLogs=[]; for(let i=0;i<3;i++)S.readingLogs.push({id:"q"+i,bookId:"b",dateKey:localDateKey(addDays(new Date(),-i)),minutes:30,pages:0});`);
  const details=run(`lifeScore().details`);
  assert.ok(details.find(x=>x.name==="Теннис").reason.includes("/4"));
  assert.ok(details.find(x=>x.name==="Знания").reason.includes("/7"));

  // Projects OS: v17 project data migrates into entities, overdue high-priority actions are hard,
  // completion awards result XP once, and Life OS receives a routable project action.
  run(`S=normalizeState({version:17,settings:{projects:[{id:"persist",title:"Persist",area:"Работа",priority:2,status:"active",progress:20,nextStep:"Шаг"}]}});`);
  assert.equal(run(`projectStore().length`),1);
  assert.equal(run(`projectStore()[0].title`),"Persist");

  run(`S=deepClone(DEFAULT_STATE); S.entities.projects=[{id:"p1",title:"Проект 1",area:"Работа",priority:1,status:"active",progress:30,nextStep:"Позвонить",nextDate:localDateKey(addDays(new Date(),-1)),deadline:localDateKey(addDays(new Date(),5)),createdAt:new Date(Date.now()-5*86400000).toISOString(),updatedAt:new Date(Date.now()-2*86400000).toISOString()}]; save=async()=>{}; audit=()=>{}; toast=()=>{};`);
  assert.equal(run(`projectDecisionEngine()[0].kind`),"project-next");
  assert.equal(run(`projectDecisionEngine()[0].hard`),true);
  assert.ok(run(`lifeOsRawCandidates().some(x=>String(x.id).startsWith("project:p1:")&&x.route==="projects")`));

  const xpBefore=run(`S.xpEarned`);
  await run(`completeProject("p1")`);
  const xpAfter=run(`S.xpEarned`);
  assert.ok(xpAfter>xpBefore);
  await run(`completeProject("p1")`);
  assert.equal(run(`S.xpEarned`),xpAfter);
  assert.equal(run(`projectStore()[0].status`),"done");
  assert.equal(run(`projectStore()[0].progress`),100);

  // Review / Planning OS: snapshots, WIP recommendations, persistence and plan -> Life OS.
  run(`S=deepClone(DEFAULT_STATE); S.entities.projects=[
    {id:"rp1",title:"High",area:"Работа",priority:1,status:"active",progress:30,nextStep:"Шаг 1",nextDate:localDateKey(addDays(new Date(),2)),deadline:localDateKey(addDays(new Date(),10)),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},
    {id:"rp2",title:"Low 1",area:"Личное",priority:3,status:"active",progress:10,nextStep:"Шаг 2",createdAt:new Date(Date.now()-20*86400000).toISOString(),updatedAt:new Date(Date.now()-20*86400000).toISOString()},
    {id:"rp3",title:"Low 2",area:"Знания",priority:3,status:"active",progress:5,nextStep:"Шаг 3",createdAt:new Date(Date.now()-20*86400000).toISOString(),updatedAt:new Date(Date.now()-20*86400000).toISOString()}
  ]; S.settings.reviewProjectWipLimit=2; S.entities.reviews=[]; save=async()=>{}; audit=()=>{}; toast=()=>{};`);
  assert.equal(run(`reviewPauseCandidates().length`),1);
  assert.equal(run(`reviewSnapshot("week").projects.active`),3);
  assert.ok(run(`reviewSuggestedPlan().focusProjectIds.includes("rp1")`));

  await run(`saveReview("week")`);
  assert.equal(run(`reviewStore().length`),1);
  assert.equal(run(`reviewStore()[0].kind`),"week");
  assert.ok(run(`Array.isArray(reviewStore()[0].plan.focusAreas)`));
  const reviewXp=run(`S.xpEarned`);
  await run(`saveReview("week")`);
  assert.equal(run(`S.xpEarned`),reviewXp);

  // A saved focus project becomes a routable Life OS candidate even without deadline urgency.
  run(`S.entities.reviews[0].plan={focusAreas:["Работа"],focusProjectIds:["rp1"],pauseProjectIds:[],generatedAt:new Date().toISOString()};`);
  assert.ok(run(`reviewPlanCandidates().some(x=>x.projectId==="rp1")`));
  assert.ok(run(`lifeOsRawCandidates().some(x=>x.projectId==="rp1"&&x.route==="projects")`));

  // Review history survives v17 -> v18 entity migration.
  run(`S=normalizeState({version:17,settings:{reviews:[{id:"rw",kind:"week",periodKey:"x",savedAt:new Date().toISOString(),snapshot:{lifeScore:50},plan:{focusAreas:["Работа"],focusProjectIds:[]}}]}});`);
  assert.equal(run(`reviewStore().length`),1);
  assert.equal(run(`reviewStore()[0].id`),"rw");

  // Calendar / Timeline OS: persistence, recurrence, automatic deadlines,
  // overload detection and Life OS routing for today's manual plan.
  run(`S=deepClone(DEFAULT_STATE); S.entities.calendarEvents=[]; S.settings.calendarDailyCapacityMin=180; S.settings.calendarHorizonDays=30; save=async()=>{}; audit=()=>{}; toast=()=>{};`);
  const made=run(`addCalendarPlan({title:"Тренировка",dateKey:localDateKey(),type:"Тренировка",minutes:120,priority:1,note:"зал",repeatWeeks:3})`);
  assert.equal(made.length,3);
  assert.equal(run(`calendarStore().length`),3);
  assert.equal(run(`calendarStore()[1].dateKey`),run(`localDateKey(addDays(new Date(),7))`));
  assert.ok(run(`calendarDecisionEngine().some(x=>x.kind==="calendar-today"&&x.area==="Теннис")`));
  assert.ok(run(`lifeOsRawCandidates().some(x=>x.route==="calendar"&&x.area==="Теннис")`));

  // A second commitment pushes today's estimated active load above capacity.
  run(`addCalendarPlan({title:"Личное дело",dateKey:localDateKey(),type:"Личное",minutes:90,priority:2,repeatWeeks:1});`);
  assert.equal(run(`calendarDayLoad(localDateKey()).level`),"bad");
  assert.ok(run(`calendarOverloadedDays(1).length`)>0);

  // Project/CRM dates appear automatically without manual calendar duplication.
  run(`S.entities.projects=[{id:"cp",title:"Проект срок",area:"Работа",priority:2,status:"active",progress:20,nextStep:"Шаг",nextDate:localDateKey(addDays(new Date(),2)),deadline:localDateKey(addDays(new Date(),5)),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]; S.crmDeals=[{id:"cd",name:"CRM срок",stage:"Контакт",potential:100000,probability:20,nextStep:"Позвонить",nextDate:localDateKey(addDays(new Date(),3)),closeDate:localDateKey(addDays(new Date(),10))}];`);
  assert.ok(run(`calendarEvents(14,0).some(x=>x.source==="project"&&x.refId==="cp")`));
  assert.ok(run(`calendarEvents(14,0).some(x=>x.source==="crm"&&x.refId==="cd")`));

  // Calendar data survives v17 -> v18 entity migration.
  run(`S=normalizeState({version:17,settings:{calendarEvents:[{id:"ce",title:"Persist calendar",type:"Тренировка",dateKey:localDateKey(),minutes:60,priority:2,status:"planned"}],calendarDailyCapacityMin:240,calendarHorizonDays:45}});`);
  assert.equal(run(`calendarStore().length`),1);
  assert.equal(run(`calendarCapacity()`),240);
  assert.equal(run(`calendarHorizon()`),45);

  // Tasks OS: overdue high-priority task becomes hard, calendar sees the due date,
  // completion awards XP once and state v17 normalizes to v18 without losing settings data.
  run(`S=normalizeState({version:17,settings:{tasks:[{id:"legacy-task",title:"Legacy",area:"Работа",priority:2,status:"active",dueDate:"",minutes:20}]}});`);
  assert.equal(run(`S.version`),18);
  assert.equal(run(`taskStore()[0].title`),"Legacy");
  run(`S=deepClone(DEFAULT_STATE); S.entities.tasks=[]; save=async()=>{}; audit=()=>{}; toast=()=>{}; var tt=taskCreate({title:"Срочная задача",area:"Работа",priority:1,dueDate:localDateKey(addDays(new Date(),-1)),minutes:25});`);
  assert.equal(run(`taskDecisionEngine()[0].hard`),true);
  assert.ok(run(`calendarEvents(7,7).some(x=>x.source==="task"&&x.refId===tt.id)`));
  const taskXpBefore=run(`S.xpEarned`);await run(`completeTask(tt.id)`);const taskXpAfter=run(`S.xpEarned`);assert.ok(taskXpAfter>taskXpBefore);await run(`completeTask(tt.id)`);assert.equal(run(`S.xpEarned`),taskXpAfter);

  // Inbox: inference + routing to Task and CRM.
  run(`S=deepClone(DEFAULT_STATE); S.entities.inbox=[]; S.entities.tasks=[]; save=async()=>{}; audit=()=>{}; toast=()=>{}; var ib=inboxCapture("позвонить клиенту завтра");`);
  assert.equal(run(`ib.area`),"Работа");assert.equal(run(`ib.dateKey`),run(`localDateKey(addDays(new Date(),1))`));
  await run(`inboxToTask(ib.id)`);assert.equal(run(`taskStore().length`),1);assert.equal(run(`inboxOpen().length`),0);
  run(`var ib2=inboxCapture("обновить коммерческое предложение завтра"); S.crmDeals=[{id:"deal1",name:"Deal",stage:"Контакт",nextStep:"",nextDate:""}]; document.getElementById=id=>id==="inboxCrm_"+ib2.id?{value:"deal1"}:null;`);
  await run(`inboxToCrm(ib2.id)`);assert.equal(run(`S.crmDeals[0].nextStep`),"обновить коммерческое предложение завтра");

  // Rules OS: cross-domain overload rule fires, domain-delegated rules stay descriptive.
  run(`S=deepClone(DEFAULT_STATE); S.entities.calendarEvents=[]; S.settings.calendarDailyCapacityMin=120; addCalendarPlan({title:"A",dateKey:localDateKey(addDays(new Date(),1)),type:"Личное",minutes:90,priority:2,repeatWeeks:1}); addCalendarPlan({title:"B",dateKey:localDateKey(addDays(new Date(),1)),type:"Тренировка",minutes:90,priority:2,repeatWeeks:1});`);
  assert.ok(run(`rulesEvaluate().some(x=>x.ruleId==="calendar-tomorrow-overload")`));
  assert.ok(run(`ruleDefinitions().some(x=>x.id==="crm-overdue"&&x.kind==="delegated")`));

  // Insights OS: insufficient samples are explicit; with six varied weeks the work association becomes calculable.
  run(`S=deepClone(DEFAULT_STATE); S.workLogs=[];`);assert.equal(run(`insightWorkAssociation().ready`),false);
  run(`for(let w=0;w<6;w++){const d=addDays(new Date(),-(w*7+1));S.workLogs.push({id:"w"+w,date:localDateKey(d),contacts:w+1,followups:w,meetings:w%2,proposals:w%3,sales:(w+1)*100000});}`);
  assert.equal(run(`insightWorkAssociation().ready`),true);assert.ok(run(`insightWorkAssociation().meta.includes("не доказательство причинности")`));

  // Goals / Horizons OS: v17 migration, project-linked auto progress,
  // deadline routing to Calendar/Life OS, and result XP only once.
  run(`S=normalizeState({version:17,settings:{goals:[{id:"g-persist",title:"Persist goal",area:"Работа",priority:2,status:"active",manualProgress:15,projectIds:[]}]}});`);
  assert.equal(run(`goalStore().length`),1);
  assert.equal(run(`goalStore()[0].title`),"Persist goal");
  run(`S=deepClone(DEFAULT_STATE); S.entities.projects=[{id:"gp",title:"Linked project",area:"Работа",priority:2,status:"active",progress:60,nextStep:"Step",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]; S.entities.goals=[]; save=async()=>{}; audit=()=>{}; toast=()=>{}; var gg=goalCreate({title:"Linked goal",area:"Работа",priority:1,horizon:"custom",deadline:localDateKey(addDays(new Date(),5)),manualProgress:5,projectIds:["gp"]});`);
  assert.equal(run(`goalProgress(gg)`),60);
  assert.ok(run(`goalDecisionEngine().some(x=>x.goalId===gg.id&&x.route==="goals")`));
  assert.ok(run(`calendarEvents(7,0).some(x=>x.source==="goal"&&x.refId===gg.id)`));
  assert.ok(run(`lifeOsRawCandidates().some(x=>String(x.id).startsWith("goal:")&&x.route==="goals")`));
  const goalXpBefore=run(`S.xpEarned`);await run(`setGoalStatus(gg.id,"done")`);const goalXpAfter=run(`S.xpEarned`);assert.ok(goalXpAfter>goalXpBefore);await run(`setGoalStatus(gg.id,"done")`);assert.equal(run(`S.xpEarned`),goalXpAfter);

  // Routines OS: today's schedule creates one soft Life OS action, completion removes it,
  // future schedule appears in Calendar, and a missed past day does not become overdue debt.
  run(`S=deepClone(DEFAULT_STATE); S.entities.routines=[]; S.entities.routineLogs=[]; save=async()=>{}; audit=()=>{}; toast=()=>{}; var rr=routineCreate({title:"Daily routine",area:"Знания",priority:2,days:[1,2,3,4,5,6,7],minutes:20});`);
  assert.equal(run(`routineDueToday().length`),1);
  assert.ok(run(`routineDecisionEngine().some(x=>x.routineId===rr.id&&!x.hard)`));
  assert.ok(run(`lifeOsRawCandidates().some(x=>String(x.id).startsWith("routine:")&&x.route==="routines")`));
  assert.ok(run(`routineCalendarEvents(localDateKey(),localDateKey(addDays(new Date(),2))).length>=2`));
  const routineXpBefore=run(`S.xpEarned`);await run(`completeRoutine(rr.id)`);const routineXpAfter=run(`S.xpEarned`);assert.ok(routineXpAfter>routineXpBefore);assert.equal(run(`routineDueToday().length`),0);await run(`completeRoutine(rr.id)`);assert.equal(run(`S.xpEarned`),routineXpAfter);
  assert.equal(run(`routineDecisionEngine().some(x=>/просроч/i.test(x.title))`),false);
  assert.equal(run(`activeDay(localDateKey())`),true);

  // Review / Insights include Goals and Routines on state v18.
  assert.equal(run(`STATE_VERSION`),18);
  const rs=run(`reviewSnapshot("week")`);assert.ok(rs.goals&&rs.routines);
  assert.equal(run(`insightGoalPortfolio().ready`),false); // completed goal is no longer active
  run(`goalCreate({title:"Insight goal",area:"Работа",priority:2,status:"active",manualProgress:40,projectIds:[]});`);
  assert.equal(run(`insightGoalPortfolio().ready`),true);

  // Command Palette indexes cross-domain entities without mutating state.
  run(`S.entities.tasks=[{id:"cmd-task",title:"Найти меня",area:"Работа",priority:2,status:"active",minutes:10,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];`);
  assert.ok(run(`commandSearch("Найти меня").some(x=>x.key==="task:cmd-task")`));
  assert.ok(run(`commandSearch("").some(x=>x.key==="quick:new-task")`));

  // v18 entity layer is idempotent and strips legacy domain arrays from settings.
  run(`var migrated=normalizeState({version:17,settings:{projects:[{id:"m1",title:"M",status:"active"}],tasks:[{id:"m2",title:"T",status:"active"}]}}); var migrated2=normalizeState(migrated);`);
  assert.equal(run(`migrated.version`),18);assert.equal(run(`migrated.entities.projects.length`),1);assert.equal(run(`migrated.entities.tasks.length`),1);assert.equal(run(`Object.prototype.hasOwnProperty.call(migrated.settings,"projects")`),false);assert.equal(run(`migrated2.entities.projects.length`),1);

  // Task dependencies, not-before and locked planned dates are respected by Execution Intelligence.
  run(`S=deepClone(DEFAULT_STATE); S.settings.calendarDailyCapacityMin=120; S.entities.tasks=[]; save=async()=>{}; audit=()=>{}; toast=()=>{}; var dep=taskCreate({title:"Dependency",area:"Работа",priority:1,minutes:60,dueDate:localDateKey(addDays(new Date(),2))}); var child=taskCreate({title:"Child",area:"Работа",priority:2,minutes:60,dueDate:localDateKey(addDays(new Date(),3)),blockedByIds:[dep.id]}); var locked=taskCreate({title:"Locked",area:"Личное",priority:2,minutes:30,plannedDate:localDateKey(addDays(new Date(),1)),autoPlanLocked:true});`);
  const ep=run(`executionPlan(5)`);assert.ok(ep.assignments.some(x=>x.taskId===run(`dep.id`)));assert.ok(ep.assignments.some(x=>x.taskId===run(`locked.id`)&&x.fixed));const depDate=ep.assignments.find(x=>x.taskId===run(`dep.id`)).dateKey,childDate=ep.assignments.find(x=>x.taskId===run(`child.id`))?.dateKey;assert.ok(!childDate||childDate>=depDate);
  // Lock is absolute even when its planned date is outside the selected horizon.
  run(`var lockedFar=taskCreate({title:"Locked far",area:"Личное",priority:2,minutes:30,plannedDate:localDateKey(addDays(new Date(),20)),autoPlanLocked:true});`);
  const epLocked=run(`executionPlan(5)`);assert.equal(epLocked.assignments.some(x=>x.taskId===run(`lockedFar.id`)&&!x.fixed),false);assert.ok(epLocked.blocked.some(x=>x.taskId===run(`lockedFar.id`)&&x.reason==="locked-outside-horizon"));

  // Entity integrity detects dependency cycles instead of letting them silently deadlock planning.
  run(`S.entities.tasks=[{id:"cy1",title:"Cycle 1",status:"active",blockedByIds:["cy2"]},{id:"cy2",title:"Cycle 2",status:"active",blockedByIds:["cy1"]}];`);
  assert.ok(run(`entityIntegrityIssues().some(x=>x.level==="bad"&&x.title==="Циклическая зависимость задач")`));

  // Decision preferences really alter ranking and can suppress a recommendation.
  run(`S.settings.decisionPreferences={}; globalThis.__decisionRows=[{id:"a",area:"Работа",kind:"task",title:"A",meta:"",score:60,hard:false,minutes:10},{id:"b",area:"Работа",kind:"task",title:"B",meta:"",score:70,hard:false,minutes:10}];`);
  assert.equal(run(`decisionAdjustCandidates(__decisionRows)[0].id`),"a"); // function preserves order; sorting belongs to Life OS
  run(`S.settings.decisionPreferences.a={scoreDelta:30};`);assert.equal(run(`decisionAdjustCandidates(__decisionRows).find(x=>x.id==="a").score`),90);run(`S.settings.decisionPreferences.b={disabled:true};`);assert.equal(run(`decisionAdjustCandidates(__decisionRows).some(x=>x.id==="b")`),false);

  // Recovery diff sees entity changes without touching finance ledgers.
  run(`S=deepClone(DEFAULT_STATE); S.entities.tasks=[{id:"r1",title:"Now",status:"active"}]; globalThis.__snap=deepClone(S); __snap.entities.tasks[0].title="Before";`);assert.ok(run(`recoveryDiffState(__snap).some(x=>x.type==="tasks"&&x.id==="r1"&&x.kind==="changed")`));

  // Today Flow consolidates mobile execution and "never suggest" is explicit but reversible in Settings.
  assert.ok(fs.readFileSync(path.join(root,"decision-os.js"),"utf8").includes('id="todayFlowCommand"'));
  assert.ok(fs.readFileSync(path.join(root,"decision-os.js"),"utf8").includes("Не предлагать"));

  // Calibration / Learning Loop: measured task time stays separate from estimates and capacity tuning is bounded.
  run(`S=deepClone(DEFAULT_STATE);S.settings.calibration={version:1,taskEvents:[],decisionEvents:[],days:{},autoTuneEnabled:true,capacityFactor:1,lastAutoTuneWeek:'',lastAdjustment:null};S.entities.tasks=[];for(let i=1;i<=8;i++){const k=localDateKey(addDays(new Date(),-i));const a={id:'ca'+i,status:'done',plannedDate:k,minutes:60,actualMinutes:75,priority:2,area:'Работа',completedAt:k+'T12:00:00'},b={id:'cb'+i,status:'active',plannedDate:k,minutes:60,priority:2,area:'Работа'};S.entities.tasks.push(a,b);calibrationState().days[k]={dateKey:k,firstPlan:{taskIds:[a.id,b.id],plannedMinutes:120,taskCount:2,capturedAt:k+'T08:00:00'},latestPlan:{taskIds:[a.id,b.id],plannedMinutes:120,taskCount:2,capturedAt:k+'T08:00:00'}}}`);
  assert.equal(run(`calibrationPlanStats(42).ready`),true);assert.equal(run(`calibrationRecommendation().delta`),-.05);assert.equal(run(`calibrationEstimateStats().ready`),true);assert.equal(run(`calibrationCapacityFor(180,60)`),180);
  await run(`calibrationMaybeAutoTune(true)`);assert.ok(Math.abs(run(`calibrationCapacityFactor()`)-.95)<1e-9);assert.equal(run(`calibrationCapacityFor(180,60)`),174);
  run(`calibrationRecordDecisionExposure([{id:'task:test',score:80,kind:'task',source:'Tasks OS'}]);calibrationRecordDecisionExposure([{id:'task:test',score:80,kind:'task',source:'Tasks OS'}]);calibrationRecordDecisionAction('boost','task:test')`);assert.equal(run(`calibrationDecisionStats().shown`),1);assert.equal(run(`calibrationDecisionStats().actions`),1);

  // Dynamically injected OS cards must participate in UX7 view switching.
  for(const file of ["work.js","tennis.js","knowledge.js","life-os.js","projects-os.js","goals-os.js","review-os.js","calendar-os.js","tasks-os.js","routines-os.js","capture2-os.js","rules-os.js","insights-os.js","data-os.js","execution-os.js","decision-os.js","recovery-os.js"]){
    const src=fs.readFileSync(path.join(root,file),"utf8");
    const dynamic=[...src.matchAll(/data-ux7-view="[^"]+"\s+class="([^"]+)"/g)];
    assert.ok(dynamic.length>0,`${file}: no dynamic UX7 cards found`);
    assert.ok(dynamic.every(m=>m[1].split(/\s+/).includes("ux7-card")),`${file}: dynamic card missing ux7-card`);
  }
  assert.ok(fs.readFileSync(path.join(root,"bootstrap.js"),"utf8").length<8000,"bootstrap must stay modular");

  console.log("OK — Life RPG 11.1.0 calibration integration tests passed");
})().catch(e=>{console.error(e);process.exit(1)});
