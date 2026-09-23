"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert"),root=__dirname;
const ctx=vm.createContext({console,Date,Math,JSON,Intl,Promise,structuredClone:global.structuredClone,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,Map,Set,Number,String,Array,Object,RegExp,document:{getElementById:()=>null,querySelectorAll:()=>[]},window:{},toast:()=>{},audit:()=>{},save:async()=>{},addXp:()=>{},removeXp:()=>{}});ctx.window=ctx;ctx.activeDay=()=>false;ctx.renderKnowledgeBase=()=>{};ctx.S={settings:{knowledgeNotes:[]},entities:{tasks:[],goals:[],routines:[],routineLogs:[],inbox:[]}};
for(const f of ["core.js","tasks-os.js","goals-os.js","routines-os.js"]){new vm.Script(fs.readFileSync(path.join(root,f),"utf8"),{filename:f}).runInContext(ctx)}
new vm.Script(fs.readFileSync(path.join(root,"inbox-os.js"),"utf8"),{filename:"inbox-os.js"}).runInContext(ctx);
const run=code=>new vm.Script(code).runInContext(ctx);
for(const [label,seed,read,store] of [
 ["task",`S.entities.tasks=[{id:'t',title:'T'}]`,`taskAll()`,`S.entities.tasks[0]`],
 ["goal",`S.entities.goals=[{id:'g',title:'G'}]`,`goalAll()`,`S.entities.goals[0]`],
 ["routine",`S.entities.routines=[{id:'r',title:'R'}]`,`routineAll()`,`S.entities.routines[0]`],
 ["inbox",`S.entities.inbox=[{id:'i',text:'I'}]`,`inboxAll()`,`S.entities.inbox[0]`],
]){run(seed);const before=run(store);run(read);const after=run(store);assert.strictEqual(after,before,`${label} read must preserve object identity`)}
run(`S.entities.tasks=[{id:'t',title:'T',actualMinutes:0}]`);const ref=run(`taskAll()[0]`);run(`taskAll();taskAll()[0].actualMinutes=5`);assert.strictEqual(run(`S.entities.tasks[0]`),ref);assert.equal(ref.actualMinutes,5);
console.log("OK — entity reads preserve object identity");
