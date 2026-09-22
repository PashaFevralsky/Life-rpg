"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const context=vm.createContext({console,Date,Math,JSON,Intl,Promise,structuredClone:global.structuredClone,crypto:global.crypto,setTimeout,clearTimeout,document:{getElementById(){return null}},window:{},localStorage:{getItem(){return null},setItem(){},removeItem(){}},indexedDB:{}});context.window.window=context.window;
for(const file of ["core.js","state.js"])new vm.Script(fs.readFileSync(path.join(__dirname,file),"utf8"),{filename:file}).runInContext(context);
const run=s=>new vm.Script(s).runInContext(context);
assert.equal(run("STATE_VERSION"),18);
const migrated=run(`normalizeState({version:17,settings:{decisionPreferences:{x:{scoreDelta:20}},executionHorizonDays:7,projects:[{id:'p',title:'P'}],tasks:[{id:'t',title:'T'}],goals:[{id:'g',title:'G'}],routines:[{id:'r',title:'R'}],routineLogs:[{id:'rl',routineId:'r',dateKey:'2026-09-22'}],reviews:[{id:'rv',kind:'week'}],inbox:[{id:'i',text:'I'}],calendarEvents:[{id:'c',title:'C'}]}})`);
for(const key of ["projects","tasks","goals","routines","routineLogs","reviews","inbox","calendarEvents"]){assert.equal(migrated.entities[key].length,1,key);assert.equal(Object.prototype.hasOwnProperty.call(migrated.settings,key),false,`legacy ${key} must be removed from settings`)}
assert.equal(migrated.settings.decisionPreferences.x.scoreDelta,20);assert.equal(migrated.settings.executionHorizonDays,7);
context.migrated=migrated;const twice=run("normalizeState(migrated)");for(const key of Object.keys(migrated.entities)){assert.equal(twice.entities[key].length,migrated.entities[key].length,`idempotent ${key}`);assert.deepEqual(twice.entities[key].map(x=>x.id),migrated.entities[key].map(x=>x.id),`stable ids ${key}`)}
assert.throws(()=>run("normalizeState({version:18,settings:{}})"),/entities/);
assert.throws(()=>run("normalizeState({version:18,settings:{},entities:{projects:[{title:'bad'}],tasks:[],goals:[],routines:[],routineLogs:[],reviews:[],inbox:[],calendarEvents:[]}})"),/entities\.projects/);

assert.throws(()=>run("normalizeState({version:18,settings:{},entities:{projects:[],tasks:[{id:'t',blockedByIds:'bad'}],goals:[],routines:[],routineLogs:[],reviews:[],inbox:[],calendarEvents:[]}})"),/зависимости задач/);
assert.throws(()=>run("normalizeState({version:18,settings:{},entities:{projects:[],tasks:[],goals:[{id:'g',projectIds:'bad'}],routines:[],routineLogs:[],reviews:[],inbox:[],calendarEvents:[]}})"),/связи целей/);
assert.throws(()=>run("normalizeState({version:18,settings:{},entities:{projects:[],tasks:[],goals:[],routines:[{id:'r',days:[0,8]}],routineLogs:[],reviews:[],inbox:[],calendarEvents:[]}})"),/расписание рутины/);
assert.throws(()=>run("normalizeState({version:18,settings:{},entities:{projects:[{id:'dup'},{id:'dup'}],tasks:[],goals:[],routines:[],routineLogs:[],reviews:[],inbox:[],calendarEvents:[]}})"),/Дублирующийся ID/);
assert.throws(()=>run("normalizeState({version:17,settings:{projects:[{id:'dup'},{id:'dup'}]}})"),/Дублирующийся ID/);
console.log("OK — state v18 migration, idempotence and corruption gate");
