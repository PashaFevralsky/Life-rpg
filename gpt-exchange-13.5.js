"use strict";

/* Life RPG 13.5 — GPT Exchange.
   Offline file exchange only: Life RPG exports a context package, ChatGPT returns
   a strict JSON response, and the user explicitly confirms task/calendar changes.
   No API keys, Cloudflare Workers, background AI calls, or autonomous writes. */

const GPT135_CONTEXT_FORMAT="life-rpg-gpt-context-v1";
const GPT135_RESPONSE_FORMAT="life-rpg-gpt-response-v1";
const GPT135_VERSION=1;
const GPT135_MAX_HISTORY=40;
const GPT135_AREAS=["Работа","Финансы","Теннис","Знания","Личное","Система"];
let GPT135_PREVIEW=null;
let GPT135_LEGACY_CLEANED=false;

function gpt135Id(prefix="gpt"){
  try{return `${prefix}-${crypto.randomUUID()}`}catch{return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`}
}
function gpt135Store(){
  S.settings=S.settings||{};
  let x=S.settings.gptExchange135;
  if(!x||typeof x!=="object"||Array.isArray(x))x={};
  if(!["summary","detailed"].includes(x.privacy))x.privacy="summary";
  if(!x.scopes||typeof x.scopes!=="object"||Array.isArray(x.scopes))x.scopes={finance:true,work:true,tennis:true,training:true,knowledge:true,planning:true,intelligence:true};
  for(const k of ["finance","work","tennis","training","knowledge","planning","intelligence"])if(typeof x.scopes[k]!=="boolean")x.scopes[k]=true;
  if(!Array.isArray(x.history))x.history=[];
  if(!Array.isArray(x.appliedFingerprints))x.appliedFingerprints=[];
  if(!x.lastAnalysis||typeof x.lastAnalysis!=="object")x.lastAnalysis=null;
  x.history=x.history.slice(0,GPT135_MAX_HISTORY);
  x.appliedFingerprints=x.appliedFingerprints.slice(-200);
  x.version=GPT135_VERSION;
  S.settings.gptExchange135=x;
  return x
}
function gpt135CleanupLegacy(){
  if(GPT135_LEGACY_CLEANED)return false;
  GPT135_LEGACY_CLEANED=true;
  let changed=false;
  try{
    if(S?.settings?.aiBridge134){delete S.settings.aiBridge134;changed=true}
  }catch{}
  try{
    if(typeof localStorage!=="undefined"&&localStorage.getItem("lifeRpgAiBridge134AccessToken")!=null){
      localStorage.removeItem("lifeRpgAiBridge134AccessToken");changed=true
    }
  }catch{}
  return changed
}
function gpt135SecretKey(k){
  return /(?:^|[_-])(token|secret|password|passwd|api.?key|authorization|cookie)(?:$|[_-])/i.test(String(k||""))||
    /^(token|secret|password|apiKey|authorization|cookie)$/i.test(String(k||""))
}
function gpt135Plain(value,depth=0,seen){
  if(value==null)return value;
  const t=typeof value;
  if(t==="string")return value.length>1800?value.slice(0,1800)+"…":value;
  if(t==="number")return Number.isFinite(value)?value:null;
  if(t==="boolean")return value;
  if(t!=="object")return undefined;
  seen=seen||new WeakSet();
  if(seen.has(value))return "[circular]";
  seen.add(value);
  if(depth>=6)return Array.isArray(value)?`[array:${value.length}]`:"[object]";
  if(Array.isArray(value))return value.slice(0,40).map(x=>gpt135Plain(x,depth+1,seen)).filter(x=>x!==undefined);
  const out={};
  for(const k of Object.keys(value).slice(0,70)){
    if(gpt135SecretKey(k))continue;
    const v=gpt135Plain(value[k],depth+1,seen);
    if(v!==undefined)out[k]=v
  }
  return out
}
function gpt135Call(name,...args){try{const fn=globalThis[name];return typeof fn==="function"?fn(...args):null}catch{return null}}
function gpt135NormText(v,max=1200){return String(v??"").trim().slice(0,max)}
function gpt135FNV(value){
  const s=typeof value==="string"?value:JSON.stringify(value);
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return "fnv1a:"+(h>>>0).toString(16)
}
function gpt135Area(v){
  const x=String(v||"").trim().toLowerCase();
  const map={work:"Работа","работа":"Работа",finance:"Финансы","финансы":"Финансы",tennis:"Теннис","теннис":"Теннис",knowledge:"Знания","знания":"Знания",personal:"Личное","личное":"Личное",system:"Система","система":"Система"};
  return map[x]||GPT135_AREAS.find(a=>a.toLowerCase()===x)||"Личное"
}
function gpt135ValidDate(v,label,required=false){
  const x=String(v||"").trim();
  if(!x){if(required)throw new Error(`${label}: дата обязательна`);return""}
  if(typeof validDateKey==="function"&&!validDateKey(x))throw new Error(`${label}: неверная дата ${x}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(x))throw new Error(`${label}: дата должна быть YYYY-MM-DD`);
  return x
}
function gpt135TaskRows(detailed){
  const rows=typeof taskActive==="function"?taskActive():((S.entities?.tasks||[]).filter(x=>x.status==="active"));
  const limit=detailed?80:40;
  return rows.slice().sort((a,b)=>{
    const ad=String(a.plannedDate||a.dueDate||"9999-12-31"),bd=String(b.plannedDate||b.dueDate||"9999-12-31");
    return ad.localeCompare(bd)||(+a.priority||2)-(+b.priority||2)
  }).slice(0,limit).map(x=>gpt135Plain({
    id:x.id,title:x.title,area:x.area,priority:x.priority,dueDate:x.dueDate||"",plannedDate:x.plannedDate||"",
    notBefore:x.notBefore||"",minutes:+x.minutes||0,projectId:x.projectId||"",blockedByIds:x.blockedByIds||[],note:x.note||""
  }))
}
function gpt135CalendarRows(detailed){
  const rows=gpt135Call("calendarEvents",detailed?45:30,0)||[];
  return rows.slice(0,detailed?120:70).map(x=>gpt135Plain({
    id:x.id,dateKey:x.dateKey,title:x.title,area:x.area,type:x.type||x.kind||"",source:x.source||"",
    minutes:+x.minutes||0,priority:+x.priority||2,hard:!!x.hard,status:x.status||"",meta:x.meta||"",note:x.note||""
  }))
}
function gpt135FinanceContext(detailed){
  const accounts=(S.accounts||[]).filter(x=>x.active!==false).slice(0,20).map(x=>gpt135Plain({
    id:x.id,name:x.name,type:x.type||"",balance:gpt135Call("accountBalanceById",x.id),verifiedAt:x.verifiedAt||""
  }));
  const debts=(S.debts||[]).filter(x=>x.active!==false).slice(0,30).map(x=>gpt135Plain({
    id:x.id,name:x.name||x.debt||"",balance:+x.balance||0,rate:+x.rate||+x.apr||0,
    minPayment:+x.minPayment||+x.nextPayment||0,nextPaymentDate:x.nextPaymentDate||x.dueDate||""
  }));
  return gpt135Plain({
    decision:gpt135Call("decisionEngineData"),
    projection:gpt135Call("buildFinancialProjection",30),
    accounts,
    debts:detailed?debts:debts.slice(0,12),
    integrity:(gpt135Call("dataIntegrityIssues")||[]).filter(x=>/сч|долг|плат|финанс|остат/i.test(String(x.title||""))).slice(0,10)
  })
}
function gpt135WorkContext(detailed){
  const deals=(S.crmDeals||[]).filter(x=>!["Выиграно","Проиграно","won","lost","closed"].includes(String(x.stage||x.status||""))).slice().sort((a,b)=>(+b.potential||0)-(+a.potential||0));
  return gpt135Plain({
    pace:gpt135Call("work121PaceForecast")||gpt135Call("workPaceData"),
    deals:deals.slice(0,detailed?60:25).map(x=>({
      id:x.id,name:x.name||x.title||"",city:x.city||"",stage:x.stage||x.status||"",potential:+x.potential||0,
      probability:+x.probability||0,nextStep:x.nextStep||x.nextAction||"",nextDate:x.nextDate||"",
      decisionDate:x.decisionDate||"",tenderDate:x.tenderDate||"",realizationDate:x.realizationDate||"",
      competitor:x.competitor||"",note:detailed?(x.note||""):""
    }))
  })
}
function gpt135KnowledgeContext(detailed){
  const books=S.books||[],current=books.filter(x=>x.status==="reading"),reviews=gpt135Call("knowledgeReviewQueue")||[];
  return gpt135Plain({
    consistency:gpt135Call("readingConsistencyData",28),
    current:current.slice(0,5).map(x=>({id:x.id,title:x.title,author:x.author,currentPage:+x.currentPage||0,totalPages:+x.totalPages||0})),
    reviewQueue:Array.isArray(reviews)?(detailed?reviews.slice(0,20):reviews.length):reviews,
    nextQueued:books.filter(x=>x.status==="queued").sort((a,b)=>(+a.readingOrder||999)-(+b.readingOrder||999)).slice(0,detailed?10:5).map(x=>({title:x.title,author:x.author,readingOrder:x.readingOrder}))
  })
}
function gpt135BuildContext(){
  const st=gpt135Store(),use=st.scopes,detailed=st.privacy==="detailed",ctx={
    generatedAt:new Date().toISOString(),
    appVersion:typeof APP_VERSION!=="undefined"?APP_VERSION:"",
    stateVersion:typeof STATE_VERSION!=="undefined"?STATE_VERSION:null,
    privacy:st.privacy,
    sources:[]
  };
  const add=(key,value,source)=>{if(value!=null){ctx[key]=gpt135Plain(value);ctx.sources.push(source||key)}};
  if(use.planning)add("planning",{
    tasks:gpt135TaskRows(detailed),
    calendar:gpt135CalendarRows(detailed),
    dailyPlan:gpt135Call("lifeOsDailyPlan"),
    guardrails:gpt135Call("lifeOsGuardrails"),
    projects:gpt135Call("projectActive"),
    goals:gpt135Call("goalActive")
  },"Tasks / Calendar / Life OS");
  if(use.finance)add("finance",gpt135FinanceContext(detailed),"Finance OS");
  if(use.work)add("work",gpt135WorkContext(detailed),"Work OS / CRM");
  if(use.tennis)add("tennis",{
    load:gpt135Call("tennisLoadProfile"),
    decision:gpt135Call("tennisDecisionData"),
    sessions:gpt135Plain((S.tennis||[]).slice(-(detailed?15:8)))
  },"Tennis OS");
  if(use.training)add("training",{
    load:gpt135Call("training129LoadProfile"),
    suggestedWeek:gpt135Call("training129SuggestedWeek")
  },"Training OS");
  if(use.knowledge)add("knowledge",gpt135KnowledgeContext(detailed),"Knowledge OS");
  if(use.intelligence){
    const raw=gpt135Call("lifeOsRawCandidates")||[],ranked=typeof intelligence132RankCandidates==="function"?intelligence132RankCandidates(raw):raw;
    add("intelligence",{
      topCandidates:ranked.slice(0,12),
      anomalies:gpt135Call("intelligence132Anomalies")||[],
      calibration:gpt135Call("intelligence1321CalibrationSummary"),
      drift:gpt135Call("intelligence1321Drift"),
      forecasts:gpt135Call("predictive1322Forecasts",7)||[],
      verification:gpt135Call("predictive1322Verification")
    },"Decision Intelligence / Predictive Trends")
  }
  add("system",{
    integrityIssues:(gpt135Call("dataIntegrityIssues")||[]).slice(0,20),
    safeMode:!!gpt135Call("recovery133SafeModeActive")
  },"Data Integrity / Recovery");
  return ctx
}
function gpt135ResponseSchema(){
  return {
    format:GPT135_RESPONSE_FORMAT,
    version:1,
    packageId:"COPY_FROM_CONTEXT_PACKAGE",
    generatedAt:"ISO-8601",
    summary:"Краткий вывод на русском",
    tasks:[{
      title:"Конкретное действие",
      area:"Работа | Финансы | Теннис | Знания | Личное | Система",
      priority:"1=высокий, 2=средний, 3=низкий",
      dueDate:"YYYY-MM-DD или пусто",
      plannedDate:"YYYY-MM-DD или пусто",
      notBefore:"YYYY-MM-DD или пусто",
      minutes:"0..720",
      note:"Почему/контекст"
    }],
    calendar:[{
      title:"Событие/блок",
      type:"Работа | Финансы | Тренировка | Турнир | Знания | Личное | Другое",
      dateKey:"YYYY-MM-DD",
      minutes:"0..720",
      priority:"1..3",
      note:"Контекст"
    }],
    recommendations:[{area:"область",title:"рекомендация",detail:"обоснование"}],
    assumptions:["неизвестные/допущения"]
  }
}
function gpt135Instructions(packageId){
  return [
    "Проанализируй только данные из этого пакета. Не выдумывай факты.",
    `Верни результат как JSON формата ${GPT135_RESPONSE_FORMAT}. packageId должен быть ровно ${packageId}.`,
    "Ответ предназначен для обратного импорта в Life RPG. Не добавляй markdown вокруг JSON.",
    "Создавай только конкретные задачи, которые действительно требуют действия. Не дублируй уже существующие задачи.",
    "Для задачи используй plannedDate, если её нужно выполнить в конкретный день. dueDate — только реальный дедлайн.",
    "calendar используй только для событий/тренировок/встреч/временных блоков с конкретной датой. Не дублируй одну сущность и как задачу, и как событие без необходимости.",
    "Не более 12 задач и 12 календарных событий за один ответ.",
    "Все даты — YYYY-MM-DD. Приоритет: 1 высокий, 2 средний, 3 низкий.",
    "Никаких команд удалить/закрыть/изменить финансы или CRM: импорт разрешает только новые задачи и плановые события.",
    "Отдельно перечисли assumptions — что остаётся неизвестным или требует проверки."
  ]
}
function gpt135ReadSettingsFromUi(){
  const st=gpt135Store(),privacy=document.getElementById("gpt135Privacy");
  if(privacy)st.privacy=privacy.value==="detailed"?"detailed":"summary";
  for(const k of Object.keys(st.scopes)){const el=document.getElementById(`gpt135Scope-${k}`);if(el)st.scopes[k]=!!el.checked}
  return st
}
function gpt135HistoryAdd(row){
  const st=gpt135Store(),x={id:gpt135Id("hist"),at:new Date().toISOString(),...row};
  st.history.unshift(x);st.history=st.history.slice(0,GPT135_MAX_HISTORY);return x
}
function gpt135DownloadJson(data,name){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200)
}
async function gpt135Export(mode="custom"){
  const box=document.getElementById("gpt135Question"),question=gpt135NormText(box?.value,6000);
  if(!question){toast("Сначала укажи, что нужно спросить у GPT");return}
  gpt135ReadSettingsFromUi();
  const packageId=gpt135Id("pkg"),data={
    format:GPT135_CONTEXT_FORMAT,
    version:1,
    packageId,
    generatedAt:new Date().toISOString(),
    appVersion:typeof APP_VERSION!=="undefined"?APP_VERSION:"",
    stateVersion:typeof STATE_VERSION!=="undefined"?STATE_VERSION:null,
    request:{mode:String(mode||"custom"),question},
    instructions:gpt135Instructions(packageId),
    responseSchema:gpt135ResponseSchema(),
    context:gpt135BuildContext()
  };
  gpt135HistoryAdd({kind:"export",packageId,question,mode,detail:`${data.context.sources.length} источников`});
  if(typeof persist==="function")persist().catch(()=>{});
  gpt135DownloadJson(data,`life-rpg-gpt-context-${typeof localDateKey==="function"?localDateKey():new Date().toISOString().slice(0,10)}.json`);
  renderGpt135();toast("GPT-пакет скачан")
}
function gpt135Preset(mode){
  const q={
    today:"Проанализируй мои текущие данные и составь реалистичный план на сегодня: максимум 3 главных приоритета, необходимые задачи и только действительно нужные события календаря.",
    week:"Составь план на ближайшие 7 дней. Учти дедлайны, нагрузку, деньги, работу, тренировки и уже существующий календарь. Не перегружай дни.",
    work:"Разбери мою текущую рабочую ситуацию и CRM. Создай только конкретные следующие действия, которые повышают шанс продаж и закрывают просроченные шаги.",
    finance:"Разбери ближайшие финансовые обязательства и риски. Создай задачи/план только там, где реально требуется действие с моей стороны.",
    review:"Проведи полный обзор Life RPG: найди главные риски, противоречия и узкие места, затем сформируй минимальный набор задач и плановых событий на ближайшие 7 дней."
  }[mode]||"";
  const el=document.getElementById("gpt135Question");if(el){el.value=q;el.focus?.()}
  return q
}
function gpt135NormalizeTask(x,i){
  const title=gpt135NormText(x?.title,240);if(!title)throw new Error(`Задача ${i+1}: нет title`);
  return {
    title,area:gpt135Area(x?.area),priority:clamp(Math.round(+x?.priority||2),1,3),
    dueDate:gpt135ValidDate(x?.dueDate,`Задача ${i+1} dueDate`),
    plannedDate:gpt135ValidDate(x?.plannedDate,`Задача ${i+1} plannedDate`),
    notBefore:gpt135ValidDate(x?.notBefore,`Задача ${i+1} notBefore`),
    minutes:clamp(Math.round(+x?.minutes||30),0,720),
    note:gpt135NormText(x?.note,1200),include:true,duplicate:false
  }
}
function gpt135CalendarType(v){
  const x=String(v||"").trim().toLowerCase(),map={work:"Работа","работа":"Работа",finance:"Финансы","финансы":"Финансы",training:"Тренировка","тренировка":"Тренировка",tournament:"Турнир","турнир":"Турнир",knowledge:"Знания","знания":"Знания",personal:"Личное","личное":"Личное","другое":"Другое"};
  return map[x]||"Другое"
}
function gpt135NormalizeCalendar(x,i){
  const title=gpt135NormText(x?.title,240);if(!title)throw new Error(`Событие ${i+1}: нет title`);
  const dateKey=gpt135ValidDate(x?.dateKey,`Событие ${i+1} dateKey`,true);
  if(typeof localDateKey==="function"&&dateKey<localDateKey())throw new Error(`Событие ${i+1}: дата ${dateKey} уже в прошлом`);
  return {
    title,type:gpt135CalendarType(x?.type),dateKey,
    minutes:clamp(Math.round(+x?.minutes||30),0,720),priority:clamp(Math.round(+x?.priority||2),1,3),
    note:gpt135NormText(x?.note,1200),include:true,duplicate:false
  }
}
function gpt135NormalizeRecommendation(x){
  if(typeof x==="string")return {area:"",title:gpt135NormText(x,240),detail:""};
  return {area:gpt135NormText(x?.area,80),title:gpt135NormText(x?.title,240),detail:gpt135NormText(x?.detail,1600)}
}
function gpt135NormalizeResponse(obj){
  if(!obj||typeof obj!=="object"||Array.isArray(obj))throw new Error("Ответ GPT должен быть JSON-объектом");
  if(obj.format!==GPT135_RESPONSE_FORMAT)throw new Error(`Нужен формат ${GPT135_RESPONSE_FORMAT}`);
  const tasks=(Array.isArray(obj.tasks)?obj.tasks:[]).slice(0,30).map(gpt135NormalizeTask);
  const calendar=(Array.isArray(obj.calendar)?obj.calendar:[]).slice(0,30).map(gpt135NormalizeCalendar);
  return {
    format:GPT135_RESPONSE_FORMAT,version:1,
    packageId:gpt135NormText(obj.packageId,160),generatedAt:gpt135NormText(obj.generatedAt,80),
    summary:gpt135NormText(obj.summary,4000),
    tasks,calendar,
    recommendations:(Array.isArray(obj.recommendations)?obj.recommendations:[]).slice(0,20).map(gpt135NormalizeRecommendation).filter(x=>x.title),
    assumptions:(Array.isArray(obj.assumptions)?obj.assumptions:[]).slice(0,20).map(x=>gpt135NormText(x,1000)).filter(Boolean)
  }
}
function gpt135TaskKey(x){return `${String(x.title||"").trim().toLowerCase()}|${x.plannedDate||""}|${x.dueDate||""}`}
function gpt135CalendarKey(x){return `${String(x.title||"").trim().toLowerCase()}|${x.dateKey||""}`}
function gpt135MarkDuplicates(payload){
  const taskKeys=new Set((typeof taskActive==="function"?taskActive():(S.entities?.tasks||[]).filter(x=>x.status==="active")).map(gpt135TaskKey));
  const calKeys=new Set((typeof calendarManualEvents==="function"?calendarManualEvents():S.entities?.calendarEvents||[]).filter(x=>x.status!=="cancelled").map(gpt135CalendarKey));
  for(const x of payload.tasks){x.duplicate=taskKeys.has(gpt135TaskKey(x));if(x.duplicate)x.include=false}
  for(const x of payload.calendar){x.duplicate=calKeys.has(gpt135CalendarKey(x));if(x.duplicate)x.include=false}
  return payload
}
function gpt135PreparePayload(obj,fileName="gpt-response.json"){
  const payload=gpt135MarkDuplicates(gpt135NormalizeResponse(obj)),fingerprint=gpt135FNV({
    packageId:payload.packageId,summary:payload.summary,tasks:payload.tasks.map(({include,duplicate,...x})=>x),calendar:payload.calendar.map(({include,duplicate,...x})=>x)
  }),alreadyApplied=gpt135Store().appliedFingerprints.includes(fingerprint);
  GPT135_PREVIEW={fileName,payload,fingerprint,alreadyApplied,preparedAt:new Date().toISOString()};
  renderGpt135();return GPT135_PREVIEW
}
async function gpt135PrepareInput(input){
  const file=input?.files?.[0];if(!file)return;
  try{
    const obj=JSON.parse(await file.text());gpt135PreparePayload(obj,file.name)
  }catch(e){
    GPT135_PREVIEW={fileName:file.name,error:String(e?.message||e),preparedAt:new Date().toISOString()};
    renderGpt135()
  }finally{input.value=""}
}
function gpt135Toggle(kind,index,checked){
  const arr=kind==="calendar"?GPT135_PREVIEW?.payload?.calendar:GPT135_PREVIEW?.payload?.tasks;
  if(!arr?.[index]||arr[index].duplicate)return;
  arr[index].include=!!checked;renderGpt135()
}
async function gpt135Apply(){
  const p=GPT135_PREVIEW;if(!p?.payload||p.error)return;
  if(p.alreadyApplied){toast("Этот GPT-ответ уже применялся");return}
  const tasks=p.payload.tasks.filter(x=>x.include&&!x.duplicate),calendar=p.payload.calendar.filter(x=>x.include&&!x.duplicate);
  if(!tasks.length&&!calendar.length){toast("Нет выбранных новых действий");return}
  if(tasks.length&&typeof taskCreate!=="function")throw new Error("Tasks OS недоступен");
  if(calendar.length&&typeof addCalendarPlan!=="function")throw new Error("Calendar OS недоступен");
  if(typeof confirm==="function"&&!confirm(`Применить ответ GPT?\nЗадач: ${tasks.length}\nСобытий календаря: ${calendar.length}`))return;
  const snap=typeof createPreActionSnapshot==="function"?await createPreActionSnapshot(`GPT Exchange • ${p.fileName}`):null,createdTasks=[],createdEvents=[];
  for(const x of tasks){
    const t=taskCreate({
      title:x.title,area:x.area,priority:x.priority,dueDate:x.dueDate,plannedDate:x.plannedDate,notBefore:x.notBefore,
      minutes:x.minutes,note:[x.note,"Источник: GPT Exchange"].filter(Boolean).join(" • ")
    });if(t?.id)createdTasks.push(t.id)
  }
  for(const x of calendar){
    const rows=addCalendarPlan({
      title:x.title,type:x.type,dateKey:x.dateKey,minutes:x.minutes,priority:x.priority,
      note:[x.note,"Источник: GPT Exchange"].filter(Boolean).join(" • "),repeatWeeks:1
    });for(const e of rows||[])if(e?.id)createdEvents.push(e.id)
  }
  const st=gpt135Store(),now=new Date().toISOString();
  st.lastAnalysis={at:now,packageId:p.payload.packageId,summary:p.payload.summary,recommendations:p.payload.recommendations,assumptions:p.payload.assumptions};
  st.appliedFingerprints.push(p.fingerprint);st.appliedFingerprints=st.appliedFingerprints.slice(-200);
  gpt135HistoryAdd({kind:"import",packageId:p.payload.packageId,fileName:p.fileName,tasks:createdTasks.length,calendar:createdEvents.length,snapshotTs:snap,summary:p.payload.summary});
  if(typeof audit==="function")audit("GPT Exchange applied","system",`${createdTasks.length} задач • ${createdEvents.length} событий`);
  GPT135_PREVIEW=null;
  if(typeof persist==="function")await persist();
  if(typeof render==="function")render();else renderGpt135();
  toast(`GPT: добавлено задач ${createdTasks.length}, событий ${createdEvents.length}`)
}
function gpt135PreviewHtml(){
  const p=GPT135_PREVIEW;
  if(!p)return '<div class="empty">Здесь появится предпросмотр файла, который вернул GPT.</div>';
  if(p.error)return `<div class="notice diagnostic-bad"><b>Файл не принят</b><div class="qmeta" style="margin-top:6px">${escapeHtml(p.error)}</div></div>`;
  const x=p.payload,tasks=x.tasks.map((t,i)=>`<label class="log-item" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" ${t.include&&!t.duplicate?"checked":""} ${t.duplicate?"disabled":""} onchange="gpt135Toggle('task',${i},this.checked)" style="margin-top:4px"><span><b>${escapeHtml(t.title)}</b><div class="qmeta">${escapeHtml(t.area)} • P${t.priority}${t.plannedDate?` • план ${escapeHtml(t.plannedDate)}`:""}${t.dueDate?` • срок ${escapeHtml(t.dueDate)}`:""} • ${t.minutes} мин${t.duplicate?" • уже есть":""}</div>${t.note?`<div class="qmeta">${escapeHtml(t.note)}</div>`:""}</span></label>`).join("");
  const cal=x.calendar.map((e,i)=>`<label class="log-item" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" ${e.include&&!e.duplicate?"checked":""} ${e.duplicate?"disabled":""} onchange="gpt135Toggle('calendar',${i},this.checked)" style="margin-top:4px"><span><b>${escapeHtml(e.title)}</b><div class="qmeta">${escapeHtml(e.dateKey)} • ${escapeHtml(e.type)} • ${e.minutes} мин${e.duplicate?" • уже есть":""}</div>${e.note?`<div class="qmeta">${escapeHtml(e.note)}</div>`:""}</span></label>`).join("");
  const rec=x.recommendations.map(r=>`<div class="log-item"><b>${escapeHtml(r.title)}</b>${r.detail?`<div class="qmeta">${escapeHtml(r.detail)}</div>`:""}</div>`).join("");
  const assumptions=x.assumptions.map(a=>`<div class="qmeta">• ${escapeHtml(a)}</div>`).join("");
  return `<div class="notice ${p.alreadyApplied?"diagnostic-bad":""}"><b>${p.alreadyApplied?"Этот ответ уже применялся":"Ответ готов к проверке"}</b><div class="qmeta">${escapeHtml(p.fileName)}${x.packageId?` • ${escapeHtml(x.packageId)}`:""}</div>${x.summary?`<div style="margin-top:8px">${escapeHtml(x.summary)}</div>`:""}</div>
    ${tasks?`<div class="title" style="margin-top:12px">Задачи</div>${tasks}`:""}
    ${cal?`<div class="title" style="margin-top:12px">План / календарь</div>${cal}`:""}
    ${rec?`<details style="margin-top:10px"><summary>Рекомендации GPT</summary><div style="margin-top:8px">${rec}</div></details>`:""}
    ${assumptions?`<details style="margin-top:10px"><summary>Неизвестные / допущения</summary><div style="margin-top:8px">${assumptions}</div></details>`:""}
    <button id="gpt135ApplyBtn" class="btn secondary" style="margin-top:12px" ${p.alreadyApplied?"disabled":""} onclick="gpt135Apply()">Применить выбранное</button>`
}
function gpt135LastHtml(){
  const x=gpt135Store().lastAnalysis;if(!x)return '<div class="empty">Импортированных решений GPT пока нет.</div>';
  const rec=(x.recommendations||[]).slice(0,6).map(r=>`<div class="qmeta">• ${escapeHtml(r.title)}${r.detail?` — ${escapeHtml(r.detail)}`:""}</div>`).join("");
  return `<div class="notice"><b>Последний импорт GPT</b><div class="qmeta">${new Date(x.at).toLocaleString("ru-RU")}</div>${x.summary?`<div style="margin-top:8px;white-space:pre-wrap">${escapeHtml(x.summary)}</div>`:""}${rec?`<div style="margin-top:8px">${rec}</div>`:""}</div>`
}
function gpt135HistoryHtml(){
  const rows=gpt135Store().history.slice(0,8);if(!rows.length)return '<div class="empty">История пуста.</div>';
  return rows.map(x=>`<div class="log-item"><b>${new Date(x.at).toLocaleString("ru-RU")} • ${x.kind==="export"?"экспорт":"импорт"}</b><div class="qmeta">${escapeHtml(x.packageId||"")}${x.kind==="import"?` • задач ${x.tasks||0} • событий ${x.calendar||0}`:""}${x.question?` • ${escapeHtml(x.question.slice(0,100))}`:""}</div></div>`).join("")
}
function ensureGpt135Ui(){
  const changed=gpt135CleanupLegacy(),grid=document.querySelector?.("#more .grid");if(!grid)return;
  if(changed&&typeof persist==="function")queueMicrotask(()=>persist().catch(()=>{}));
  if(document.getElementById("gpt135Card"))return;
  grid.insertAdjacentHTML("beforeend",`<div id="gpt135Card" data-ux7-view="overview" class="card ux7-card span-12">
    <div class="eyebrow">GPT Exchange 13.5</div><div class="section-title">ChatGPT ↔ Life RPG</div>
    <div class="muted" style="margin-top:6px">Полностью локальный обмен файлами. Life RPG ничего не отправляет в интернет сам: скачай пакет, загрузи его в ChatGPT, затем импортируй полученный JSON и подтверди изменения.</div>
    <div class="field" style="margin-top:12px"><label>Что нужно от GPT</label><textarea id="gpt135Question" rows="4" placeholder="Например: составь реалистичный план на ближайшие 7 дней"></textarea></div>
    <div class="split" style="gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn ghost small" onclick="gpt135Preset('today')">Сегодня</button><button class="btn ghost small" onclick="gpt135Preset('week')">Неделя</button><button class="btn ghost small" onclick="gpt135Preset('work')">Работа</button><button class="btn ghost small" onclick="gpt135Preset('finance')">Финансы</button><button class="btn ghost small" onclick="gpt135Preset('review')">Полный разбор</button></div>
    <div class="split" style="gap:8px;flex-wrap:wrap;margin-top:12px"><button id="gpt135ExportBtn" class="btn secondary" onclick="gpt135Export()">Скачать пакет для GPT</button><label class="btn ghost">Загрузить ответ GPT<input id="gpt135ImportFile" type="file" accept=".json,application/json" style="display:none" onchange="gpt135PrepareInput(this)"></label></div>
    <details style="margin-top:12px"><summary>Что попадёт в пакет</summary><div class="field" style="margin-top:10px"><label>Детализация</label><select id="gpt135Privacy" onchange="gpt135ReadSettingsFromUi();persist().catch(()=>{})"><option value="summary">Summary — компактно</option><option value="detailed">Detailed — больше активных данных</option></select></div>
    <div id="gpt135Scopes" style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px">${["finance","work","tennis","training","knowledge","planning","intelligence"].map(k=>`<label style="display:flex;align-items:center;gap:10px"><input id="gpt135Scope-${k}" type="checkbox" onchange="gpt135ReadSettingsFromUi();persist().catch(()=>{})" style="width:22px;height:22px"><span>${({finance:"Финансы",work:"Работа / CRM",tennis:"Теннис",training:"Training",knowledge:"Знания",planning:"Задачи / календарь / Life OS",intelligence:"Decision Intelligence"})[k]}</span></label>`).join("")}</div></details>
    <div class="title" style="margin-top:14px">Предпросмотр ответа GPT</div><div id="gpt135Preview" style="margin-top:8px"></div>
    <div class="title" style="margin-top:14px">Последний результат</div><div id="gpt135Last" style="margin-top:8px"></div>
    <details style="margin-top:12px"><summary>История обмена</summary><div id="gpt135History" style="margin-top:8px"></div></details>
  </div>`)
}
function renderGpt135(){
  const st=gpt135Store(),privacy=document.getElementById("gpt135Privacy"),preview=document.getElementById("gpt135Preview"),last=document.getElementById("gpt135Last"),history=document.getElementById("gpt135History");
  if(privacy&&document.activeElement!==privacy)privacy.value=st.privacy;
  for(const [k,v] of Object.entries(st.scopes)){const el=document.getElementById(`gpt135Scope-${k}`);if(el)el.checked=!!v}
  if(preview)preview.innerHTML=gpt135PreviewHtml();if(last)last.innerHTML=gpt135LastHtml();if(history)history.innerHTML=gpt135HistoryHtml()
}
