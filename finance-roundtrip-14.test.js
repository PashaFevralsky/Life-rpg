"use strict";
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console,Date,Math,JSON,Intl,Promise,setTimeout,clearTimeout,setInterval:()=>0,structuredClone,crypto,
 document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{classList:{add(){},remove(){}}}},
 window:{addEventListener(){},location:{}},navigator:{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},confirm:()=>true,prompt:()=> 'ЗАМЕНИТЬ ФИНАНСЫ'});
for(const f of ['core.js','state.js','finance.js','imports.js','work.js','tennis.js','knowledge.js','gamification.js','ui.js','finance-rebuild-14.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),ctx,{filename:f});
const run=s=>vm.runInContext(s,ctx),plain=x=>JSON.parse(JSON.stringify(x));
const reset=()=>run(`S=deepClone(DEFAULT_STATE);S.accounts=[{id:'main',name:'Основной',type:'Счёт',verifiedBalance:10000,verifiedAt:'2026-09-01T00:00:00Z',active:true},{id:'other',name:'Другой',type:'Счёт',verifiedBalance:2000,verifiedAt:'2026-09-01T00:00:00Z',active:true}];S.settings.primaryAccountId='main';S.settings.reportStart='2026-09-01';S.settings.reportStartMigration='report-boundary-core-v1';S.settings.reportStartCleanupVersion='13.9.1-core';S.settings.reportStartEnvelopeFixVersion='13.9.1-core';S.settings.forecastIncomeFactor=0;S.settings.highInterestThreshold=0;S.profile.name='Проверка';S.xpEarned=123;S.stats['Карьера']=123;S.workLogs=[{id:'work1',date:'2026-09-02',sales:100,xpAward:123}];S.debts=[];S.assets=[];S.regularPayments=[];audit=()=>{};render=()=>{};toast=()=>{};createPreActionSnapshot=async()=>123;persist=async()=>{};renderFinanceRebuild14=()=>{}`);
const metrics=()=>plain(run(`({accounts:S.accounts.map(a=>[a.id,accountBalanceById(a.id)]),debts:S.debts.map(d=>[d.id,d.balance]),assets:S.assets.map(a=>[a.id,assetValueById(a.id)]),fund:S.settings.emergencyFundBalance,reserved:reservedCashTotal()})`));
async function roundtrip(){
 run(`globalThis.exported=financeRebuild14CurrentPackage();globalThis.pkg=financeRebuild14NormalizePackage(JSON.parse(JSON.stringify(exported)));FINANCE_REBUILD14_PREVIEW={fileName:'test.json',pkg,quality:financeRebuild14PackageIssues(pkg),counts:financeRebuild14Counts(pkg)};`);
 assert.equal(run('FINANCE_REBUILD14_PREVIEW.quality.blocker'),0);
 await run('financeRebuild14Apply()');
}
(async()=>{
 reset();run(`S.settings.emergencyFundBalance=1000;S.fundTransfers=[{id:'fund1',date:'2026-09-02T12:00:00Z',dateKey:'2026-09-02',direction:'toFund',amount:1000,accountId:'main'}];S.cashAdjustments=[{id:'adjust1',date:'2026-09-02T13:00:00Z',dateKey:'2026-09-02',delta:-25.15,accountId:'other'}];S.bankTransfers=[{id:'t1',amount:500,date:'2026-09-02T12:00:00Z',dateKey:'2026-09-02',syncAccountId:'main',syncEffect:-500,note:'Перевод'},{id:'t2',amount:250,date:'2026-09-02T12:00:00Z',dateKey:'2026-09-02',fromAccountId:'main',toAccountId:'other',note:'Между счетами'}];S.debts=[{id:'d1',name:'Кредит',type:'Кредит',initial:1000,balance:900,rate:20,min:100,dueDay:10,balanceVerifiedAt:'2026-09-01T00:00:00Z',active:true}];S.payments=[{id:'p1',debtId:'d1',debt:'Кредит',debtIndex:0,amount:100,date:'2026-09-02T12:00:00Z',localDate:'2026-09-02',monthKey:'2026-09',accountId:'main',historicalOnly:false}];S.expenses=[{id:'e1',amount:30,accountId:'main',dateKey:'2026-09-02',date:'2026-09-02T12:00:00Z',note:'Платёж по кредиту',category:'Комиссия'}];S.assets=[{id:'a1',name:'Актив',verifiedValue:300,verifiedAt:'2026-09-01T00:00:00Z',active:true}];S.assetTransfers=[{id:'at1',amount:20,date:'2026-09-02T12:00:00Z',dateKey:'2026-09-02',accountId:'main',assetId:'a1',direction:'fromAsset'}];S.reservations=[{id:'res1',planId:'plan1',type:'living',amount:75,remaining:75,status:'active',createdAt:new Date().toISOString(),untilDate:localDateKey()}];S.envelopeCarryovers={'2026-10':{'Еда':123}};S.bankImportIds=['test-fingerprint'];`);
 const before=metrics(),ledger=plain(run('financeRebuild14FinancialSnapshot(S)')),progress=plain(run('financeRebuild14ProtectedSnapshot(S)'));
 for(let i=0;i<2;i++){
   await roundtrip();assert.deepEqual(metrics(),before);
   assert.deepEqual(plain(run('financeRebuild14FinancialSnapshot(S)')),ledger);
   assert.deepEqual(plain(run('financeRebuild14ProtectedSnapshot(S)')),progress);
 }
 run('S=normalizeState(JSON.parse(JSON.stringify(S)))');assert.deepEqual(metrics(),before,'reload changes balances');
 assert.equal(run('S.debts[0].balance'),900);assert.equal(run('S.expenses[0].category'),'Комиссия');
 assert.equal(run('S.settings.forecastIncomeFactor'),0);assert.equal(run('S.settings.highInterestThreshold'),0);
 // All five defect paths are exercised using production functions, not contract mocks.
 reset();await run(`applyImportedCandidates([{include:true,dateKey:'2026-09-02',occurredAt:'2026-09-02T12:00:00Z',amount:100,type:'expense',category:'Комиссия',desc:'Платёж по кредиту',accountId:'main'}],'finance-rebuild')`);
 assert.equal(run('S.expenses.length'),1);assert.equal(run('S.payments.length'),0);
 await run(`applyImportedCandidates([{include:true,dateKey:'2026-09-02',amount:50,type:'transfer',desc:'Брокерский счет',accountId:'main',ocrSign:'-'}],'screenshot')`);
 assert.equal(run('S.bankTransfers.length'),1);assert.equal(run('S.assetTransfers.length'),0);
 for(const bad of ['ошибка','12 000','',true,{},-1]){
   ctx.bad=bad;
   assert.throws(()=>run(`(()=>{const p=financeRebuild14Template();p.accounts[0].verifiedBalance=bad;return financeRebuild14NormalizePackage(p)})()`),/число|сумма/);
 }
 assert.throws(()=>run(`(()=>{const p=financeRebuild14CurrentPackage();p.financialState.accounts[0].verifiedBalance='ошибка';return financeRebuild14NormalizePackage(p)})()`),/число/);
 assert.throws(()=>run(`(()=>{const p=financeRebuild14CurrentPackage();delete p.financialState.fundTransfers;return financeRebuild14NormalizePackage(p)})()`),/fundTransfers/);
 assert.throws(()=>run(`(()=>{const p=financeRebuild14CurrentPackage();p.financialState.profile={name:'intruder'};return financeRebuild14NormalizePackage(p)})()`),/постороннее/);
 assert.throws(()=>run(`financeRebuild14NormalizePackage({...financeRebuild14Template(),note:'Экспорт текущего финансового контура Life RPG'})`),/старый/);
 // A failed durable commit restores the exact pre-import state.
 reset();run(`globalThis.pkg=financeRebuild14NormalizePackage(financeRebuild14CurrentPackage());pkg.snapshot.accounts[0].verifiedBalance=555;FINANCE_REBUILD14_PREVIEW={fileName:'fail.json',pkg,quality:financeRebuild14PackageIssues(pkg)};persist=async()=>{throw Error('disk failure')}`);
 const old=plain(run('S'));await assert.rejects(run('financeRebuild14Apply()'),/disk failure/);assert.deepEqual(plain(run('S')),old);
 console.log('OK — Finance snapshot: exact repeatable roundtrip, reload, debt/reserve/transfers, explicit types, strict amounts, protected progress and rollback');
})().catch(e=>{console.error(e);process.exitCode=1});
