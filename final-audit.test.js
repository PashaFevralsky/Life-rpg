"use strict";
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=__dirname;
const context=vm.createContext({
  console, Date, Math, JSON, Intl, Promise, setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0,
  structuredClone:global.structuredClone, crypto:global.crypto,
  btoa:s=>Buffer.from(s,'binary').toString('base64'), atob:s=>Buffer.from(s,'base64').toString('binary'),
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
  // Large encrypted-backup base64 helper must handle MB-scale buffers.
  assert.equal(run('base64ToBytes(bytesToBase64(new Uint8Array(1024*1024))).length'),1024*1024);

  // Normalization preserves profile timestamps and does not invent a debt verification timestamp from state.updated.
  run(`var nr=normalizeState({version:16,created:'2026-01-01T00:00:00Z',updated:'2026-09-01T00:00:00Z',debts:[{id:'d',name:'D',balance:100,initial:100}]});`);
  assert.equal(run('nr.created'),'2026-01-01T00:00:00Z');
  assert.equal(run('nr.updated'),'2026-09-01T00:00:00Z');
  assert.equal(run('nr.debts[0].balanceVerifiedAt'),'');

  // Negative post-anchor account ledger is visible instead of silently clamped to zero.
  run(`S=deepClone(DEFAULT_STATE); S.accounts=[{id:'a',name:'A',verifiedBalance:100,verifiedAt:'2026-09-20T08:00:00Z',active:true}]; S.settings.primaryAccountId='a'; S.expenses=[{id:'e',accountId:'a',amount:150,dateKey:'2026-09-20',date:'2026-09-20T12:00:00Z'}];`);
  assert.equal(run('accountBalanceById("a")'),-50);

  // Historical import cutoff is account-specific.
  run(`S=deepClone(DEFAULT_STATE); S.accounts=[{id:'a',name:'A',verifiedBalance:0,verifiedAt:'2026-09-20T12:00:00Z',active:true},{id:'b',name:'B',verifiedBalance:0,verifiedAt:'2026-09-10T12:00:00Z',active:true}]; S.settings.primaryAccountId='a'; S.settings.cashBalanceVerifiedAt='2026-09-20T12:00:00Z';`);
  assert.equal(run('importIsHistorical("2026-09-15","2026-09-15T12:00:00Z","a")'),true);
  assert.equal(run('importIsHistorical("2026-09-15","2026-09-15T12:00:00Z","b")'),false);

  // Backdated activity date wins over a conflicting creation timestamp for account ledger cutoffs.
  assert.equal(run('eventTs({dateKey:"2026-09-10",date:"2026-09-20T12:00:00Z"})'),Date.parse('2026-09-10T12:00:00'));

  // Sync of a different debt must not lock undo on this debt; sync of the same debt must.
  run(`S=deepClone(DEFAULT_STATE); S.debts=[{id:'d1',balance:100},{id:'d2',balance:100}]; var pp={debtId:'d1',debtIndex:0,date:'2026-09-20T10:00:00Z'}; S.balanceHistory=[{type:'sync',debtId:'d2',ts:'2026-09-20T11:00:00Z'}];`);
  assert.equal(run('paymentLockedBySync(pp)'),false);
  run(`S.balanceHistory.push({type:'sync',debtId:'d1',ts:'2026-09-20T12:00:00Z'});`);
  assert.equal(run('paymentLockedBySync(pp)'),true);

  // Overdue debt must be included on projection day 0 and lower the safe balance.
  run(`S=deepClone(DEFAULT_STATE); const tk=localDateKey(); const y=localDateKey(addDays(new Date(),-5)); S.accounts=[{id:'a',name:'A',verifiedBalance:10000,verifiedAt:new Date().toISOString(),active:true}]; S.settings.primaryAccountId='a'; S.settings.dailySpendLimit=0; S.debts=[{id:'d1',name:'Late',balance:10000,min:3000,nextPaymentAmount:3000,nextPaymentDate:y,paymentMode:'fixed',rate:20,active:true}];`);
  assert.equal(run('overdueMinimums().reduce((s,x)=>s+x.amount,0)'),3000);
  assert.equal(run('projectionPaymentEvents(new Date(),addDays(new Date(),10))[0].dateKey'),run('localDateKey()'));
  assert.equal(run('buildFinancialProjection(1).endingBalance'),7000);

  // Zero work target disables the quest instead of making it instantly claimable.
  run(`S=deepClone(DEFAULT_STATE); S.workTargets.contacts=0;`);
  assert.equal(run('WORK_WEEKLY.find(q=>q.id==="contacts20").enabled()'),false);
  assert.equal(run('renderQuestGroup(WORK_WEEKLY,"work").includes("0 новых целевых контактов")'),false);

  // Zero high-interest threshold is respected.
  run(`S=deepClone(DEFAULT_STATE); S.settings.highInterestThreshold=0; S.debts=[{id:'d',name:'Zero rate',balance:100,rate:0,rateKnown:true,min:10,active:true}];`);
  assert.equal(run('highestHighInterestDebt().id'),'d');

  // Restore of a deleted imported expense must re-consume its reservation and reverse compensation-delete adjustment.
  run(`S=deepClone(DEFAULT_STATE); S.reservations=[{id:'r',type:'living',remaining:100,status:'active'}]; S.cashAdjustments=[{id:'c',importBatchId:'b',delta:0}]; S.trash=[{kind:'expense',item:{id:'e',amount:50,dateKey:localDateKey(),reservationUse:[{id:'r',amount:20}],importBatchId:'b',importCashContribution:-50}}]; save=async()=>{}; audit=()=>{}; toast=()=>{};`);
  await run('restoreLastDeleted()');
  assert.equal(run('S.reservations[0].remaining'),80);
  assert.equal(run('S.cashAdjustments[0].delta'),50);
  assert.equal(run('S.expenses.length'),1);
  assert.equal(run('S.trash.length'),0);

  // Same-balance debt edit must preserve verification time; changed balance creates a new checkpoint.
  context._els={debtEditId:{value:'d1'},debtName:{value:'Loan'},debtBalance:{value:'100'},debtRate:{value:'20'},debtMin:{value:'10'},debtDueDay:{value:'5'},debtType:{value:'Кредит'},debtLimit:{value:'0'},debtNextPaymentDate:{value:'2026-10-05'},debtNextPaymentAmount:{value:'10'},debtPaymentMode:{value:'fixed'},debtRateKnown:{checked:true}};
  context.document.getElementById=id=>context._els[id]||null;
  run(`S=deepClone(DEFAULT_STATE); S.debts=[{id:'d1',name:'Loan',initial:100,balance:100,rate:10,min:10,dueDay:5,type:'Кредит',limit:0,nextPaymentDate:'2026-10-05',nextPaymentAmount:10,paymentMode:'fixed',rateKnown:true,balanceVerifiedAt:'2026-09-01T10:00:00Z',active:true}]; persist=async()=>{}; render=()=>{}; editDebt=()=>{}; toast=()=>{}; audit=()=>{};`);
  await run('saveDebtForm()');
  assert.equal(run('S.debts[0].balanceVerifiedAt'),'2026-09-01T10:00:00Z');
  assert.equal(run('S.balanceHistory.filter(x=>x.type==="sync").length'),0);
  context._els.debtBalance.value='90';
  await run('saveDebtForm()');
  assert.notEqual(run('S.debts[0].balanceVerifiedAt'),'2026-09-01T10:00:00Z');
  assert.equal(run('S.balanceHistory.filter(x=>x.type==="sync"&&x.debtId==="d1").length'),1);


  // A stale fixed-loan date still projects the next recurring payment after the overdue one.
  run(`S=deepClone(DEFAULT_STATE); const old=localDateKey(addDays(new Date(),-5)); S.debts=[{id:'f',name:'Fixed',balance:50000,min:3000,nextPaymentAmount:3000,nextPaymentDate:old,paymentMode:'fixed',rate:20,active:true}];`);
  assert.ok(run('debtEventsBetween(new Date(),addDays(new Date(),40)).some(x=>x.debtId==="f"&&x.estimated)'));

  // Payment allocation is tied to the due month, so a late/early payment can advance the stored schedule.
  run(`S=deepClone(DEFAULT_STATE); S.debts=[{id:'d',name:'D',balance:10000,min:1000,nextPaymentAmount:1000,nextPaymentDate:'2026-09-30',paymentMode:'fixed',active:true}]; S.payments=[{id:'p',debtId:'d',debtIndex:0,amount:1000,monthKey:'2026-10',dueMonth:'2026-09'}]; advanceDebtScheduleAfterPayment(S.debts[0],0);`);
  assert.equal(run('S.debts[0].nextPaymentDate'),'2026-10-30');

  // Historical debt imports preserve full payment amount and do not consume current reservations.
  run(`S=deepClone(DEFAULT_STATE); S.debts=[{id:'d',name:'D',balance:100,balanceVerifiedAt:'2026-09-20T12:00:00Z',active:true}]; S.reservations=[{id:'r',type:'debt',debtIndex:0,remaining:50,status:'active',createdAt:'2026-09-20T00:00:00Z'}]; S.accounts=[{id:'a',name:'A',verifiedBalance:0,verifiedAt:'2026-09-20T12:00:00Z',active:true}]; S.settings.primaryAccountId='a';`);
  await run('applyImportedCandidates([{include:true,type:"debt_payment",amount:250,dateKey:"2026-09-10",desc:"D",debtId:"d",accountId:"a"}],"csv")');
  assert.equal(run('S.payments[0].amount'),250);
  assert.equal(run('S.payments[0].historicalOnly'),true);
  assert.equal(run('S.reservations[0].remaining'),50);

  // Internal tennis Elo respects an explicitly configured zero base value.
  run(`S=deepClone(DEFAULT_STATE); S.settings.tennisBaseElo=0; S.tennis=[];`);
  assert.equal(run('computeTennisElo().rating'),0);

  // AI package application creates a pre-action snapshot before mutations.
  assert.ok(run('applyAiImportQueue.toString().includes("createPreActionSnapshot")'));

  // Data diagnostics catches key unsafe local-state conditions.
  run(`S=deepClone(DEFAULT_STATE); S.accounts=[{id:'a',name:'A',verifiedBalance:10,verifiedAt:'',active:true}]; S.settings.primaryAccountId='a'; S.debts=[{id:'d',name:'D',balance:100,nextPaymentDate:'',active:true}];`);
  const di=run('dataIntegrityIssues()');
  assert.ok(di.some(x=>x.title.includes('Счёт не сверялся')));
  assert.ok(di.some(x=>x.title.includes('Нет следующей даты')));

  // UX: inbox shortcut must open the dedicated Bank view in 9.0.0.
  assert.ok(run('ux7OpenInbox.toString().includes("finance\",\"bank")'));

  console.log('OK — Life RPG 9.0.0 final audit tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
