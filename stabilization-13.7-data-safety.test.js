"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert"),path=require("path"),root=__dirname,read=n=>fs.readFileSync(path.join(root,n),"utf8");

(async()=>{
  const state=read("state.js"),personal=read("personal-import-os.js"),hub=read("import-hub.js"),
        gpt=read("gpt-exchange-feedback-13.6.js"),training=read("training-os.js"),
        work=read("work.js"),tennis=read("tennis.js"),knowledge=read("knowledge.js");

  // A01 — cross-tab stale writes must be detected before put.
  assert.ok(state.includes('db.transaction("state","readwrite")'));
  assert.ok(state.includes("storage137ExternalAdvance"));
  assert.ok(state.includes("remoteTs>knownTs"));
  assert.ok(state.includes("storage137ConflictError"));
  assert.ok(state.includes("storage137WithLock"));
  assert.ok(state.includes('BroadcastChannel("life-rpg-state-13.7")'));
  assert.ok(state.indexOf('objectStore("state").get("current")')<state.indexOf('objectStore("state").put(snapshot,"current")'));

  // A02 — portable Personal OS must reject unsafe IDs / dangerous object keys.
  assert.ok(personal.includes("personalPortableNormalize"));
  assert.ok(personal.includes('["__proto__","prototype","constructor"]'));
  assert.ok(personal.includes("isSafeStateId"));
  assert.ok(hub.includes("personalPortableNormalize"));

  const pc=vm.createContext({
    console,Date,Math,JSON,Number,String,Array,Object,RegExp,Set,Map,
    isSafeStateId:v=>{const s=String(v??"");return s.length>0&&s.length<=180&&!/[\s'"<>`\\]/.test(s)},
    personalText:v=>String(v??"").trim(),personalData:()=>({importFingerprints:[]}),
    localDateKey:()=> "2026-09-27",parseLocal:s=>new Date(s+"T12:00:00"),
    validDateKey:s=>/^\d{4}-\d{2}-\d{2}$/.test(s),document:{getElementById:()=>null,querySelector:()=>null},
    toast:()=>{},audit:()=>{},save:async()=>{},growthData:()=>({trackers:[],events:[]}),uid:()=>"u1",
    personalNow:()=>new Date().toISOString(),personalFindTrackerByName:()=>null,growthTrackers:()=>[],growthExplicitEvents:()=>[],
    personalSafeJsonClone:x=>JSON.parse(JSON.stringify(x)),Blob:global.Blob,URL:global.URL,setTimeout
  });
  pc.globalThis=pc;vm.runInContext(personal,pc,{filename:"personal-import-os.js"});
  pc.good={format:"life-rpg-personal-os-v1",people:[{id:"person-1",name:"Иван"}]};
  assert.equal(vm.runInContext("personalPortableNormalize(good).people[0].id",pc),"person-1");
  pc.bad={format:"life-rpg-personal-os-v1",people:[{id:"x');alert(1)//",name:"bad"}]};
  assert.throws(()=>vm.runInContext("personalPortableNormalize(bad)",pc),/небезопасный/);

  // A06 — GPT apply has a synchronous reentrancy guard and post-snapshot recheck.
  assert.ok(gpt.includes("GPT136_APPLY_PENDING"));
  assert.ok(gpt.includes('if(GPT136_APPLY_PENDING)'));
  assert.ok(gpt.includes("gpt135Store().appliedFingerprints.includes(p.fingerprint)"));
  assert.ok(gpt.indexOf("GPT136_APPLY_PENDING=true")<gpt.indexOf("createPreActionSnapshot"));

  // A25 — deleting the same record twice must never splice a neighbor.
  for(const [name,src] of [["work.js",work],["tennis.js",tennis],["knowledge.js",knowledge],["training-os.js",training]]){
    assert.ok(src.includes("findIndex"),`${name}: re-find missing`);
    const snap=src.indexOf("await createPreActionSnapshot");
    const after=src.indexOf("findIndex",snap);
    assert.ok(snap>=0&&after>snap,`${name}: index must be resolved after snapshot await`);
  }

  const wc=vm.createContext({
    console,Date,Math,JSON,Promise,setTimeout,
    S:{workLogs:[{id:"a",date:"2026-09-27",xpAward:0},{id:"b",date:"2026-09-27",xpAward:0}],workTargets:{},crmDeals:[]},
    confirm:()=>true,createPreActionSnapshot:async()=>{await new Promise(r=>setTimeout(r,1));return 1},
    trashPush:()=>{},removeXp:()=>{},save:async()=>{},toast:()=>{},audit:()=>{},
    addDays:d=>d,weekBounds:()=>["2026-09-21","2026-09-27"],inRange:()=>false,aggregateWork:()=>({}),
    localMonthKey:()=>"2026-09",localDateKey:()=>"2026-09-27",rub:x=>String(x),clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    uid:()=>Math.random().toString(36),parseLocal:s=>new Date(s),fmtDate:()=>"",escapeHtml:String
  });
  wc.globalThis=wc;vm.runInContext(work,wc,{filename:"work.js"});
  await vm.runInContext('Promise.all([deleteWork("a"),deleteWork("a")])',wc);
  assert.deepEqual(Array.from(wc.S.workLogs,x=>x.id),["b"],"double delete removed a neighbor");

  // A26 — week planner has a lock and checks the calendar again after snapshot.
  assert.ok(training.includes("TRAINING129_PLAN_PENDING"));
  assert.ok(training.includes("const current="));
  assert.ok(training.includes("toAdd=rows.filter"));
  const tc=vm.createContext({
    console,Date,Math,JSON,Promise,setTimeout,
    S:{settings:{}},toast:()=>{},confirm:()=>true,
    localDateKey:()=>"2026-09-27",addDays:(d,n)=>new Date(d.getTime()+n*86400000),
    parseLocal:s=>new Date(s+"T12:00:00"),clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    calendar:[],calendarManualEvents:()=>tc.calendar,
    createPreActionSnapshot:async()=>{await new Promise(r=>setTimeout(r,1));return 1},
    addCalendarPlan:x=>{const e={id:"c"+(tc.calendar.length+1),...x,status:"planned"};tc.calendar.push(e);return[e]},
    audit:()=>{},save:async()=>{},growthData:()=>({trackers:[],events:[]})
  });
  tc.globalThis=tc;vm.runInContext(training,tc,{filename:"training-os.js"});
  vm.runInContext('training129SuggestedWeek=()=>[{title:"Easy",dateKey:"2026-09-28",minutes:30,kind:"easy",rpe:4,detail:"x"}]',tc);
  await vm.runInContext("Promise.all([training129PlanWeek(),training129PlanWeek()])",tc);
  assert.equal(tc.calendar.length,1,"parallel Training plan duplicated calendar event");

  // A30 — Import Hub Apply is locked before first await and rechecks fingerprints.
  assert.ok(hub.includes("IMPORT127_APPLY_PENDING"));
  assert.ok(hub.indexOf("IMPORT127_APPLY_PENDING=true")<hub.indexOf("await createPreActionSnapshot"));
  assert.ok(hub.includes("if(seen.has(row.fingerprint))continue"));
  assert.ok(hub.includes("if(import127Seen(x.fp))continue"));

  const personalStore={importFingerprints:[]};let imported=0;
  const hc=vm.createContext({
    console,Date,Math,JSON,Promise,setTimeout,Set,Map,
    S:{settings:{},workLogs:[],tennis:[]},uid:()=>`u${++imported}`,toast:()=>{},audit:()=>{},
    createPreActionSnapshot:async()=>{await new Promise(r=>setTimeout(r,1));return 1},
    personalData:()=>personalStore,personalImportEnsureTracker:()=>({id:"tracker"}),growthLogEvent:()=>({id:"event-"+(++imported)}),
    growthTrackers:()=>[],persist:async()=>{},save:async()=>{},render:()=>{},renderImport127:()=>{},
    recomputeTennisElo:()=>{},parseLocal:s=>new Date(s+"T12:00:00"),
    personalPortableCounts:()=>({}),personalPortableNormalize:x=>x,personalMergeById:()=>0,
    mergeReadingListPackage:()=>({added:[],skipped:[]}),normalizeState:x=>x,storageLoadBlocked:false,
    applyImportedCandidates:async()=>({created:[]}),localDateKey:()=>"2026-09-27",
    document:{getElementById:()=>null,querySelector:()=>null},escapeHtml:String
  });
  hc.globalThis=hc;vm.runInContext(hub,hc,{filename:"import-hub.js"});
  vm.runInContext(`IMPORT127_PREVIEW={kind:"personal-csv",name:"x.csv",valid:1,personal:{valid:[{fingerprint:"fp1",dateKey:"2026-09-27",value:1,durationMin:0,note:""}]}}`,hc);
  await vm.runInContext("Promise.all([import127Apply(),import127Apply()])",hc);
  assert.equal(personalStore.importFingerprints.filter(x=>x==="fp1").length,1);

  console.log("OK — Life RPG 13.7 Stage 1 Data Safety regression tests passed");
})().catch(e=>{console.error(e);process.exit(1)});
