"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname,els={};
const context=vm.createContext({
  console,Date,Math,JSON,Intl,Promise,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,structuredClone:global.structuredClone,crypto:global.crypto,
  document:{getElementById:id=>els[id]||null,querySelectorAll:()=>[],addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}}},navigator:{},location:{reload:()=>{}},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},Notification:function(){},confirm:()=>true,prompt:()=>"300",Blob:global.Blob,URL:global.URL
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","state.js","finance.js","imports.js","work.js","tennis.js","knowledge.js","gamification.js","pwa.js","ui.js"]){new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context)}
const run=code=>new vm.Script(code).runInContext(context);
(async()=>{
  // Work OS: overdue deal is the top action, and weighted pipeline contributes to forecast.
  run(`S=deepClone(DEFAULT_STATE); S.settings.workMonthlyPlan=1000000; S.crmDeals=[{id:'d1',name:'Big',potential:600000,stage:'Тендер',probability:50,nextStep:'Позвонить',nextDate:'2020-01-01',closeDate:localMonthKey()+'-28',city:'Екб',client:'A',investor:'B',manufacturers:'VEZA',competitor:'VEZA',projectDocs:'Р',lpr:'Иван'}];`);
  assert.equal(run('crmDecisionEngine()[0].dealId'),'d1');
  assert.equal(run('crmForecastData().weighted'),300000);

  // CRM realization can be booked once and becomes factual Work sales.
  run(`createPreActionSnapshot=async()=>1; save=async()=>{}; audit=()=>{}; toast=()=>{}; S.crmDeals[0].stage='Выиграно'; S.crmDeals[0].realizedAmount=550000; S.crmDeals[0].realizationDate=localDateKey();`);
  await run('recordCrmRealization("d1")');
  assert.equal(run('workMonth().sales'),550000);assert.equal(run('S.workLogs.filter(x=>x.sourceDealId==="d1").length'),1);
  await run('recordCrmRealization("d1")');assert.equal(run('S.workLogs.filter(x=>x.sourceDealId==="d1").length'),1);

  // Tennis OS: unrated opponents do not alter internal Elo; rated individual matches do.
  run(`S=deepClone(DEFAULT_STATE); S.settings.tennisBaseElo=1000; S.tennis=[{id:'u',dateKey:'2026-09-01',createdAt:'2026-09-01T12:00:00',min:60,load:5,w:1,l:0,opponent:'Unknown',opponentRating:0}];`);
  assert.equal(run('computeTennisElo().rating'),1000);
  run(`S.tennis.push({id:'r',dateKey:'2026-09-02',createdAt:'2026-09-02T12:00:00',min:60,load:5,matches:[{id:'m',opponent:'Rated',opponentRating:1200,result:'W'}]});`);
  assert.ok(run('computeTennisElo().rating')>1000);assert.equal(run('tennisAllMatches().length'),2);
  context.matchText='A | 1300 | W | 3:1 | ok\nB | 1250 | L | 2:3';
  assert.deepEqual(Array.from(run('parseTennisMatches(matchText).map(x=>x.result)')),['W','L']);

  // Knowledge OS: queue order can be changed, paused book can resume, review queue is derived from notes.
  run(`S=deepClone(DEFAULT_STATE); S.books=[{id:'b1',title:'A',status:'queued',readingOrder:1,totalPages:100,currentPage:0},{id:'b2',title:'B',status:'queued',readingOrder:2,totalPages:100,currentPage:0}]; save=async()=>{}; audit=()=>{}; toast=()=>{};`);
  await run('moveBookQueue("b2",-1)');assert.equal(run('readingQueueSorted()[0].id'),'b2');
  await run('startQueuedBook("b2")');assert.equal(run('currentBook().id'),'b2');
  run(`S.readingLogs=[{id:'rr',bookId:'b2',dateKey:localDateKey(),minutes:30,pages:10,note:'Тезис',application:'Применить'}]; recomputeBookProgress('b2');`);
  assert.equal(run('S.books.find(b=>b.id==="b2").currentPage'),10);assert.equal(run('knowledgeReviewQueue().length'),1);

  // Life OS: reading quest is factual/automatic; cross-domain diagnostics catch multiple active books and CRM hygiene.
  run(`S.settings.readingDailyMin=30; S.checks={}; syncAutoDailyQuests();`);assert.equal(run('dailyQuestState("read")'),true);
  run(`S.books.push({id:'b3',title:'C',status:'reading',totalPages:50,currentPage:0}); S.crmDeals=[{id:'c',name:'No next',potential:100000,stage:'Контакт',probability:20,nextStep:'',nextDate:''}];`);
  const issues=run('dataIntegrityIssues()');assert.ok(issues.some(x=>x.title.includes('несколько книг')));assert.ok(issues.some(x=>x.title.includes('CRM без следующего шага')));

  // Universal trash can restore non-finance objects.
  run(`S=deepClone(DEFAULT_STATE); S.workLogs=[]; S.trash=[{kind:'work',item:{id:'w1',date:localDateKey(),sales:0,contacts:1,followups:0,lpr:0,meetings:0,proposals:0,wins:0,pipeline:0,xpAward:3}}]; save=async()=>{}; audit=()=>{}; toast=()=>{};`);
  await run('restoreLastDeleted()');assert.equal(run('S.workLogs.length'),1);assert.equal(run('S.trash.length'),0);

  console.log('OK — Life RPG 10.0.0 deep domain tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
