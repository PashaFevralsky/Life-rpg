"use strict";
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=__dirname;
const context=vm.createContext({
  console, Date, Math, JSON, Intl, setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0,
  structuredClone:global.structuredClone,
  crypto:global.crypto,
  document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}}},
  navigator:{}, location:{reload:()=>{}}, localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  Notification:function(){}, confirm:()=>true, prompt:()=>'', Blob:global.Blob, URL:global.URL
});
context.window.window=context.window; context.window.document=context.document;
const files=['core.js','state.js','finance.js','imports.js','work.js','tennis.js','knowledge.js','gamification.js','pwa.js','ui.js'];
for(const file of files){new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file}).runInContext(context)}
function run(code){return new vm.Script(code).runInContext(context)}

// Fresh zero targets must not unlock false result achievements.
run('S=deepClone(DEFAULT_STATE); S.settings.workMonthlyPlan=0; S.settings.monthlyDebtGoal=0;');
let ach=run('achievementConditions()');
assert.equal(ach.salesplan,false); assert.equal(ach.debtgoal,false); assert.equal(ach.debtfree,false);

// Weekly review uses real [start,end] bounds.
run(`S=deepClone(DEFAULT_STATE); const wb=weekBounds(); S.readingLogs=[{id:'r1',dateKey:wb[0],minutes:30,pages:5,note:''}]; S.expenses=[{id:'e1',dateKey:wb[0],amount:100,category:'Еда'}]; S.payments=[{id:'p1',localDate:wb[0],amount:200}];`);
let wr=run('weeklyReviewData()'); assert.equal(wr.reads.length,1); assert.equal(wr.expenses,100); assert.equal(wr.payments,200);

// CRM forecast excludes undated and other-month deals.
run(`S=deepClone(DEFAULT_STATE); const mk=localMonthKey(); const future=localMonthKey(addMonthsDate(new Date(),1)); S.crmDeals=[{id:'1',stage:'Тендер',potential:100000,probability:50,closeDate:mk+'-28'},{id:'2',stage:'Тендер',potential:200000,probability:50,closeDate:future+'-10'},{id:'3',stage:'Тендер',potential:300000,probability:50,closeDate:''}];`);
assert.equal(run('crmMonthlyWeightedPipeline()'),50000);

// Work targets are configurable.
run('S.workTargets={contacts:27,followups:13,lpr:4,meetings:5,proposals:6}'); assert.equal(run('workTarget("contacts",20)'),27);

// Elo calculation is pure when viewed/calculated.
run(`S=deepClone(DEFAULT_STATE); S.settings.tennisBaseElo=1000; S.tennis=[{id:'a',dateKey:'2026-09-01',opponentRating:1100,w:1,l:0},{id:'b',dateKey:'2026-09-02',opponentRating:1000,w:0,l:1}];`);
const before=run('JSON.stringify(S.tennis)'); const elo=run('computeTennisElo().rating'); const after=run('JSON.stringify(S.tennis)'); assert.equal(before,after); assert.ok(Number.isFinite(elo));

// Reading XP: no automatic 10 XP for a 1-minute session; 40 base XP/day cap.
run(`S=deepClone(DEFAULT_STATE); S.readingLogs=[{dateKey:'2026-09-20',minutes:60,xpAward:40}];`); assert.equal(run('readingBaseXpOnDate("2026-09-20")'),40);

// Planned-income rule: an actual matched payment closes the planned event fully.
run(`S=deepClone(DEFAULT_STATE); S.settings.incomeEvents=[{id:'adv',day:20,label:'Аванс',amount:40000}]; S.incomeLogs=[{id:'i',dateKey:'2026-09-18',amount:22909.29,source:'Аванс',plannedEventId:'adv',plannedMonth:'2026-09'}];`);
assert.equal(run('plannedIncomeForecastAmount(S.settings.incomeEvents[0],2026,8,new Date(2026,8,18))'),0);

// Debt model marks budget below minimums as infeasible.
run(`S=deepClone(DEFAULT_STATE); S.debts=[{id:'d',name:'D',balance:100000,rate:30,rateKnown:true,min:10000,active:true}];`);
let ds=run('simulateDebtStrategy(5000)'); assert.equal(ds.feasible,false); assert.equal(ds.months,Infinity);

// Persist is the only place that synchronizes achievements; render itself is pure with respect to persistence.
assert.equal(run('render.toString().includes("persist(")'),false);

console.log('OK — Life RPG 8.0 regression tests passed');
