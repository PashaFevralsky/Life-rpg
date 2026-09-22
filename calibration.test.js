"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname;
const context=vm.createContext({console,Date,Math,JSON,Intl,Promise,structuredClone:global.structuredClone,crypto:global.crypto,setTimeout,clearTimeout,document:{getElementById(){return null},querySelector(){return null}},window:{},navigator:{}});
for(const f of ["core.js","calibration-os.js"])new vm.Script(fs.readFileSync(path.join(root,f),"utf8"),{filename:f}).runInContext(context);
const run=s=>vm.runInContext(s,context);
run(`
  globalThis.S={settings:{},entities:{tasks:[]}};
  globalThis.persistCount=0;globalThis.persist=async()=>{persistCount++};
  globalThis.audit=()=>{};globalThis.save=async()=>{};globalThis.toast=()=>{};
  globalThis.taskAll=()=>S.entities.tasks;
  globalThis.decisionSource=x=>x.source||'Life OS';
`);

(async()=>{
  // First meaningful plan is retained even if the app opened before tasks were planned.
  run(`calibrationCaptureDay();S.entities.tasks=[{id:'today',status:'active',plannedDate:localDateKey(),minutes:90,priority:2,area:'Работа'}];calibrationCaptureDay()`);
  assert.equal(run(`calibrationState().days[localDateKey()].firstPlan.plannedMinutes`),90);
  run(`S.entities.tasks=[];calibrationCaptureDay()`);
  assert.equal(run(`calibrationState().days[localDateKey()].firstPlan.plannedMinutes`),90,"first meaningful plan must not be rewritten later");

  // Ten loaded historical days at 50% completion should trigger only a conservative -5pp correction.
  run(`
    S.entities.tasks=[];S.settings.calibration={version:1,taskEvents:[],decisionEvents:[],days:{},autoTuneEnabled:true,capacityFactor:1,lastAutoTuneWeek:'',lastAdjustment:null};
    for(let i=1;i<=10;i++){
      const k=localDateKey(addDays(new Date(),-i));
      const a={id:'a'+i,status:'done',plannedDate:k,minutes:50,priority:2,area:'Работа',completedAt:k+'T12:00:00'};
      const b={id:'b'+i,status:'active',plannedDate:k,minutes:50,priority:2,area:'Работа'};
      S.entities.tasks.push(a,b);
      calibrationState().days[k]={dateKey:k,firstPlan:{taskIds:[a.id,b.id],plannedMinutes:100,taskCount:2,capturedAt:k+'T08:00:00'},latestPlan:{taskIds:[a.id,b.id],plannedMinutes:100,taskCount:2,capturedAt:k+'T08:00:00'}};
    }
  `);
  const plan=run(`calibrationPlanStats(42)`);assert.equal(plan.ready,true);assert.equal(plan.n,10);assert.ok(Math.abs(plan.adherence-.5)<1e-9);
  const rec=run(`calibrationRecommendation()`);assert.equal(rec.delta,-.05);
  const tuned=await run(`calibrationMaybeAutoTune(true)`);assert.equal(tuned.changed,true);assert.ok(Math.abs(run(`calibrationCapacityFactor()`)-.95)<1e-9);
  assert.equal(run(`calibrationState().lastAdjustment.sample`),10);
  const second=await run(`calibrationMaybeAutoTune(false)`);assert.equal(second.changed,false,"same week must not auto-tune twice");
  assert.equal(run(`calibrationCapacityFor(180,60)`),174,"factor applies only to free task capacity, not fixed load");

  // Estimate accuracy is based only on measured timer data.
  run(`
    const now=new Date().toISOString();
    S.entities.tasks=[1,2,3,4,5].map(i=>({id:'timed'+i,status:'done',minutes:40,actualMinutes:60,completedAt:now,priority:2,area:'Работа'}));
  `);
  const est=run(`calibrationEstimateStats()`);assert.equal(est.ready,true);assert.equal(est.n,5);assert.ok(Math.abs(est.medianRatio-1.5)<1e-9);

  // Decision exposure is deduplicated per day/candidate; actions are counted per candidate/day.
  run(`S.settings.calibration.decisionEvents=[];calibrationRecordDecisionExposure([{id:'task:x',score:80,kind:'task',source:'Tasks OS'},{id:'goal:y',score:60,kind:'goal',source:'Goals OS'}]);calibrationRecordDecisionExposure([{id:'task:x',score:80,kind:'task',source:'Tasks OS'}]);calibrationRecordDecisionAction('boost','task:x')`);
  const ds=run(`calibrationDecisionStats()`);assert.equal(ds.shown,2);assert.equal(ds.actions,1);assert.equal(ds.accepted,1);assert.equal(ds.ignored,1);

  // Task timer records measured minutes separately from the estimate.
  run(`S.entities.tasks=[{id:'timer',status:'active',minutes:30,actualMinutes:0,priority:2,area:'Работа'}];calibrationStartTaskTimer('timer');S.entities.tasks[0].timerStartedAt=new Date(Date.now()-10*60000).toISOString()`);
  const seg=run(`calibrationStopTaskTimerCore(S.entities.tasks[0])`);assert.ok(seg>=9&&seg<=11);assert.ok(run(`S.entities.tasks[0].actualMinutes`)>=9);

  console.log("OK — Life RPG 11.1.0 calibration: plan/fact, bounded auto-tune, measured time, decision learning");
})().catch(e=>{console.error(e);process.exitCode=1});
