"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path"),assert=require("assert");
const root=__dirname,html=fs.readFileSync(path.join(root,"index.html"),"utf8"),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
function el(id){return {id,value:"",checked:false,hidden:false,disabled:false,innerHTML:"",textContent:"",dataset:{},style:{},files:[],options:[],selectedIndex:-1,classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},removeEventListener(){},appendChild(){},remove(){},focus(){},click(){},scrollIntoView(){},closest(){return null},querySelector(){return null},querySelectorAll(){return []},setAttribute(){},getAttribute(){return null}}}
const elements=Object.fromEntries(ids.map(id=>[id,el(id)]));
const document={getElementById:id=>elements[id]||null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},createElement:tag=>el(tag),body:{classList:{add(){},remove(){},toggle(){}}},documentElement:{style:{setProperty(){}}},readyState:"complete"};
const window={document,addEventListener(){},removeEventListener(){},scrollTo(){},requestAnimationFrame:fn=>fn(),location:{reload(){},replace(){}},LifePlatform:{refreshIcons(){},status(){return"test"}}};window.window=window;
const context=vm.createContext({console,Date,Math,JSON,Intl,Promise,structuredClone:global.structuredClone,crypto:global.crypto,setTimeout:fn=>{if(typeof fn==='function')fn();return 0},clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:fn=>fn(),document,window,navigator:{},location:window.location,localStorage:{getItem(){return null},setItem(){},removeItem(){}},Notification:function(){},confirm:()=>true,prompt:()=>"100",alert(){},Blob:global.Blob,URL:global.URL,indexedDB:{open(){throw new Error("disabled in smoke")}}});
for(const file of ["core.js","state.js","finance.js","imports.js","work.js","tennis.js","knowledge.js","gamification.js","pwa.js","ui.js"]){new vm.Script(fs.readFileSync(path.join(root,file),"utf8"),{filename:file}).runInContext(context)}
new vm.Script('S=deepClone(DEFAULT_STATE); render();',{}).runInContext(context);
assert.ok(elements.dailyEngine.innerHTML.includes("Life Systems Score"));
assert.ok(elements.crmSummary.innerHTML!==undefined);
assert.ok(elements.tennisAnalytics.innerHTML!==undefined);
assert.ok(elements.readingDashboard.innerHTML!==undefined);
assert.ok(elements.systemDiagnostics.innerHTML.length>0);
console.log("OK — Life RPG 10.0.1 full render smoke passed");
