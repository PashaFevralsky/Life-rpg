"use strict";
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=__dirname;
const context=vm.createContext({
  console, Date, Math, JSON, Intl, Promise, setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0,
  structuredClone:global.structuredClone, crypto:global.crypto,
  document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}}}, navigator:{}, location:{reload:()=>{}},
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}, Notification:function(){}, confirm:()=>true, prompt:()=>'', Blob:global.Blob, URL:global.URL
});
context.window.window=context.window; context.window.document=context.document;
for(const file of ['core.js','state.js','finance.js','imports.js','work.js','tennis.js','knowledge.js','gamification.js','pwa.js','ui.js']){
  new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file}).runInContext(context)
}
function run(code){return new vm.Script(code).runInContext(context)}
(async()=>{
  assert.equal(run('finiteNumberOr("0",100)'),0);
  assert.equal(run('finiteNumberOr("",100)'),100);

  // Manual debt payment undo must restore balances above initial, schedule, history and XP.
  run(`S=deepClone(DEFAULT_STATE); S.debts=[{id:'d1',name:'Card',initial:100,balance:50,nextPaymentDate:'2026-10-18',nextPaymentAmount:20,min:20,active:true}]; S.payments=[{id:'p1',debtId:'d1',debt:'Card',amount:100,beforeBalance:150,localDate:'2026-09-20',date:'2026-09-20T12:00:00',scheduleBefore:{nextPaymentDate:'2026-09-18',nextPaymentAmount:20},historyId:'h1',xpAward:10,historicalOnly:false,reservationUse:[]}]; S.balanceHistory=[{id:'h1',date:'2026-09-20',total:50,type:'payment',paymentId:'p1'}]; S.xpEarned=10; S.stats['Финансы']=10; S.xpEvents=[{id:'x1',date:'2026-09-20T12:00:00',xp:10,stat:'Финансы',sourceId:'payment:p1',kind:'process'}]; save=async()=>{}; toast=()=>{};`);
  await run('undoPayment("p1")');
  assert.equal(run('S.debts[0].balance'),150);
  assert.equal(run('S.debts[0].nextPaymentDate'),'2026-09-18');
  assert.equal(run('S.balanceHistory.length'),0);
  assert.equal(run('S.payments.length'),0);
  assert.equal(run('S.xpEarned'),0);
  assert.equal(run('S.stats["Финансы"]'),0);

  // Older manual payment cannot be undone before a later one for the same debt.
  run(`S=deepClone(DEFAULT_STATE); S.debts=[{id:'d1',name:'Card',initial:100,balance:80,active:true}]; S.payments=[{id:'p1',debtId:'d1',amount:10,localDate:'2026-09-19',date:'2026-09-19T12:00:00',historicalOnly:false,reservationUse:[]},{id:'p2',debtId:'d1',amount:10,localDate:'2026-09-20',date:'2026-09-20T12:00:00',historicalOnly:false,reservationUse:[]}]; var lastToast=''; toast=x=>{lastToast=x}; save=async()=>{};`);
  await run('undoPayment("p1")');
  assert.equal(run('S.payments.length'),2);
  assert.ok(run('lastToast.includes("более поздний")'));

  // Debt sync updates the historical baseline used by import classification.
  context._els={syncDebt:{value:'0'},syncBalanceInput:{value:'90'}}; context.document.getElementById=id=>context._els[id]||null;
  run(`S=deepClone(DEFAULT_STATE); S.debts=[{id:'d1',name:'Loan',balance:100,active:true}]; closeModal=()=>{}; save=async()=>{};`);
  await run('syncBalance()');
  assert.equal(run('S.debts[0].balance'),90);
  assert.ok(run('Date.parse(S.debts[0].balanceVerifiedAt)>0'));

  console.log('OK — Life RPG 8.0.1 operational tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
