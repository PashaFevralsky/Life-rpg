"use strict";
process.env.TZ="Europe/Amsterdam";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname;
const context=vm.createContext({
  console,Date,Math,JSON,Intl,Number,Promise,structuredClone:global.structuredClone,crypto:global.crypto,
  document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,activeElement:null},
  window:{},navigator:{},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
});
context.window.window=context.window;context.window.document=context.document;
for(const file of ["core.js","tasks-os.js"])new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context);
const run=code=>new vm.Script(code).runInContext(context);

assert.equal(run('validDateKey("2026-02-28")'),true);
assert.equal(run('validDateKey("2028-02-29")'),true);
for(const x of ["2026-02-29","2026-02-31","2026-04-31","2026-13-01","2026-00-10","2026-01-00","26-01-01"])assert.equal(run(`validDateKey(${JSON.stringify(x)})`),false,x);

// Europe/Amsterdam enters DST on 2026-03-29: calendar-day math must still be exact.
assert.equal(run('daysBetween(new Date(2026,2,28,12),new Date(2026,2,30,12))'),2);
assert.equal(run('dateKeyDiff("2026-03-28","2026-03-30")'),2);
assert.equal(run('dateKeyDiff("2026-10-24","2026-10-26")'),2);

run(`S={entities:{tasks:[
  {id:"a",title:"A",status:"active",blockedByIds:["b"],dueDate:"",plannedDate:"",notBefore:"",priority:2},
  {id:"b",title:"B",status:"active",blockedByIds:[],dueDate:"",plannedDate:"",notBefore:"",priority:2}
]}}`);
assert.equal(run('taskWouldCreateCycle("b","a")'),true,"B -> A would close A -> B -> A");
assert.equal(run('taskWouldCreateCycle("a","a")'),true,"self dependency must be rejected");
assert.equal(run('taskWouldCreateCycle("a","b")'),false);

const normalized=run('taskNormalize({id:"x",dueDate:"2026-02-31",plannedDate:"2026-13-01",notBefore:"2026-02-29",blockedByIds:["x","a","a"]})');
assert.equal(normalized.dueDate,"");
assert.equal(normalized.plannedDate,"");
assert.equal(normalized.notBefore,"");
assert.deepEqual(Array.from(normalized.blockedByIds),["a"]);

run(`S.entities.tasks=[{id:"d",title:"DST",status:"active",blockedByIds:[],dueDate:"2026-03-30",plannedDate:"",notBefore:"",priority:2}]`);
const originalLocalDateKey=run("localDateKey");
context.localDateKey=()=> "2026-03-28";
assert.equal(run('taskHealth(S.entities.tasks[0]).days'),2);

console.log("OK — Stage 2.1 core correctness: strict dates, DST-safe day math, task dependency cycles");
