"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert"),root=__dirname,read=n=>fs.readFileSync(path.join(root,n),"utf8");
const share=read("share-hub.js"),bridge=read("share-target-sw.js"),manifest=JSON.parse(read("manifest.webmanifest")),vite=read("vite.config.mjs"),boot=read("bootstrap.js"),core=read("core.js"),pkg=JSON.parse(read("package.json"));
assert.ok(core.includes('APP_VERSION="13.1.1"'));assert.ok(core.includes("STATE_VERSION=18"),"13.1 must not migrate state");
assert.equal(manifest.share_target?.method,"POST");assert.equal(manifest.share_target?.enctype,"multipart/form-data");assert.equal(manifest.share_target?.action,"./share-target");assert.ok(Array.isArray(manifest.share_target?.params?.files));assert.ok(Array.isArray(manifest.file_handlers));
assert.ok(vite.includes('importScripts:["share-target-sw.js"]'));assert.ok(vite.includes('cacheId:"life-rpg-13.1.1"'));assert.ok(vite.includes('"share-hub.js"'));assert.ok(vite.includes('"share-target-sw.js"'));
assert.ok(boot.includes('"share-hub.js"'));assert.ok(boot.includes('["ensureShare131Ui","renderShare131"]'));
assert.ok(bridge.includes('addEventListener("fetch"'));assert.ok(bridge.includes('request.formData()'));assert.ok(bridge.includes('indexedDB.open(SHARE131_DB'));assert.ok(bridge.includes('Response.redirect'));assert.ok(!/fetch\(["'`]https?:/i.test(bridge),"Share bridge must not upload to network");
assert.ok(share.includes("Mobile Automation & Share Hub 13.1"));assert.ok(share.includes("share131Fingerprint"));assert.ok(share.includes("share131DedupQueue"));assert.ok(share.includes("exportBackup(false)"));assert.ok(share.includes("share131ExportIcs"));assert.ok(share.includes("launchQueue.setConsumer"));assert.ok(pkg.scripts.test.includes("mobile-share-13.1.test.js"));
const ctx={console,Date,Math,Number,String,Array,Object,Map,Set,JSON,Promise,TextEncoder,TextDecoder,URL,Blob,crypto:global.crypto,
 S:{settings:{}},document:{getElementById(){return null},querySelector(){return null}},navigator:{},location:{search:"",pathname:"/",hash:""},history:{replaceState(){}},globalThis:null,
 validDateKey:k=>/^\d{4}-\d{2}-\d{2}$/.test(String(k||"")),escapeHtml:String,uid:()=>"u",localDateKey:()=>"2026-09-25",indexedDB:{},File:global.File||class File{}};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(share,ctx);
const run=code=>vm.runInContext(code,ctx);
assert.equal(run(`share131Classify({title:"",text:"https://example.com",url:"",files:[]})`),"inbox");
assert.equal(run(`share131Classify({title:"",text:"",url:"",files:[{name:"backup.json",type:"application/json"}]})`),"import");
assert.equal(run(`share131Classify({title:"Huawei Health",text:"пульс",url:"",files:[{name:"Screenshot.jpg",type:"image/jpeg"}]})`),"huawei");
assert.equal(run(`share131Classify({title:"",text:"",url:"",files:[{name:"Screenshot.jpg",type:"image/jpeg"}]})`),"image");
assert.equal(run(`share131Classify({title:"",text:"",url:"",files:[{name:"calendar.ics",type:"text/calendar"}]})`),"calendar");
const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART;VALUE=DATE:20261003\r\nSUMMARY:Настольный теннис\r\nDESCRIPTION:Групповая тренировка\r\nDURATION:PT90M\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const rows=JSON.parse(run(`JSON.stringify(share131ParseIcs(${JSON.stringify(ics)}))`));assert.equal(rows.length,1);assert.equal(rows[0].dateKey,"2026-10-03");assert.equal(rows[0].title,"Настольный теннис");assert.equal(rows[0].minutes,90);assert.equal(rows[0].type,"Тренировка");
console.log("OK — Mobile Automation & Share Hub 13.1 contracts: Android Share Target, queue, routing, dedupe and ICS passed");
