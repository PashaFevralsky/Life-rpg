"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert"),src=fs.readFileSync("training-os.js","utf8");
let n=0;
const ctx={console,Date,Math,Number,String,Array,Object,Map,Set,JSON,Promise,
 S:{settings:{tennisWeeklyTarget:3,growthOS:{trackers:[],events:[]}},tennis:[]},
 uid:()=>`id${++n}`,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),localDateKey:d=>{d=d||new Date("2026-09-25T12:00:00");return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`},addDays:(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x},parseLocal:k=>new Date(k+"T12:00:00"),validDateKey:k=>/^\d{4}-\d{2}-\d{2}$/.test(k),weekBounds:()=>["2026-09-21","2026-09-27"],
 growthData:()=>ctx.S.settings.growthOS,growthExplicitEvents:()=>ctx.S.settings.growthOS.events,growthEventDate:x=>x.dateKey,growthLogEvent:(trackerId,d)=>{const x={id:`e${++n}`,trackerId,dateKey:d.dateKey,value:d.value,durationMin:d.durationMin,note:d.note,createdAt:new Date().toISOString()};ctx.S.settings.growthOS.events.unshift(x);return x},
 bodyReadiness:()=>70,bodyDailySeries:()=>[],calendarEvents:()=>[],calendarManualEvents:()=>[],calendarDayLoad:()=>({minutes:0}),tennisHuaweiDetail:()=>null,
 document:{getElementById:()=>null,querySelector:()=>null},window:{LifePlatform:{}},personalRegisterWidget:()=>{},audit:()=>{},save:async()=>{},toast:()=>{},confirm:()=>true,createPreActionSnapshot:async()=>1,addCalendarPlan:()=>[],escapeHtml:String};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);const run=x=>vm.runInContext(x,ctx);
assert.equal(run("training129EnsureTracker().id"),"tracker-training-outdoor");
const enc=run(`training129Encode({type:"easy",distanceKm:3.2,avgHr:138,maxHr:157,aerobicEffect:2.4,recoveryHours:8,source:"Huawei Health"},"ok")`);
assert.equal(run(`training129Decode(${JSON.stringify(enc)}).type`),"easy");assert.equal(run(`training129Decode(${JSON.stringify(enc)}).distanceKm`),3.2);
run(`growthLogEvent(TRAINING129_TRACKER_ID,{dateKey:"2026-09-24",value:4,durationMin:35,note:training129Encode({type:"easy",distanceKm:3.5,avgHr:135,maxHr:150,source:"manual"},"")})`);
let r=run("training129Range(7)");assert.equal(r.outdoor,1);assert.equal(r.load,140);
let d=run("training129Decision()");assert.ok(["easy","strength","interval","recovery","hold"].includes(d.kind));
let p=run("training129SuggestedWeek()");assert.ok(p.length>=1&&p.length<=3);assert.ok(p.every(x=>x.minutes>0&&x.dateKey));
assert.equal(run(`training129ParseDistance("Расстояние 4,25 км")`),4.25);
assert.ok(src.includes("lifeOsRawCandidates=function"));assert.ok(src.includes('route:"training129"'));assert.ok(src.includes("training129ImportHubHuawei"));assert.ok(src.includes("No state migration"));
console.log("OK — Training & Physical Capacity OS 12.9 load, plan, Huawei and Life OS contracts passed");
