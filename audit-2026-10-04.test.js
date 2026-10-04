"use strict";
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
process.env.TZ='Asia/Yekaterinburg';
const RealDate=Date;
class Clock extends RealDate { constructor(...args){super(...(args.length?args:['2026-10-04T15:00:00+05:00']))} static now(){return new RealDate('2026-10-04T15:00:00+05:00').getTime()} }
const els={},ctx=vm.createContext({console,Date:Clock,Math,JSON,Intl,Promise,structuredClone,crypto,setTimeout,clearTimeout,setInterval:()=>0,
 document:{getElementById:id=>els[id]||null,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},navigator:{},localStorage:{getItem:()=>null,setItem(){}},confirm:()=>true});
for(const f of ['core.js','state.js','finance.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),ctx,{filename:f});
const run=s=>vm.runInContext(s,ctx),put=(id,value)=>els[id]={value};
const reset=()=>run(`S=deepClone(DEFAULT_STATE);S.accounts=[{id:'main',name:'Main',verifiedBalance:1000,verifiedAt:'2026-10-04T09:00:00Z',active:true}];S.settings.primaryAccountId='main';S.debts=[{id:'loan',name:'Loan',balance:5000,initial:5000}];save=async()=>{};audit=()=>{};toast=()=>{};closeModal=()=>{};`);
(async()=>{
 for(const value of ['', '   ', 'NaN', 'Infinity', '-1']){
  reset();put('account-sync-main',value);run(`syncAccountBalance('main')`);assert.equal(run('S.accounts[0].verifiedBalance'),1000,`account sync accepted ${JSON.stringify(value)}`);
  reset();put('cashSyncInput',value);await run('syncCashBalance()');assert.equal(run('S.accounts[0].verifiedBalance'),1000,`cash sync accepted ${JSON.stringify(value)}`);
  reset();put('syncDebt','0');put('syncBalanceInput',value);await run('syncBalance()');assert.equal(run('S.debts[0].balance'),5000,`debt sync accepted ${JSON.stringify(value)}`);
 }
 reset();put('account-sync-main','0');run(`syncAccountBalance('main')`);assert.equal(run('S.accounts[0].verifiedBalance'),0,'explicit zero must remain valid');
 reset();for(const [id,v] of Object.entries({incomeDate:'2026-10-04',incomeAmount:'100',incomeAccount:'main',incomeSource:'Salary',incomeNote:'',incomePlanEvent:''}))put(id,v);
 await run('addIncome()');assert.equal(run(`accountBalanceById('main')`),1100,'today income after verification must change cash');
 reset();put('incomeDate','2026-10-03');put('incomeAmount','100');await run('addIncome()');assert.equal(run(`accountBalanceById('main')`),1000,'historical income must not double count verified cash');
 reset();run(`S.assets=[{id:'a',name:'Asset',verifiedValue:900,verifiedAt:'2026-10-03T00:00:00Z',active:true}]`);put('assetName','Asset');put('assetValue','');await run('addAsset()');assert.equal(run('S.assets[0].verifiedValue'),900,'empty asset value must not erase balance');
 for(const value of [NaN,Infinity,'oops',true,{},'']){
  ctx.bad=value;reset();assert.throws(()=>run(`(()=>{const s=deepClone(S);s.expenses=[{id:'e',amount:bad}];return normalizeState(s)})()`),/числ|сумм/,'malformed financial amount accepted');
 }
 reset();run(`S.expenses=[{id:'refund',amount:-100,isRefund:true}]`);assert.equal(run('normalizeState(S).expenses[0].amount'),-100,'refund remains supported');
 for(const [collection,field] of Object.entries({accounts:'verifiedBalance',debts:'balance',payments:'amount',incomeLogs:'amount',bankTransfers:'amount',cashAdjustments:'delta',fundTransfers:'amount',assets:'verifiedValue',assetTransfers:'amount',reservations:'remaining'})){
  ctx.collection=collection;ctx.field=field;
  for(const value of ['broken',Infinity,false]){ctx.bad=value;assert.throws(()=>run(`(()=>{const s=deepClone(DEFAULT_STATE);s[collection]=[{id:'row',[field]:bad}];return normalizeState(s)})()`),/числ/);}
 }
 assert.throws(()=>run(`normalizeState({...DEFAULT_STATE,debts:[{id:'d',balance:-1}]})`),/сумм/);
 for(const f of ['gpt-exchange-13.5.js','gpt-exchange-guidance-13.5.1.js','gpt-exchange-feedback-13.6.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),ctx,{filename:f});
 reset();run(`createPreActionSnapshot=async()=>123;render=()=>{};taskCreate=x=>{const t={...x,id:uid()};S.entities.tasks.push(t);return t};gpt135Store();gpt136Store();GPT135_PREVIEW={boundExport:true,fingerprint:'audit-gpt',fileName:'response.json',payload:{packageId:'audit',tasks:[{include:true,title:'New task',minutes:15}],calendar:[],recommendations:[],assumptions:[],feedbackDecisions:[]}};persist=async()=>{throw Error('disk full')}`);
 const before=run('JSON.stringify(S)');await assert.rejects(run('gpt135Apply()'),/disk full/);
 assert.equal(run('JSON.stringify(S)'),before,'failed GPT import must roll back tasks and receipt');
 assert.equal(run('GPT135_PREVIEW.fingerprint'),'audit-gpt','failed import must remain retryable');
 run('persist=async()=>{}');await run('gpt135Apply()');assert.equal(run('S.entities.tasks.length'),1);assert.equal(run('GPT135_PREVIEW'),null);
 vm.runInContext(fs.readFileSync(__dirname+'/pwa.js','utf8'),ctx,{filename:'pwa.js'});
 const notifications=new Map();ctx.localStorage={getItem:k=>notifications.get(k)||null,setItem:(k,v)=>notifications.set(k,v)};
 ctx.Notification=function(){};ctx.Notification.permission='granted';ctx.window.Notification=ctx.Notification;ctx.navigator.serviceWorker={controller:{}};
 run(`pwaRegistration={showNotification:async()=>{throw Error('notification failure')}}`);
 assert.equal(await run(`notifyOnce('audit','Title','Body')`),false);
 assert.equal(notifications.has('notif:audit'),false,'failed delivery must not suppress the daily reminder');
 run(`pwaRegistration={showNotification:async()=>{}}`);
 assert.equal(await run(`notifyOnce('audit','Title','Body')`),true);assert.equal(notifications.get('notif:audit'),'2026-10-04');
 assert.equal(await run(`notifyOnce('audit','Title','Body')`),false,'successful reminder is deduplicated');
 console.log('OK — audit 2026-10-04: financial inputs, actual income time, backup amounts, GPT rollback and retry');
})().catch(e=>{console.error(e);process.exitCode=1});
