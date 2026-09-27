"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const RealDate=Date,FIXED="2026-03-30T12:00:00+02:00";
class FixedDate extends RealDate{
  constructor(...args){super(...(args.length?args:[FIXED]))}
  static now(){return new RealDate(FIXED).getTime()}
}
const root=__dirname,growth={trackers:[],events:[],tennisWearables:[]},toasts=[];
const context=vm.createContext({
  console,Date:FixedDate,Math,JSON,Intl,Number,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  structuredClone:global.structuredClone,crypto:global.crypto,
  document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>({}),addEventListener:()=>{},activeElement:null,head:{appendChild(){}},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}},LifePlatform:{}},
  navigator:{},location:{reload:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  confirm:()=>true,prompt:()=>"",Blob:global.Blob,URL:global.URL,
  growthData:()=>growth,growthExplicitEvents:()=>growth.events,growthEventDate:x=>String(x.dateKey||""),
  growthLogEvent:(trackerId,d)=>{const x={id:`e${growth.events.length+1}`,trackerId,dateKey:d.dateKey,value:d.value,durationMin:d.durationMin,note:d.note};growth.events.unshift(x);return x},
  bodyReadiness:()=>70,bodyDailySeries:()=>[],
  calendarManualEvents:()=>[],calendarDayLoad:()=>({minutes:0}),
  lifeOsRegisterCandidateProvider:()=>{},lifeOsRegisterRouteHandler:()=>{},personalRegisterWidget:()=>{},
  audit:()=>{},save:async()=>{},toast:m=>toasts.push(String(m)),createPreActionSnapshot:async()=>1,
  addCalendarPlan:()=>[],escapeHtml:String,ux7Go:()=>{},closeModal:()=>{}
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","state.js","tennis.js","tennis-huawei.js","training-os.js"])new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

(async()=>{
  // Calendar-day gap across the spring DST jump is 2 days, not 1.
  run(`S=deepClone(DEFAULT_STATE);S.settings.tennisBaseElo=1000;S.tennis=[{id:"v",dateKey:"2026-03-28",createdAt:"2026-03-28T12:00:00",min:60,load:5,matches:[]}]`);
  assert.equal(run(`tennisDaysSinceLast()`),2);

  // Invalid/future tennis facts must not affect Elo or recent-session analytics.
  run(`S.tennis=[
    {id:"past",dateKey:"2026-03-28",createdAt:"2026-03-28T12:00:00",min:60,load:5,matches:[{id:"m1",opponent:"A",opponentRating:1200,result:"W"}]},
    {id:"future",dateKey:"2026-04-01",createdAt:"2026-04-01T12:00:00",min:60,load:9,matches:[{id:"m2",opponent:"B",opponentRating:1400,result:"W"}]},
    {id:"bad",dateKey:"2026-02-31",createdAt:"2026-02-28T12:00:00",min:60,load:9,matches:[{id:"m3",opponent:"C",opponentRating:1500,result:"W"}]}
  ]`);
  assert.equal(run(`tennisRecordedSessions().length`),1);
  assert.equal(run(`computeTennisElo().ratedMatches`),1);
  assert.equal(run(`tennisAllMatches().length`),1);

  // Training OS ignores future outdoor facts and does not invent RPE=1 for corrupt/missing tennis load.
  growth.events=[
    {id:"o1",trackerId:"tracker-training-outdoor",dateKey:"2026-03-29",value:4,durationMin:30,note:"Training OS 12.9|type=easy|distance=3|avgHr=130|maxHr=150|aerobicEffect=2|recoveryHours=6|source=manual"},
    {id:"o2",trackerId:"tracker-training-outdoor",dateKey:"2026-04-01",value:9,durationMin:120,note:"Training OS 12.9|type=interval|distance=10|avgHr=180|maxHr=200|aerobicEffect=5|recoveryHours=72|source=manual"}
  ];
  assert.equal(run(`training129OutdoorSessions(7).length`),1);
  run(`S.tennis=[{id:"t0",dateKey:"2026-03-29",createdAt:"2026-03-29T12:00:00",min:90,load:0,matches:[]}]`);
  const ts=run(`training129TennisSessions(7)[0]`);
  assert.equal(ts.rpe,0);assert.equal(ts.load,0);

  // Planner may relax spacing, but must never place an outdoor session on an already occupied sport day.
  context.calendarEvents=()=>["2026-03-30","2026-03-31","2026-04-02","2026-04-03","2026-04-04","2026-04-05"].map((dateKey,i)=>({id:"s"+i,dateKey,title:"Теннис",type:"Тренировка",area:"Теннис"}));
  growth.events=[];run(`S.tennis=[]`);
  const plan=run(`training129SuggestedWeek()`);
  assert.equal(plan.length,1);
  assert.equal(plan[0].dateKey,"2026-04-01");

  // Huawei data cannot be future-dated or attached to a tennis session from another date.
  assert.equal(run(`tennisHuaweiValidate({dateKey:"2026-04-01",durationSec:3600})`),"Дата Huawei должна быть сегодня или в прошлом");
  run(`S.tennis=[{id:"s1",dateKey:"2026-03-28",createdAt:"2026-03-28T12:00:00",min:60,load:5,matches:[]}]`);
  const saved=await run(`tennisHuaweiSaveForSession("s1",{dateKey:"2026-03-29",durationSec:3600,totalCalories:500,activeCalories:400,avgHr:150,maxHr:180})`);
  assert.equal(saved,null);
  assert.ok(toasts.some(x=>x.includes("не совпадает")));

  console.log("OK — Stage 2.7 training/tennis correctness: factual sessions, DST-safe days, sport-day planning, Huawei date integrity");
})().catch(e=>{console.error(e);process.exit(1)});
