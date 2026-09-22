"use strict";
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements={},memory=new Map();let rejectLocal=false;
const context=vm.createContext({console,Date,Math,JSON,Intl,Promise,setTimeout,clearTimeout,setInterval:()=>0,structuredClone,crypto,
 document:{getElementById:id=>elements[id]||(elements[id]={textContent:'',value:'',classList:{remove(){}}}),documentElement:{classList:{remove(){}}},querySelectorAll:()=>[],addEventListener(){},body:{classList:{add(){},remove(){}}}},
 window:{addEventListener(){},location:{}},navigator:{},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>{if(rejectLocal)throw Error('quota');memory.set(k,v)},removeItem:k=>memory.delete(k)},requestAnimationFrame:f=>f(),confirm:()=>true,prompt:()=>null});
for(const f of ['core.js','state.js','finance.js','imports.js','work.js','tennis.js','knowledge.js','gamification.js','ui.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),context,{filename:f});
const run=s=>vm.runInContext(s,context);const realDbPut=run("dbPut");const reset=()=>{memory.clear();rejectLocal=false;run(`S=deepClone(DEFAULT_STATE);storageLoadBlocked=false;persistenceQueue=Promise.resolve();db={};render=()=>{};toast=()=>{};runReminderCheck=()=>{};checkAchievements=()=>false;openDB=async()=>db;dbGetAll=async()=>[];dbDelete=async()=>{};dbPut=async()=>{};dbGet=async()=>null;`)};
(async()=>{
 reset();run(`dbGet=async()=>({...deepClone(DEFAULT_STATE),updated:'2026-09-01T00:00:00Z',profile:{name:'old'}})`);
 memory.set('lifeRpg4',JSON.stringify({...run('deepClone(DEFAULT_STATE)'),updated:'2026-09-02T00:00:00Z',profile:{name:'new'}}));
 await run('loadState()');assert.equal(run('S.profile.name'),'new');
 reset();memory.set('lifeRpg4','{broken');run(`dbGet=async()=>({...deepClone(DEFAULT_STATE),profile:{name:'database'}})`);await run('loadState()');assert.equal(run('S.profile.name'),'database');
 reset();memory.set('lifeRpg4','{broken');await run('loadState()');assert.equal(run('storageLoadBlocked'),true);assert.equal(memory.get('lifeRpg4'),'{broken');
 reset();run('dbPut=async()=>{throw Error("abort")}');await run('persist()');assert.ok(memory.has('lifeRpg4'));
 reset();rejectLocal=true;run('dbPut=async()=>{throw Error("abort")}');await assert.rejects(run('persist()'),/сохранить/);
 reset();run(`globalThis.saved=[];dbPut=async(store,x)=>{if(store==='state'){await new Promise(r=>setTimeout(r,5));saved.push(x.profile.name)}};S.profile.name='first';globalThis.first=persist();S.profile.name='second';globalThis.second=persist();`);await run('Promise.all([first,second])');assert.deepEqual(Array.from(run('saved')),['first','second']);
 // A successful IDB request followed by a transaction abort must reject.
 reset();context.tx={objectStore:()=>({put:()=>({})})};context.originalDbPut=realDbPut;run('db={transaction:()=>tx};dbPut=originalDbPut');const aborted=run('dbPut("state",{},"current")');context.tx.onabort();await assert.rejects(aborted,/отменена/);
 reset();run(`globalThis.raw={...deepClone(DEFAULT_STATE),accounts:[{id:'real',verifiedAt:'2026-09-01',verifiedBalance:10}],incomeLogs:[{id:'i',accountId:'main'}]};normalizeState(raw)`);assert.equal(run('raw.incomeLogs[0].accountId'),'main');assert.throws(()=>run('normalizeState({accounts:[null]})'),/Повреждённая/);
 reset();assert.equal(run('normalizeState({settings:{tennisElo:1350}}).settings.tennisBaseElo'),1350);
 // Double tap races through an asynchronous snapshot only once.
 reset();run(`save=async()=>{};createPreActionSnapshot=async()=>{await new Promise(r=>setTimeout(r,5))};S.crmDeals=[{id:'d',name:'Sale',realizedAmount:100,realizationDate:localDateKey()}]`);await run('Promise.all([recordCrmRealization("d"),recordCrmRealization("d")])');assert.equal(run('S.workLogs.length'),1);
 // Restoring a deleted realization cannot duplicate a newly recorded one.
 run(`S.trash=[{kind:'work',item:{id:'old',sourceDealId:'d',sales:100,date:localDateKey()}}]`);await run('restoreLastDeleted()');assert.equal(run('S.workLogs.length'),1);assert.equal(run('S.trash.length'),1);
 reset();run(`save=async()=>{};S.workLogs=[{id:'a',date:localDateKey(),xpAward:110}];S.trash=[{kind:'work',item:{id:'b',date:localDateKey(),xpAward:50}}]`);await run('restoreLastDeleted()');assert.equal(run('workXpOnDate(localDateKey())'),120);
 // Removing an earlier reading session revokes a now-invalid completion bonus.
 reset();run(`S.books=[{id:'b',status:'done',totalPages:100,currentPage:100},{id:'next',status:'reading',totalPages:200}];S.readingLogs=[{id:'late',bookId:'b',dateKey:'2026-09-01',minutes:30,pages:50,xpAward:320,completionBonus:300,baseXpAward:20}];S.xpEarned=320;S.stats['Разум']=320;recomputeBookProgress('b');reconcileReadingAwards()`);assert.equal(run('S.books[0].status'),'paused');assert.equal(run('S.readingLogs[0].completionBonus'),0);assert.equal(run('S.xpEarned'),20);
 run(`S.readingLogs.push({id:'z',bookId:'b',dateKey:'2026-09-01',minutes:60,pages:10,baseXpAward:0,xpAward:0});reconcileReadingAwards()`);assert.equal(run('readingBaseXpOnDate("2026-09-01")'),40);
 reset();run(`S.settings.incomeEvents=[5,15,20].map(day=>({id:'income'+day,day,label:'Доход '+day,amount:50000}));S.incomeLogs=S.settings.incomeEvents.map(e=>({id:e.id,dateKey:'2026-09-'+String(e.day).padStart(2,'0'),amount:10000,plannedEventId:e.id,plannedMonth:'2026-09'}))`);assert.equal(run('S.settings.incomeEvents.reduce((n,e)=>n+plannedIncomeForecastAmount(e,2026,8,new Date(2026,8,20)),0)'),0);
 // Historical daily quests must be revoked after historical source data disappears.
 run(`S.checks={};S.readingLogs=[{id:'r',dateKey:'2026-09-01',minutes:30}];syncAutoDailyQuests();S.readingLogs=[];syncAutoDailyQuests()`);assert.equal(run('!!S.checks["2026-09-01"].read'),false);
 reset();run(`S.tennis=[{id:'a',dateKey:'2026-09-01',opponentRating:1000,w:1,l:0},{id:'b',dateKey:'2026-09-01',opponentRating:1000,w:0,l:1}];globalThis.rating=computeTennisElo().rating;S.tennis.reverse()`);assert.equal(run('computeTennisElo().rating'),run('rating'));
 console.log('OK — reliability: storage recovery, commit/abort, write order, normalization, CRM race, trash, reading XP, historical quests, Elo');
})().catch(e=>{console.error(e);process.exitCode=1});
