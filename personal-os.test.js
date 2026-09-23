"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert"),root=__dirname;
const ctx=vm.createContext({console,Date,Math,JSON,Intl,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,structuredClone:global.structuredClone,Blob:global.Blob,URL:global.URL,Map,Set,Number,String,Array,Object,RegExp,
  document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({}),head:{appendChild(){}},body:{}},window:{},navigator:{},localStorage:{getItem:()=>null,setItem(){}},NodeFilter:{SHOW_TEXT:4},toast:()=>{},audit:()=>{},save:async()=>{},render:()=>{}});
ctx.window=ctx;ctx.S={settings:{growthOS:{trackers:[],events:[],knowledgeNotes:[],tennisTemplates:[],tennisDetails:[],activeTimers:{},initializedAt:new Date().toISOString()},personalOS:{journal:[],decisions:[],people:[],interactions:[],timeboxes:[],focusSessions:[],chores:[],choreLogs:[],inventory:[],shopping:[],importFingerprints:[],dashboard:{order:[],hidden:[],compact:false},activeFocus:{},version:1}},entities:{tasks:[],routines:[],routineLogs:[],calendarEvents:[],inbox:[]},readingLogs:[],tennis:[],books:[],crmDeals:[]};
for(const f of ["core.js","personal-os.js","inbox-os.js","tracking-os.js","people-os.js","focus-os.js","body-os.js","home-os.js","personal-import-os.js","calibration-os.js","personal-stabilization-os.js"])new vm.Script(fs.readFileSync(path.join(root,f),"utf8"),{filename:f}).runInContext(ctx);
const run=code=>new vm.Script(code).runInContext(ctx);
(async()=>{
  assert.equal(run('personalImportParseDate("23.09.2026")'),"2026-09-23");
  assert.equal(run('personalImportParseDate("2026-02-31")'),null);
  assert.equal(run('personalImportNumber("")'),null);
  assert.equal(run('personalImportNormalize({date:"23.09.2026",tracker:"Фокус",durationmin:"30"}).durationMin'),30);
  assert.equal(run('personalImportNormalize({date:"23.09.2026",tracker:"Вес",value:""})'),null);

  run(`const d0=localDateKey(),d1=localDateKey(addDays(new Date(),-1));S.settings.growthOS.events=[
    {id:'m1',trackerId:'tracker-mood',dateKey:d0,occurredAt:d0+'T10:00:00',value:2},
    {id:'m2',trackerId:'tracker-mood',dateKey:d0,occurredAt:d0+'T18:00:00',value:8},
    {id:'m3',trackerId:'tracker-mood',dateKey:d1,occurredAt:d1+'T10:00:00',value:10}
  ];`);
  assert.equal(run('bodyAvg("tracker-mood",7)'),7.5);

  run(`S.settings.personalOS.people=[{id:'p1',name:'Иван',relation:'Друг',cadenceDays:7,createdAt:new Date().toISOString(),archived:false}];S.settings.personalOS.interactions=[];`);
  assert.equal(run('peopleHealth(peopleAll()[0]).last'),null);assert.equal(run('peopleHealth(peopleAll()[0]).due'),false);assert.equal(run('peopleHealth(peopleAll()[0]).score'),null);

  run(`S.settings.personalOS.inventory=[{id:'i1',name:'Кофе',qty:1,minQty:5,unit:'шт',archived:false}];S.settings.personalOS.shopping=[{id:'s1',name:'Кофе',inventoryId:'i1',done:false}];`);
  await run('homeBought("s1")');assert.equal(run('S.settings.personalOS.inventory[0].qty'),1);

  run(`const h={id:'h1',type:'habit',weeklyTarget:3};const t=localDateKey(),y=localDateKey(addDays(new Date(),-1));S.settings.growthOS.events=[{id:'h1a',trackerId:'h1',dateKey:t},{id:'h1b',trackerId:'h1',dateKey:t},{id:'h1c',trackerId:'h1',dateKey:y}];`);
  const rate=run('growthHabitTrackerStrength(h).rate30');assert.ok(rate>60&&rate<70,'habit must count unique days by default');
  run('h.countMode="events"');assert.equal(Math.round(run('growthHabitTrackerStrength(h).rate30')),100);

  run(`S.entities.tasks=[{id:'t1',title:'Task',status:'active',plannedDate:'',timerStartedAt:'',actualMinutes:0,updatedAt:''}];focusSyncLinkedTaskStable({taskId:'t1',dateKey:'2026-09-30'});`);assert.equal(run('S.entities.tasks[0].plannedDate'),"2026-09-30");
  run(`S.settings.personalOS.activeFocus={taskId:'t1',startedAt:new Date().toISOString()};`);assert.equal(run('calibrationStartTaskTimer("t1")'),false);

  console.log("OK — Personal OS 12.0.0 stabilization regression tests passed");
})().catch(e=>{console.error(e);process.exit(1)});
