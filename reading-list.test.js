"use strict";
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=__dirname;
const context=vm.createContext({
  console, Date, Math, JSON, Intl, Promise, setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0,
  structuredClone:global.structuredClone, crypto:global.crypto,
  document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:{classList:{add(){},remove(){}}}},
  window:{addEventListener:()=>{},scrollTo:()=>{},location:{reload:()=>{}}}, navigator:{}, location:{reload:()=>{}},
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}, Notification:function(){}, confirm:()=>true,
  prompt:()=>"321", Blob:global.Blob, URL:global.URL
});
context.window.window=context.window; context.window.document=context.document;
for(const file of ['core.js','state.js','finance.js','imports.js','work.js','tennis.js','knowledge.js','gamification.js','pwa.js','ui.js']){
  new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file}).runInContext(context)
}
function run(code){return new vm.Script(code).runInContext(context)}
(async()=>{
  const pkg={format:'life-rpg-reading-list-v1',title:'Test',books:[
    {order:1,author:'Author A',title:'Book A'},
    {order:2,author:'Author B',title:'Book B'},
    {order:3,author:'Author C',title:'Book C'}
  ]};
  context.pkg=pkg;
  run('S=deepClone(DEFAULT_STATE)');
  let result=run('mergeReadingListPackage(pkg)');
  assert.equal(result.added.length,3);
  assert.equal(run('S.books.length'),3);
  assert.equal(run('S.books.every(b=>b.status==="queued")'),true);
  assert.deepEqual(Array.from(run('readingQueueSorted().map(b=>b.title)')),['Book A','Book B','Book C']);
  assert.equal(run('currentBook()'),null);

  // Duplicate import must be idempotent.
  result=run('mergeReadingListPackage(pkg)');
  assert.equal(result.added.length,0);
  assert.equal(result.skipped.length,3);
  assert.equal(run('S.books.length'),3);

  // Starting the first queued book asks for actual edition pages and makes only it active.
  run('save=async()=>{}; audit=()=>{}; toast=()=>{}');
  await run('startQueuedBook(S.books[0].id)');
  assert.equal(run('currentBook().title'),'Book A');
  assert.equal(run('currentBook().totalPages'),321);
  assert.equal(run('S.books.filter(b=>b.status==="reading").length'),1);
  assert.equal(run('readingQueueSorted().length'),2);

  // Another queued book cannot be started while one is active.
  context.lastToast='';
  run('toast=x=>{lastToast=x}');
  await run('startQueuedBook(S.books.find(b=>b.title==="Book B").id)');
  assert.equal(run('S.books.find(b=>b.title==="Book B").status'),'queued');
  assert.ok(run('lastToast.includes("Сначала заверши текущую книгу")'));

  console.log('OK — Life RPG 10.0.2 reading-list tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
