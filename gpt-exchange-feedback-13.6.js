"use strict";

/* Life RPG 13.6 — GPT Exchange Feedback Loop.
   Adds package binding, import receipts, outcome tracking, delta context and
   advisory keep/revise/retire decisions. Still fully offline: no API/Worker/fetch. */

const GPT136_VERSION=1;
const GPT136_MAX_EXPORTS=40;
const GPT136_MAX_RECEIPTS=30;
const GPT136_DECISIONS=["keep","revise","retire"];

function gpt136Store(){
  const root=gpt135Store();
  let x=root.feedback136;
  if(!x||typeof x!=="object"||Array.isArray(x))x={};
  if(!Array.isArray(x.exports))x.exports=[];
  if(!Array.isArray(x.receipts))x.receipts=[];
  if(!x.migratedHistory){
    for(const h of (root.history||[])){
      if(h?.kind!=="export"||!h.packageId)continue;
      if(!x.exports.some(e=>e.packageId===h.packageId)){
        x.exports.push({
          packageId:String(h.packageId),at:String(h.at||""),question:String(h.question||""),
          mode:String(h.mode||""),snapshot:null,legacy:true,importedAt:""
        })
      }
    }
    x.exports.sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
    x.migratedHistory=true
  }
  x.exports=x.exports.slice(0,GPT136_MAX_EXPORTS);
  x.receipts=x.receipts.slice(0,GPT136_MAX_RECEIPTS);
  x.version=GPT136_VERSION;
  root.feedback136=x;
  return x
}
function gpt136Round(v){
  const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:null
}
function gpt136Array(v){return Array.isArray(v)?v:[]}
function gpt136LatestExport(){return gpt136Store().exports[0]||null}
function gpt136FindExport(packageId){
  const id=String(packageId||"");return gpt136Store().exports.find(x=>x.packageId===id)||null
}
function gpt136RecordExport({packageId,question,mode,snapshot}){
  const st=gpt136Store(),id=String(packageId||"");
  st.exports=st.exports.filter(x=>x.packageId!==id);
  st.exports.unshift({
    packageId:id,at:new Date().toISOString(),question:gpt135NormText(question,1200),
    mode:String(mode||"custom"),snapshot:gpt135Plain(snapshot),legacy:false,importedAt:"",importCount:0
  });
  st.exports=st.exports.slice(0,GPT136_MAX_EXPORTS);
  return st.exports[0]
}
function gpt136Snapshot(){
  const projection=gpt135Call("buildFinancialProjection",30)||{};
  const pace=gpt135Call("work121PaceForecast")||gpt135Call("workPaceData")||{};
  const deals=gpt136Array(S.crmDeals).filter(x=>!["Выиграно","Проиграно","won","lost","closed"].includes(String(x.stage||x.status||"")));
  const tennis=gpt135Call("tennisLoadProfile")||{};
  const training=gpt135Call("training129LoadProfile")||{};
  const reading=gpt135Call("readingConsistencyData",28)||{};
  const tasks=typeof taskAll==="function"?taskAll():gpt136Array(S.entities?.tasks);
  const calendar=typeof calendarManualEvents==="function"?calendarManualEvents():gpt136Array(S.entities?.calendarEvents);
  const activeTasks=tasks.filter(x=>x.status==="active");
  const today=typeof localDateKey==="function"?localDateKey():new Date().toISOString().slice(0,10);
  const taskOverdue=activeTasks.filter(x=>x.dueDate&&x.dueDate<today).length;
  const currentBooks=gpt136Array(S.books).filter(x=>x.status==="reading");
  return gpt135Plain({
    at:new Date().toISOString(),
    finance:{
      operatingCash:gpt136Round(gpt135Call("operatingCashBalance")),
      freeCash:gpt136Round(gpt135Call("freeCashBalance")),
      totalDebt:gpt136Round(gpt135Call("totalDebt")),
      minBalance:gpt136Round(projection.minBalance),
      minDate:String(projection.minDate||""),
      cashGapDate:String(projection.cashGapDate||""),
      endingBalance:gpt136Round(projection.endingBalance)
    },
    work:{
      plan:gpt136Round(pace.plan),
      sales:gpt136Round(pace.sales),
      status:String(pace.status||""),
      openDeals:deals.length,
      pipelinePotential:gpt136Round(deals.reduce((s,x)=>s+(+x.potential||0),0))
    },
    tennis:{
      sessions28:+tennis.sessions28||0,
      acute:gpt136Round(tennis.acute),
      baseline:gpt136Round(tennis.baseline),
      ratio:gpt136Round(tennis.ratio),
      interpretable:!!tennis.interpretable
    },
    training:{
      weeklyBase:gpt136Round(training.weeklyBase),
      ratio:gpt136Round(training.ratio),
      interpretable:!!training.interpretable,
      baseSessions:+training.baseSessions||0,
      acuteSessions:+training.acute?.rows?.length||0
    },
    knowledge:{
      activeDays:+reading.activeDays||0,
      weeklyDays:gpt136Round(reading.weeklyDays),
      streak:+reading.streak||0,
      currentBooks:currentBooks.map(x=>({title:x.title||"",currentPage:+x.currentPage||0,totalPages:+x.totalPages||0})).slice(0,3)
    },
    tasks:{
      active:activeTasks.length,
      done:tasks.filter(x=>x.status==="done").length,
      cancelled:tasks.filter(x=>x.status==="cancelled").length,
      overdue:taskOverdue
    },
    calendar:{
      planned:calendar.filter(x=>x.status==="planned").length,
      done:calendar.filter(x=>x.status==="done").length,
      cancelled:calendar.filter(x=>x.status==="cancelled").length
    }
  })
}
function gpt136DiffValue(before,after){
  if(typeof before==="number"&&typeof after==="number"){
    if(Math.abs(before-after)<0.005)return null;
    return {before,after,delta:gpt136Round(after-before)}
  }
  const a=JSON.stringify(before),b=JSON.stringify(after);
  return a===b?null:{before,after}
}
function gpt136Changes(previous,current,previousPackageId=""){
  if(!previous)return {available:false,sincePackageId:previousPackageId||"",sections:{},changedDomains:[]};
  const sections={},changedDomains=[];
  for(const domain of ["finance","work","tennis","training","knowledge","tasks","calendar"]){
    const b=previous?.[domain]||{},a=current?.[domain]||{},rows={};
    for(const key of new Set([...Object.keys(b),...Object.keys(a)])){
      const d=gpt136DiffValue(b[key],a[key]);if(d)rows[key]=d
    }
    if(Object.keys(rows).length){sections[domain]=rows;changedDomains.push(domain)}
  }
  return {available:true,sincePackageId:previousPackageId||"",sections,changedDomains,hasChanges:changedDomains.length>0}
}
function gpt136TaskState(id,fallbackTitle=""){
  const t=(typeof taskAll==="function"?taskAll():gpt136Array(S.entities?.tasks)).find(x=>String(x.id)===String(id));
  if(!t)return {targetId:`task:${id}`,id:String(id),title:fallbackTitle,status:"missing"};
  const today=typeof localDateKey==="function"?localDateKey():new Date().toISOString().slice(0,10);
  let status=t.status||"active";
  if(status==="active"&&t.dueDate&&t.dueDate<today)status="overdue";
  return {
    targetId:`task:${t.id}`,id:t.id,title:t.title||fallbackTitle,status,
    dueDate:t.dueDate||"",plannedDate:t.plannedDate||"",completedAt:t.completedAt||"",
    updatedAt:t.updatedAt||"",planMissed:status==="active"&&!!t.plannedDate&&t.plannedDate<today
  }
}
function gpt136CalendarState(id,fallbackTitle=""){
  const rows=typeof calendarManualEvents==="function"?calendarManualEvents():gpt136Array(S.entities?.calendarEvents);
  const e=rows.find(x=>String(x.id)===String(id));
  if(!e)return {targetId:`calendar:${id}`,id:String(id),title:fallbackTitle,status:"missing"};
  const today=typeof localDateKey==="function"?localDateKey():new Date().toISOString().slice(0,10);
  let status=e.status||"planned";
  if(status==="planned"&&e.dateKey&&e.dateKey<today)status="overdue";
  return {targetId:`calendar:${e.id}`,id:e.id,title:e.title||fallbackTitle,status,dateKey:e.dateKey||"",updatedAt:e.updatedAt||""}
}
function gpt136Words(v){
  const stop=new Set(["и","в","во","на","до","по","для","с","со","из","к","ко","за","от","при","а","но","или","это","the","a","an","to","of","for"]);
  return String(v||"").toLocaleLowerCase("ru-RU").normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu," ").trim().split(/\s+/).filter(x=>x&&!stop.has(x))
}
function gpt136CharDice(a,b){
  const x=String(a||"").toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu,"");
  const y=String(b||"").toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu,"");
  if(!x||!y)return 0;if(x===y)return 1;
  if(x.length<3||y.length<3)return 0;
  const grams=s=>{const m=new Map();for(let i=0;i<s.length-2;i++){const g=s.slice(i,i+3);m.set(g,(m.get(g)||0)+1)}return m};
  const A=grams(x),B=grams(y);let hit=0,ta=0,tb=0;
  for(const n of A.values())ta+=n;for(const n of B.values())tb+=n;
  for(const [g,n] of A)hit+=Math.min(n,B.get(g)||0);
  return ta+tb?2*hit/(ta+tb):0
}
function gpt136Similarity(a,b){
  const sa=String(a||"").trim().toLocaleLowerCase("ru-RU"),sb=String(b||"").trim().toLocaleLowerCase("ru-RU");
  if(!sa||!sb)return 0;if(sa===sb)return 1;
  if(Math.min(sa.length,sb.length)>=12&&(sa.includes(sb)||sb.includes(sa)))return .93;
  const A=new Set(gpt136Words(sa)),B=new Set(gpt136Words(sb));
  let inter=0;for(const x of A)if(B.has(x))inter++;
  const union=new Set([...A,...B]).size,j=union?inter/union:0;
  return Math.max(j,gpt136CharDice(sa,sb))
}
function gpt136BestMatch(title){
  const tasks=(typeof taskAll==="function"?taskAll():gpt136Array(S.entities?.tasks)).map(x=>({kind:"task",row:x,sim:gpt136Similarity(title,x.title)}));
  const calendar=(typeof calendarManualEvents==="function"?calendarManualEvents():gpt136Array(S.entities?.calendarEvents)).map(x=>({kind:"calendar",row:x,sim:gpt136Similarity(title,x.title)}));
  return [...tasks,...calendar].sort((a,b)=>b.sim-a.sim)[0]||null
}
function gpt136GuidanceFeedback(){
  const root=gpt135Store(),g=root.activeGuidance;if(!g)return null;
  const expired=typeof gpt1351GuidanceExpired==="function"?gpt1351GuidanceExpired(g):false;
  const top=(g.todayTop3||[]).map((x,i)=>{
    const m=gpt136BestMatch(x.title),matched=!!m&&m.sim>=.72;
    let status=expired?"expired":"unknown",targetId="";
    if(matched){
      const s=m.kind==="task"?gpt136TaskState(m.row.id,m.row.title):gpt136CalendarState(m.row.id,m.row.title);
      status=s.status;targetId=s.targetId
    }
    return {
      targetId:`guidance:${g.packageId||"active"}:today:${i}`,
      title:x.title,area:x.area||"",status,matchedTargetId:targetId,matchScore:matched?gpt136Round(m.sim):null
    }
  });
  return {
    packageId:g.packageId||"",appliedAt:g.appliedAt||"",validThrough:g.validThrough||"",
    status:expired?"expired":"active",todayTop3:top
  }
}
function gpt136ReceiptContext(){
  return gpt136Store().receipts.slice(0,6).map(r=>({
    receiptId:r.id,packageId:r.packageId,appliedAt:r.appliedAt,
    tasks:(r.tasks||[]).map(x=>gpt136TaskState(x.id,x.title)),
    calendar:(r.calendar||[]).map(x=>gpt136CalendarState(x.id,x.title)),
    guidance:r.guidance?{packageId:r.packageId,headline:r.guidance.headline||"",validThrough:r.guidance.validThrough||""}:null,
    feedbackDecisions:r.feedbackDecisions||[]
  }))
}
function gpt136NormalizeDecision(x){
  if(!x||typeof x!=="object")return null;
  const action=String(x.action||"").trim().toLowerCase();
  const targetId=gpt135NormText(x.targetId,220);
  if(!targetId||!GPT136_DECISIONS.includes(action))return null;
  return {
    targetId,action,
    reason:gpt135NormText(x.reason,1200),
    revision:gpt135NormText(x.revision,800)
  }
}
function gpt136RecordReceipt({packageId,fingerprint,fileName,tasks,calendar,guidance,feedbackDecisions,snapshotTs}){
  const st=gpt136Store(),now=new Date().toISOString(),id=gpt135Id("receipt");
  const row={
    id,packageId:String(packageId||""),fingerprint:String(fingerprint||""),fileName:String(fileName||""),
    appliedAt:now,snapshotTs:snapshotTs||null,
    tasks:(tasks||[]).map(x=>({id:x.id,title:x.title||""})),
    calendar:(calendar||[]).map(x=>({id:x.id,title:x.title||""})),
    guidance:guidance?gpt135Plain(guidance):null,
    feedbackDecisions:(feedbackDecisions||[]).map(gpt135Plain)
  };
  st.receipts.unshift(row);st.receipts=st.receipts.slice(0,GPT136_MAX_RECEIPTS);
  const exp=gpt136FindExport(packageId);if(exp){exp.importedAt=now;exp.importCount=(+exp.importCount||0)+1;exp.lastReceiptId=id}
  return row
}

/* Add delta + previous outcomes to every future context package. */
const gpt136BaseBuildContext=gpt135BuildContext;
gpt135BuildContext=function(){
  const ctx=gpt136BaseBuildContext(),current=gpt136Snapshot(),prev=gpt136LatestExport();
  ctx.feedback136=gpt135Plain({
    version:GPT136_VERSION,
    currentSnapshot:current,
    changesSincePreviousGpt:gpt136Changes(prev?.snapshot,current,prev?.packageId||""),
    previousActions:gpt136ReceiptContext(),
    guidanceFeedback:gpt136GuidanceFeedback(),
    latestExport:prev?{packageId:prev.packageId,at:prev.at,importedAt:prev.importedAt||"",importCount:+prev.importCount||0}:null
  });
  if(!ctx.sources.includes("GPT Feedback Loop 13.6"))ctx.sources.push("GPT Feedback Loop 13.6");
  return ctx
};

/* Extend response protocol with advisory dispositions. */
const gpt136BaseResponseSchema=gpt135ResponseSchema;
gpt135ResponseSchema=function(){
  const s=gpt136BaseResponseSchema();
  s.feedbackDecisions=[{
    targetId:"Возьми точный targetId из context.feedback136.previousActions или guidanceFeedback",
    action:"keep | revise | retire",
    reason:"Почему прежний элемент оставить, пересмотреть или считать исчерпанным",
    revision:"Новая формулировка, если action=revise; иначе пусто"
  }];
  return s
};
const gpt136BaseInstructions=gpt135Instructions;
gpt135Instructions=function(packageId){
  return [
    ...gpt136BaseInstructions(packageId),
    "Используй context.feedback136.changesSincePreviousGpt, чтобы не повторять прежний план без новых фактов.",
    "Проверь context.feedback136.previousActions: уже выполненные/активные/просроченные/отменённые элементы не дублируй новой задачей без явной причины.",
    "Если нужно оценить прежний GPT-элемент, используй feedbackDecisions с точным targetId и action keep/revise/retire.",
    "feedbackDecisions — только советующий feedback: он НЕ удаляет, НЕ закрывает и НЕ редактирует существующие Tasks/Calendar/Finance/CRM.",
    "Если изменения с прошлого обмена не требуют новых действий, верни tasks/calendar пустыми и обнови только guidance/recommendations/feedbackDecisions.",
    "При расхождении полного контекста и delta доверяй текущим фактическим данным полного контекста; delta используй как указатель на изменения."
  ]
};

const gpt136BaseNormalizeResponse=gpt135NormalizeResponse;
gpt135NormalizeResponse=function(obj){
  const x=gpt136BaseNormalizeResponse(obj);
  x.feedbackDecisions=(Array.isArray(obj?.feedbackDecisions)?obj.feedbackDecisions:[]).slice(0,30).map(gpt136NormalizeDecision).filter(Boolean);
  return x
};

/* Stronger near-duplicate protection for active tasks and same-day calendar rows. */
const gpt136BaseMarkDuplicates=gpt135MarkDuplicates;
gpt135MarkDuplicates=function(payload){
  const x=gpt136BaseMarkDuplicates(payload),tasks=typeof taskAll==="function"?taskAll():gpt136Array(S.entities?.tasks),
        active=tasks.filter(t=>t.status==="active"),
        cal=typeof calendarManualEvents==="function"?calendarManualEvents():gpt136Array(S.entities?.calendarEvents);
  for(const t of x.tasks){
    if(t.duplicate)continue;
    const m=active.map(e=>({e,sim:gpt136Similarity(t.title,e.title)})).sort((a,b)=>b.sim-a.sim)[0];
    if(m&&m.sim>=.80){
      t.duplicate=true;t.include=false;t.duplicateReason=`Похоже на активную задачу: ${m.e.title} (${Math.round(m.sim*100)}%)`
    }
  }
  for(const e of x.calendar){
    if(e.duplicate)continue;
    const rows=cal.filter(c=>c.status!=="cancelled"&&c.dateKey===e.dateKey);
    const m=rows.map(c=>({c,sim:gpt136Similarity(e.title,c.title)})).sort((a,b)=>b.sim-a.sim)[0];
    if(m&&m.sim>=.80){
      e.duplicate=true;e.include=false;e.duplicateReason=`Похоже на событие: ${m.c.title} (${Math.round(m.sim*100)}%)`
    }
  }
  return x
};

/* Recompute fingerprint including guidance + advisory feedback. Bind response to a real exported package. */
const gpt136BasePreparePayload=gpt135PreparePayload;
gpt135PreparePayload=function(obj,fileName="gpt-response.json"){
  const p=gpt136BasePreparePayload(obj,fileName);
  if(!p?.payload)return p;
  const binding=gpt136FindExport(p.payload.packageId),latest=gpt136LatestExport();
  p.boundExport=binding?{packageId:binding.packageId,at:binding.at,question:binding.question,mode:binding.mode}:null;
  p.packageIsOlder=!!binding&&!!latest&&binding.packageId!==latest.packageId;
  p.fingerprint=gpt135FNV({
    packageId:p.payload.packageId,summary:p.payload.summary,
    tasks:p.payload.tasks.map(({include,duplicate,duplicateReason,...x})=>x),
    calendar:p.payload.calendar.map(({include,duplicate,duplicateReason,...x})=>x),
    guidance:p.payload.guidance,feedbackDecisions:p.payload.feedbackDecisions
  });
  p.alreadyApplied=gpt135Store().appliedFingerprints.includes(p.fingerprint);
  if(!p.payload.packageId||!binding){
    p.error=`Ответ относится к неизвестному packageId: ${p.payload.packageId||"(пусто)"}. Импорт заблокирован: сначала должен существовать экспорт Life RPG с этим packageId.`
  }
  renderGpt135();return p
};

/* Export is overridden only to persist the exact package snapshot before handing the file out. */
gpt135Export=async function(mode="custom"){
  const box=document.getElementById("gpt135Question"),question=gpt135NormText(box?.value,6000);
  if(!question){toast("Сначала укажи, что нужно спросить у GPT");return}
  gpt135ReadSettingsFromUi();
  const packageId=gpt135Id("pkg"),snapshot=gpt136Snapshot(),data={
    format:GPT135_CONTEXT_FORMAT,version:1,packageId,generatedAt:new Date().toISOString(),
    appVersion:typeof APP_VERSION!=="undefined"?APP_VERSION:"",
    stateVersion:typeof STATE_VERSION!=="undefined"?STATE_VERSION:null,
    request:{mode:String(mode||"custom"),question},
    instructions:gpt135Instructions(packageId),responseSchema:gpt135ResponseSchema(),
    context:gpt135BuildContext()
  };
  gpt135HistoryAdd({kind:"export",packageId,question,mode,detail:`${data.context.sources.length} источников • Feedback Loop 13.6`});
  gpt136RecordExport({packageId,question,mode,snapshot});
  if(typeof persist==="function")await persist();
  gpt135DownloadJson(data,`life-rpg-gpt-context-${typeof localDateKey==="function"?localDateKey():new Date().toISOString().slice(0,10)}.json`);
  renderGpt135();toast("GPT-пакет 13.6 скачан")
};

/* Apply remains explicit and non-destructive, but now stores an import receipt with created IDs. */
gpt135Apply=async function(){
  const p=GPT135_PREVIEW;if(!p?.payload||p.error)return;
  if(!p.boundExport){toast("Ответ не привязан к известному GPT-пакету");return}
  if(p.alreadyApplied){toast("Этот GPT-ответ уже применялся");return}
  const tasks=p.payload.tasks.filter(x=>x.include&&!x.duplicate),
        calendar=p.payload.calendar.filter(x=>x.include&&!x.duplicate),
        guidance=p.guidanceInclude?p.payload.guidance:null,
        decisions=p.payload.feedbackDecisions||[];
  if(!tasks.length&&!calendar.length&&!guidance&&!decisions.length){toast("Нет выбранных новых действий, GPT-слоя или feedback");return}
  if(tasks.length&&typeof taskCreate!=="function")throw new Error("Tasks OS недоступен");
  if(calendar.length&&typeof addCalendarPlan!=="function")throw new Error("Calendar OS недоступен");
  if(typeof confirm==="function"&&!confirm(
    `Применить ответ GPT 13.6?\nПакет: ${p.payload.packageId}\nЗадач: ${tasks.length}\nСобытий: ${calendar.length}\nGPT-слой: ${guidance?"да":"нет"}\nFeedback решений: ${decisions.length}`
  ))return;
  const snap=typeof createPreActionSnapshot==="function"?await createPreActionSnapshot(`GPT Exchange 13.6 • ${p.fileName}`):null,
        createdTasks=[],createdEvents=[];
  for(const x of tasks){
    const t=taskCreate({
      title:x.title,area:x.area,priority:x.priority,dueDate:x.dueDate,plannedDate:x.plannedDate,notBefore:x.notBefore,
      minutes:x.minutes,note:[x.note,"Источник: GPT Exchange"].filter(Boolean).join(" • ")
    });
    if(t?.id)createdTasks.push({id:t.id,title:t.title})
  }
  for(const x of calendar){
    const rows=addCalendarPlan({
      title:x.title,type:x.type,dateKey:x.dateKey,minutes:x.minutes,priority:x.priority,
      note:[x.note,"Источник: GPT Exchange"].filter(Boolean).join(" • "),repeatWeeks:1
    });
    for(const e of rows||[])if(e?.id)createdEvents.push({id:e.id,title:e.title})
  }
  const root=gpt135Store(),now=new Date().toISOString();
  if(guidance)root.activeGuidance={...guidance,appliedAt:now,packageId:p.payload.packageId,sourceGeneratedAt:p.payload.generatedAt||""};
  root.lastAnalysis={
    at:now,packageId:p.payload.packageId,summary:p.payload.summary,
    recommendations:p.payload.recommendations,assumptions:p.payload.assumptions,
    guidance:p.payload.guidance||null,feedbackDecisions:decisions
  };
  root.appliedFingerprints.push(p.fingerprint);root.appliedFingerprints=root.appliedFingerprints.slice(-200);
  const receipt=gpt136RecordReceipt({
    packageId:p.payload.packageId,fingerprint:p.fingerprint,fileName:p.fileName,
    tasks:createdTasks,calendar:createdEvents,guidance,feedbackDecisions:decisions,snapshotTs:snap
  });
  gpt135HistoryAdd({
    kind:"import",packageId:p.payload.packageId,fileName:p.fileName,
    tasks:createdTasks.length,calendar:createdEvents.length,guidance:!!guidance,
    feedback:decisions.length,receiptId:receipt.id,snapshotTs:snap,summary:p.payload.summary
  });
  if(typeof audit==="function")audit("GPT Exchange 13.6 applied","system",`${createdTasks.length} задач • ${createdEvents.length} событий • feedback ${decisions.length}`);
  GPT135_PREVIEW=null;
  if(typeof persist==="function")await persist();
  if(typeof render==="function")render();else renderGpt135();
  toast(`GPT 13.6: задач ${createdTasks.length}, событий ${createdEvents.length}, feedback ${decisions.length}`)
};

function gpt136DecisionHtml(rows){
  if(!rows?.length)return "";
  const label={keep:"Оставить",revise:"Пересмотреть",retire:"Считать исчерпанным"};
  return rows.map(x=>`<div class="log-item"><b>${escapeHtml(label[x.action]||x.action)} • ${escapeHtml(x.targetId)}</b>${x.reason?`<div class="qmeta">${escapeHtml(x.reason)}</div>`:""}${x.revision?`<div class="qmeta">Новая формулировка: ${escapeHtml(x.revision)}</div>`:""}</div>`).join("")
}
const gpt136BasePreviewHtml=gpt135PreviewHtml;
gpt135PreviewHtml=function(){
  const p=GPT135_PREVIEW,html=gpt136BasePreviewHtml();
  if(!p||p.error||!p.payload)return html;
  const bind=p.boundExport
    ? `<div class="notice" style="margin-top:10px"><b>packageId подтверждён</b><div class="qmeta">${escapeHtml(bind.packageId)} • экспорт ${bind.at?new Date(bind.at).toLocaleString("ru-RU"):""}${p.packageIsOlder?" • это не самый свежий экспорт":""}</div>${bind.question?`<div class="qmeta">${escapeHtml(bind.question)}</div>`:""}</div>`
    : "";
  const decisions=gpt136DecisionHtml(p.payload.feedbackDecisions||[]);
  const dup=[...p.payload.tasks,...p.payload.calendar].filter(x=>x.duplicateReason).map(x=>`<div class="qmeta">• ${escapeHtml(x.duplicateReason)}</div>`).join("");
  const block=bind+(dup?`<details style="margin-top:10px"><summary>Защита от похожих дублей</summary>${dup}</details>`:"")+
    (decisions?`<details style="margin-top:10px"><summary>Feedback keep / revise / retire</summary><div style="margin-top:8px">${decisions}</div></details>`:"");
  return html.replace('<button id="gpt135ApplyBtn"',block+'<button id="gpt135ApplyBtn"')
};

function gpt136StatusHtml(){
  const st=gpt136Store(),receipts=gpt136ReceiptContext(),latest=st.exports[0]||null,g=gpt136GuidanceFeedback();
  const flat=receipts.flatMap(r=>[...(r.tasks||[]),...(r.calendar||[])]),counts={active:0,done:0,overdue:0,cancelled:0,missing:0,planned:0};
  for(const x of flat)counts[x.status]=(counts[x.status]||0)+1;
  return `<div class="report-grid">
    <div class="report-item"><div class="smallcaps">Экспортов связано</div><b>${st.exports.length}</b></div>
    <div class="report-item"><div class="smallcaps">Import receipts</div><b>${st.receipts.length}</b></div>
    <div class="report-item"><div class="smallcaps">GPT выполнено</div><b>${counts.done||0}</b></div>
    <div class="report-item"><div class="smallcaps">GPT активно / план</div><b>${(counts.active||0)+(counts.planned||0)}</b></div>
    <div class="report-item"><div class="smallcaps">GPT просрочено</div><b class="${counts.overdue?"income-bad":""}">${counts.overdue||0}</b></div>
    <div class="report-item"><div class="smallcaps">Guidance</div><b>${g?g.status:"нет"}</b></div>
  </div>
  ${latest?`<div class="qmeta" style="margin-top:8px">Последний пакет: ${escapeHtml(latest.packageId)} • ${latest.importedAt?"импортирован":"ожидает ответа"}</div>`:""}
  <div class="qmeta" style="margin-top:6px">13.6 отслеживает только новые imports через receipt. Старые GPT-задачи без receipt остаются видны в обычном контексте, но не получают выдуманную связь с packageId.</div>`
}
function gpt136EnsureUi(){
  const card=document.getElementById("gpt135Card");if(!card)return;
  const eyebrow=card.querySelector(".eyebrow");if(eyebrow)eyebrow.textContent="GPT Exchange 13.6";
  const muted=card.querySelector(".muted");if(muted)muted.textContent="Feedback Loop: пакет привязан к packageId, созданные GPT-задачи/события отслеживаются по ID, а следующий экспорт содержит их статусы и изменения данных с прошлого обмена.";
  if(!document.getElementById("gpt136FeedbackStatus")){
    const last=document.getElementById("gpt135Last");
    if(last)last.insertAdjacentHTML("afterend",'<div class="title" style="margin-top:14px">Feedback Loop 13.6</div><div id="gpt136FeedbackStatus" style="margin-top:8px"></div>')
  }
}
function gpt136RenderUi(){
  gpt136EnsureUi();
  const box=document.getElementById("gpt136FeedbackStatus");if(box)box.innerHTML=gpt136StatusHtml()
}
const gpt136BaseEnsureUi=ensureGpt135Ui;
ensureGpt135Ui=function(){gpt136BaseEnsureUi();gpt136EnsureUi()};
const gpt136BaseRender=renderGpt135;
renderGpt135=function(){gpt136BaseRender();gpt136RenderUi()};
