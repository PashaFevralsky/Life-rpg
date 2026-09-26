"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert");
const base=fs.readFileSync("gpt-exchange-13.5.js","utf8");
const guide=fs.readFileSync("gpt-exchange-guidance-13.5.1.js","utf8");
const fb=fs.readFileSync("gpt-exchange-feedback-13.6.js","utf8");

assert.equal(/\bfetch\s*\(/.test(base+guide+fb),false,"GPT Exchange must remain offline");
assert.equal(/workers\.dev|env\.AI|OPENAI_API_KEY|BRIDGE_ACCESS_TOKEN/.test(fb),false,"13.6 must not add backend/API configuration");
assert.ok(fb.includes("changesSincePreviousGpt"));
assert.ok(fb.includes("previousActions"));
assert.ok(fb.includes("feedbackDecisions"));
assert.ok(fb.includes("gpt136RecordReceipt"));

const context={
  console,Date,Math,JSON,Set,Map,WeakSet,
  S:{
    settings:{},
    entities:{
      tasks:[
        {id:"t1",title:"Сверить кассовый план",area:"Финансы",priority:1,status:"active",dueDate:"2026-09-25",plannedDate:"2026-09-26",notBefore:"",minutes:30,note:"",createdAt:"",updatedAt:""},
        {id:"t2",title:"Актуализировать CRM и сформировать рабочий поток",area:"Работа",priority:2,status:"done",dueDate:"",plannedDate:"2026-09-25",notBefore:"",minutes:45,note:"",createdAt:"",updatedAt:"",completedAt:"2026-09-26T10:00:00Z"}
      ],
      calendarEvents:[
        {id:"c1",title:"Лёгкая аэробная",type:"Тренировка",area:"Теннис",dateKey:"2026-09-25",minutes:35,priority:2,note:"",status:"planned",createdAt:"",updatedAt:""}
      ]
    },
    accounts:[],debts:[],crmDeals:[],tennis:[],books:[]
  },
  clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  validDateKey:x=>/^\d{4}-\d{2}-\d{2}$/.test(x),
  localDateKey:()=> "2026-09-26",
  APP_VERSION:"13.2.2",STATE_VERSION:18
};
context.globalThis=context;vm.createContext(context);
vm.runInContext(base,context,{filename:"gpt-exchange-13.5.js"});
vm.runInContext(guide,context,{filename:"gpt-exchange-guidance-13.5.1.js"});
vm.runInContext(fb,context,{filename:"gpt-exchange-feedback-13.6.js"});

const schema=vm.runInContext("gpt135ResponseSchema()",context);
assert.ok(schema.guidance);
assert.ok(schema.feedbackDecisions);
assert.equal(schema.format,"life-rpg-gpt-response-v1");

vm.runInContext(`gpt135HistoryAdd({kind:"export",packageId:"pkg-known",question:"test",mode:"review"})`,context);
assert.ok(vm.runInContext(`gpt136FindExport("pkg-known")`,context));

const sim=vm.runInContext(`gpt136Similarity("Актуализировать CRM и сформировать следующий рабочий поток","Актуализировать CRM, сформировать рабочий поток")`,context);
assert.ok(sim>=.80,"similar titles should be detected");

const t1=vm.runInContext(`gpt136TaskState("t1","")`,context);
assert.equal(t1.status,"overdue");
const t2=vm.runInContext(`gpt136TaskState("t2","")`,context);
assert.equal(t2.status,"done");
const c1=vm.runInContext(`gpt136CalendarState("c1","")`,context);
assert.equal(c1.status,"overdue");

const prev={finance:{operatingCash:100,minBalance:-500},tasks:{active:2,done:0}};
const cur={finance:{operatingCash:150,minBalance:-200},tasks:{active:1,done:1}};
context.prev=prev;context.cur=cur;
const diff=vm.runInContext(`gpt136Changes(prev,cur,"pkg-prev")`,context);
assert.equal(diff.available,true);
assert.ok(diff.changedDomains.includes("finance"));
assert.equal(diff.sections.finance.operatingCash.delta,50);
assert.equal(diff.sections.tasks.done.delta,1);

const normalized=vm.runInContext(`gpt135NormalizeResponse({
  format:"life-rpg-gpt-response-v1",version:1,packageId:"pkg-known",summary:"x",
  tasks:[],calendar:[],recommendations:[],assumptions:[],
  feedbackDecisions:[
    {targetId:"task:t1",action:"revise",reason:"Изменились данные",revision:"Новая формулировка"},
    {targetId:"task:t2",action:"bad"}
  ]
})`,context);
assert.equal(normalized.feedbackDecisions.length,1);
assert.equal(normalized.feedbackDecisions[0].action,"revise");

vm.runInContext(`gpt136RecordReceipt({
  packageId:"pkg-known",fingerprint:"f1",fileName:"r.json",
  tasks:[{id:"t1",title:"Сверить кассовый план"}],
  calendar:[{id:"c1",title:"Лёгкая аэробная"}],
  guidance:null,feedbackDecisions:[],snapshotTs:null
})`,context);
const receipts=vm.runInContext(`gpt136ReceiptContext()`,context);
assert.equal(receipts.length,1);
assert.equal(receipts[0].tasks[0].status,"overdue");
assert.equal(receipts[0].calendar[0].status,"overdue");

const old=vm.runInContext(`gpt135NormalizeResponse({
  format:"life-rpg-gpt-response-v1",version:1,packageId:"pkg-known",summary:"legacy",
  tasks:[],calendar:[],recommendations:[],assumptions:[]
})`,context);
assert.deepEqual(Array.from(old.feedbackDecisions),[]);

console.log("GPT Exchange 13.6 Feedback Loop tests: OK");
