"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert"),src=fs.readFileSync("import-hub.js","utf8");
const ctx={console,Date,Math,Number,String,Array,Object,Map,Set,Promise,JSON,RegExp,TextEncoder,TextDecoder,structuredClone:global.structuredClone,
 document:{getElementById:()=>null,querySelector:()=>null},window:{LifePlatform:{}},S:{settings:{},bankImportIds:[],workLogs:[],tennis:[],books:[],readingLogs:[],importBatches:[]},
 localDateKey:()=>"2026-09-25",parseLocal:s=>new Date(s+"T12:00:00"),clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),escapeHtml:String,uid:()=>Math.random().toString(36).slice(2),
 parseCsvDate:v=>{v=String(v||"").trim();let m;if((m=v.match(/^(\d{4})-(\d{2})-(\d{2})/)))return `${m[1]}-${m[2]}-${m[3]}`;if((m=v.match(/^(\d{2})\.(\d{2})\.(\d{4})/)))return `${m[3]}-${m[2]}-${m[1]}`;return""},
 parseMoney:v=>Number(String(v||"").replace(/\s/g,"").replace(",","."))||0,detectDelimiter:l=>l.includes(";")?";":",",splitCsvLine:(l,d)=>l.split(d),classifyImportedExpense:()=>"Другое",
 importFingerprint:(d,a,t,s,n)=>`${d}|${a}|${t}|${s}|${n}`,bookIdentityKey:(a,t)=>`${a}|${t}`.toLowerCase(),normalizeReadingListPackage:o=>({books:o.books,title:o.title||""}),
 personalImportPreviewRows:rows=>({kind:"rows",valid:rows,invalid:[],duplicates:[],total:rows.length}),personalPortableCounts:()=>({}),base64ToBytes:()=>new Uint8Array(),crypto:global.crypto,
 prompt:()=>"",toast:()=>{},render:()=>{}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const run=x=>vm.runInContext(x,ctx);
let b=run('(()=>{const t=import127CsvTable("date;amount;description\\n25.09.2026;-100;Cafe"); if(import127CsvKind(t.headers)!=="bank-csv")throw new Error("bank classify"); return import127BankPreview(t)})()');assert.equal(b.valid,1);assert.equal(b.rows[0].type,"expense");
let w=run('(()=>{const t=import127CsvTable("date;sales;contacts;lpr;note\\n25.09.2026;500000;5;1;ok"); if(import127CsvKind(t.headers)!=="work-csv")throw new Error("work classify"); return import127WorkPreview(t)})()');assert.equal(w.valid,1);assert.equal(w.rows[0].sales,500000);
let q=run('(()=>{const t=import127CsvTable("date;minutes;focus;load;serve;foot\\n25.09.2026;90;BH;7;15;20"); if(import127CsvKind(t.headers)!=="tennis-csv")throw new Error("tennis classify"); return import127TennisPreview(t)})()');assert.equal(q.valid,1);assert.equal(q.rows[0].min,90);
assert.equal(run('import127JsonKind({format:"life-rpg-reading-list-v1",books:[{title:"X"}]})'),"reading-list");
assert.equal(run('import127JsonKind({version:18,profile:{},settings:{},accounts:[]})'),"backup");
assert.equal(run('import127Ext("report.XLSX")'),"xlsx");
assert.ok(src.includes("Universal Import Hub 12.7"));assert.ok(src.includes("createPreActionSnapshot"));assert.ok(src.includes("rollbackImportBatch"));assert.ok(src.includes("No state migration"));
console.log("OK — Universal Import Hub 12.7 classification, preview and rollback contracts passed");
