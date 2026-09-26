"use strict";

/* Life RPG 13.4.2 — Free AI Bridge hotfix.
   Free Cloudflare Workers AI backend + Android Share fallback to ChatGPT.
   No paid provider API key is required or stored in the PWA. */

const AI134_PROTOCOL="life-rpg-secure-ai-bridge-v1";
const AI134_VERSION=3;
const AI134_TOKEN_KEY="lifeRpgAiBridge134AccessToken";
const AI134_MAX_HISTORY=30;
const AI134_MAX_FILE_BYTES=8*1024*1024;
const AI134_MAX_TOTAL_FILE_BYTES=12*1024*1024;
const AI134_MAX_FILES=3;
const AI134_ALLOWED_EXT=new Set(["pdf","txt","md","json","html","xml","csv","xls","xlsx","doc","docx","rtf","odt","ppt","pptx","png","jpg","jpeg","webp","gif"]);
let AI134_PENDING_FILES=[];
let AI134_PENDING_SHARE=null;
let AI134_LAST_HEALTH=null;
let AI134_BUSY=false;

function ai134Store(){
  S.settings=S.settings||{};
  let x=S.settings.aiBridge134;
  if(!x||typeof x!=="object"||Array.isArray(x))x={};
  if(typeof x.endpoint!=="string")x.endpoint="";
  if(!["summary","detailed"].includes(x.privacy))x.privacy="summary";
  if(!x.scopes||typeof x.scopes!=="object"||Array.isArray(x.scopes))x.scopes={finance:true,work:true,tennis:true,training:true,knowledge:true,planning:true,intelligence:true};
  for(const k of ["finance","work","tennis","training","knowledge","planning","intelligence"])if(typeof x.scopes[k]!=="boolean")x.scopes[k]=true;
  if(!Array.isArray(x.history))x.history=[];
  x.history=x.history.slice(0,AI134_MAX_HISTORY);
  x.version=AI134_VERSION;
  S.settings.aiBridge134=x;
  return x
}
function ai134Token(){try{return String(localStorage.getItem(AI134_TOKEN_KEY)||"")}catch{return""}}
function ai134SetToken(v){try{v=String(v||"").trim();if(v)localStorage.setItem(AI134_TOKEN_KEY,v);else localStorage.removeItem(AI134_TOKEN_KEY)}catch{}}
function ai134NormalizeBaseUrl(value){
  const raw=String(value||"").trim();
  if(!raw)return "";
  const u=new URL(raw);
  const local=["localhost","127.0.0.1","::1"].includes(u.hostname);
  if(u.protocol!=="https:"&&!local)throw new Error("AI Bridge должен использовать HTTPS");
  u.hash="";u.search="";
  u.pathname=u.pathname.replace(/\/(?:v1\/ask|health)\/?$/,"").replace(/\/+$/,"");
  return u.toString().replace(/\/$/,"")
}
function ai134SecretKey(k){return /(?:^|[_-])(token|secret|password|passwd|api.?key|authorization|cookie)(?:$|[_-])/i.test(String(k||""))||/^(token|secret|password|apiKey|authorization|cookie)$/i.test(String(k||""))}
function ai134Plain(value,depth=0,seen){
  if(value==null)return value;
  const t=typeof value;
  if(t==="string")return value.length>1200?value.slice(0,1200)+"…":value;
  if(t==="number")return Number.isFinite(value)?value:null;
  if(t==="boolean")return value;
  if(t!=="object")return undefined;
  seen=seen||new WeakSet();
  if(seen.has(value))return "[circular]";
  seen.add(value);
  if(depth>=5)return Array.isArray(value)?`[array:${value.length}]`:"[object]";
  if(Array.isArray(value))return value.slice(0,20).map(x=>ai134Plain(x,depth+1,seen)).filter(x=>x!==undefined);
  const out={},keys=Object.keys(value).slice(0,40);
  for(const k of keys){if(ai134SecretKey(k))continue;const v=ai134Plain(value[k],depth+1,seen);if(v!==undefined)out[k]=v}
  return out
}
function ai134Call(name,...args){try{const fn=globalThis[name];return typeof fn==="function"?fn(...args):null}catch{return null}}
function ai134Candidate(x){return ai134Plain({id:x?.id||"",area:x?.area||"",kind:x?.kind||"",title:x?.title||"",meta:x?.meta||"",score:+x?.score||0,hard:!!x?.hard,confidence:x?.confidence||"",confidenceScore:+x?.confidenceScore||0,source:x?.source||"",evidence:(x?.evidence||[]).slice(0,4),unknowns:(x?.unknowns||[]).slice(0,4),counterfactual:x?.counterfactual||""})}
function ai134Forecast(x){return ai134Plain({key:x?.key||"",domain:x?.domain||"",horizon:+x?.horizon||0,title:x?.title||"",riskScore:+x?.riskScore||0,riskLevel:x?.riskLevel||"",confidence:+x?.confidence||0,trajectory:x?.trajectory||"",timeToRisk:x?.timeToRisk??null,summary:x?.summary||"",requiredPace:x?.requiredPace||"",range:x?.range||"",evidence:(x?.evidence||[]).slice(0,4)})}
function ai134CrmSummary(detailed=false){
  const rows=Array.isArray(S.crmDeals)?S.crmDeals:[],active=rows.filter(x=>!["won","lost","closed","done"].includes(String(x.status||x.stage||"").toLowerCase()));
  const potential=active.reduce((s,x)=>s+Math.max(0,+x.potential||+x.amount||0),0),overdue=active.filter(x=>String(x.nextDate||"")&&String(x.nextDate)<localDateKey()).length;
  const out={total:rows.length,active:active.length,potential,overdueNextSteps:overdue};
  if(detailed)out.topDeals=active.slice().sort((a,b)=>(+b.potential||+b.amount||0)-(+a.potential||+a.amount||0)).slice(0,10).map(x=>ai134Plain({name:x.name||x.title||"",city:x.city||"",stage:x.stage||x.status||"",potential:+x.potential||+x.amount||0,probability:+x.probability||0,nextAction:x.nextAction||x.nextStep||"",nextDate:x.nextDate||"",competitor:x.competitor||""}));
  return out
}
function ai134DebtSummary(detailed=false){
  const rows=Array.isArray(S.debts)?S.debts:[],amount=x=>Math.max(0,+x.balance||+x.remaining||+x.principal||+x.amount||0);
  const out={count:rows.length,totalRemaining:rows.reduce((s,x)=>s+amount(x),0)};
  if(detailed)out.items=rows.slice(0,12).map(x=>ai134Plain({name:x.name||x.title||x.bank||"",remaining:amount(x),rate:+x.rate||+x.apr||0,nextPayment:+x.nextPayment||+x.minPayment||0,nextDate:x.nextDate||x.dueDate||""}));
  return out
}
function ai134TaskSummary(detailed=false){
  const tasks=S.entities?.tasks||[],active=tasks.filter(x=>String(x.status||"active")!=="done"),today=localDateKey();
  const out={active:active.length,dueToday:active.filter(x=>x.dueDate===today).length,overdue:active.filter(x=>x.dueDate&&x.dueDate<today).length};
  if(detailed)out.items=active.slice(0,20).map(x=>ai134Plain({title:x.title||"",area:x.area||"",priority:+x.priority||0,dueDate:x.dueDate||"",plannedDate:x.plannedDate||"",minutes:+x.minutes||0,status:x.status||""}));
  return out
}
function ai134BuildContext(scopes){
  const st=ai134Store(),use={...st.scopes,...(scopes||{})},detailed=st.privacy==="detailed",ctx={
    protocol:AI134_PROTOCOL,
    generatedAt:new Date().toISOString(),
    appVersion:typeof APP_VERSION!=="undefined"?APP_VERSION:"",
    stateVersion:typeof STATE_VERSION!=="undefined"?STATE_VERSION:null,
    privacy:st.privacy,
    rules:{factsFirst:true,noAutonomousWrites:true,distinguishFactsInferencesUnknowns:true},
    sources:[]
  };
  const add=(key,value,source)=>{if(value!=null){ctx[key]=ai134Plain(value);ctx.sources.push(source||key)}};
  if(use.planning){
    const p=ai134Call("lifeOsDailyPlan"),guard=ai134Call("lifeOsGuardrails"),today=ai134Call("calendarDayLoad",localDateKey());
    add("planning",{tasks:ai134TaskSummary(detailed),todayPlan:(p?.plan||[]).slice(0,8).map(ai134Candidate),deferred:(p?.deferred||[]).slice(0,5).map(ai134Candidate),minutes:p?.minutes??null,overload:p?.overload??null,guardrails:guard||[],calendarToday:today},"Life OS / Tasks / Calendar");
  }
  if(use.finance){
    add("finance",{decision:ai134Call("decisionEngineData"),projection:ai134Call("buildFinancialProjection",30),debts:ai134DebtSummary(detailed)},"Finance OS");
  }
  if(use.work){
    add("work",{pace:ai134Call("work121PaceForecast")||ai134Call("workPaceData"),crm:ai134CrmSummary(detailed)},"Work OS / CRM");
  }
  if(use.tennis){
    add("tennis",{load:ai134Call("tennisLoadProfile"),decision:ai134Call("tennisDecisionData"),sessions:detailed?ai134Plain((S.tennis||[]).slice(-12)):undefined},"Tennis OS");
  }
  if(use.training){
    add("training",{load:ai134Call("training129LoadProfile"),week:ai134Call("training129SuggestedWeek")},"Training OS");
  }
  if(use.knowledge){
    const reviews=ai134Call("knowledgeReviewQueue"),consistency=ai134Call("readingConsistencyData",28);
    add("knowledge",{consistency,reviews:Array.isArray(reviews)?reviews.length:reviews,current:detailed?ai134Plain((S.books||[]).filter(x=>x.status==="reading").slice(0,5)):undefined},"Knowledge OS");
  }
  if(use.intelligence){
    const plan=ai134Call("lifeOsRawCandidates")||[];
    const ranked=typeof intelligence132RankCandidates==="function"?intelligence132RankCandidates(plan):[];
    add("intelligence",{topCandidates:ranked.slice(0,8).map(ai134Candidate),anomalies:ai134Call("intelligence132Anomalies")||[],calibration:ai134Call("intelligence1321CalibrationSummary"),drift:ai134Call("intelligence1321Drift"),forecasts:(ai134Call("predictive1322Forecasts",7)||[]).map(ai134Forecast),forecastVerification:ai134Call("predictive1322Verification")},"Decision Intelligence / Predictive Trends");
  }
  const issues=ai134Call("dataIntegrityIssues")||[];
  ctx.system={integrityIssues:Array.isArray(issues)?issues.slice(0,12).map(x=>ai134Plain({title:x?.title||String(x),severity:x?.severity||"",detail:x?.detail||""})):[],safeMode:!!ai134Call("recovery133SafeModeActive")};
  ctx.sources.push("Data Integrity / Recovery");
  return ctx
}
async function ai134Hash(value){
  const text=typeof value==="string"?value:JSON.stringify(value),bytes=new TextEncoder().encode(text);
  if(globalThis.crypto?.subtle){const h=await crypto.subtle.digest("SHA-256",bytes);return "sha256:"+[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
  let h=2166136261;for(const b of bytes){h^=b;h=Math.imul(h,16777619)}return "fnv1a:"+(h>>>0).toString(16)
}
function ai134Ext(name){const m=String(name||"").toLowerCase().match(/\.([a-z0-9]+)$/);return m?m[1]:""}
function ai134FileKind(file){const type=String(file?.type||"").toLowerCase(),ext=ai134Ext(file?.name);return type.startsWith("image/")||["png","jpg","jpeg","webp","gif"].includes(ext)?"image":"file"}
function ai134FileAllowed(file){return AI134_ALLOWED_EXT.has(ai134Ext(file?.name))||String(file?.type||"").startsWith("image/")}
function ai134DataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error||new Error("Не удалось прочитать файл"));r.readAsDataURL(file)})}
async function ai134Attachments(){
  const files=(AI134_PENDING_FILES||[]).slice(0,AI134_MAX_FILES),total=files.reduce((s,f)=>s+(+f.size||0),0);
  if(total>AI134_MAX_TOTAL_FILE_BYTES)throw new Error("Суммарный размер файлов больше 12 МБ");
  const out=[];
  for(const file of files){
    if(!ai134FileAllowed(file))throw new Error(`Формат ${file.name} не поддерживается AI Bridge`);
    if((+file.size||0)>AI134_MAX_FILE_BYTES)throw new Error(`${file.name}: файл больше 8 МБ`);
    out.push({name:String(file.name||"file"),mime:String(file.type||"application/octet-stream"),kind:ai134FileKind(file),size:+file.size||0,dataUrl:await ai134DataUrl(file)})
  }
  return out
}
function ai134SharedText(){return [AI134_PENDING_SHARE?.title,AI134_PENDING_SHARE?.text,AI134_PENDING_SHARE?.url].map(x=>String(x||"").trim()).filter(Boolean).join("\n").slice(0,20000)}
async function ai134BuildRequest(question,mode="general"){
  question=String(question||"").trim();if(!question)throw new Error("Введите вопрос");if(question.length>6000)throw new Error("Вопрос слишком длинный");
  const context=ai134BuildContext(),contextHash=await ai134Hash(context),attachments=await ai134Attachments();
  return {body:{protocol:AI134_PROTOCOL,requestId:(globalThis.crypto?.randomUUID?.()||`lrpg-${Date.now()}`),mode:String(mode||"general"),question,context,contextHash,sharedText:ai134SharedText(),attachments,client:{name:"Life RPG",module:"Free AI Bridge 13.4.2",appVersion:typeof APP_VERSION!=="undefined"?APP_VERSION:"",stateVersion:typeof STATE_VERSION!=="undefined"?STATE_VERSION:null}},contextHash}
}
function ai134HistoryAdd(row){
  const st=ai134Store(),x={id:globalThis.crypto?.randomUUID?.()||`ai-${Date.now()}`,at:new Date().toISOString(),...row};
  if(x.answer)x.answer=String(x.answer).slice(0,12000);if(x.question)x.question=String(x.question).slice(0,3000);
  st.history.unshift(x);st.history=st.history.slice(0,AI134_MAX_HISTORY);return x
}
function ai134Endpoint(){
  const raw=ai134Store().endpoint;if(!raw)throw new Error("Сначала укажите Backend URL в Настройках");
  return ai134NormalizeBaseUrl(raw)
}
function ai134CorsError(e){const s=String(e?.message||e);if(/neuron|quota|daily limit|3040|capacity|free allocation/i.test(s))return "Cloudflare Workers AI: бесплатная квота или доступная мощность на сегодня исчерпана. Используй «Поделиться → ChatGPT».";return /fetch|network|cors/i.test(s)?"Backend недоступен. Проверь URL, CORS и Worker.":s}
async function ai134Health(){
  const base=ai134Endpoint(),ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);
  try{
    const r=await fetch(`${base}/health`,{method:"GET",cache:"no-store",signal:ctl.signal}),text=await r.text();let data={};try{data=JSON.parse(text)}catch{}
    if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);AI134_LAST_HEALTH={...data,checkedAt:new Date().toISOString(),ok:true};renderAi134();return AI134_LAST_HEALTH
  }catch(e){AI134_LAST_HEALTH={ok:false,error:ai134CorsError(e),checkedAt:new Date().toISOString()};renderAi134();throw e
  }finally{clearTimeout(timer)}
}
function ai134Busy(on,showStatus=true){
  AI134_BUSY=!!on;
  const ask=document.getElementById("ai134AskBtn"),health=document.getElementById("ai134HealthBtn"),answer=document.getElementById("ai134Answer");
  if(ask){ask.disabled=AI134_BUSY;ask.textContent=AI134_BUSY?"AI думает…":"Спросить бесплатно"}
  if(health)health.disabled=AI134_BUSY;
  if(AI134_BUSY&&showStatus&&answer)answer.innerHTML='<div class="notice"><b>AI думает…</b><div class="qmeta">Если основная модель занята, Worker автоматически попробует резервную.</div></div>'
}
async function ai134Ask(mode="general",explicitQuestion=""){
  if(AI134_BUSY)return;const box=document.getElementById("ai134Question"),question=String(explicitQuestion||box?.value||"").trim();ai134Busy(true);
  try{
    const base=ai134Endpoint(),token=ai134Token();
    const {body,contextHash}=await ai134BuildRequest(question,mode),ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);let r,data,text;
    try{
      const headers=token?{"Content-Type":"application/json","X-Life-RPG-Token":token}:{};
      r=await fetch(`${base}/v1/ask`,{method:"POST",headers,body:JSON.stringify(body),signal:ctl.signal});
      text=await r.text();try{data=JSON.parse(text)}catch{data={error:text.slice(0,500)}}
    }finally{clearTimeout(timer)}
    if(!r.ok||!data?.ok)throw new Error(data?.error||`AI Bridge HTTP ${r.status}`);
    const answer=String(data.answer||"").trim();if(!answer)throw new Error("Backend вернул пустой ответ");
    ai134HistoryAdd({status:"ok",mode,question,answer,contextHash,model:String(data.model||""),requestId:String(data.requestId||body.requestId),providerRequestId:String(data.providerRequestId||""),files:(body.attachments||[]).map(x=>x.name),sources:body.context.sources||[]});
    if(typeof audit==="function")audit("Free AI Bridge","system",`${mode} • ${contextHash.slice(0,24)}`);
    if(typeof persist==="function")persist().catch(()=>{});
    if(box)box.value="";AI134_PENDING_FILES=[];AI134_PENDING_SHARE=null;renderAi134();try{toast("AI Bridge: ответ получен")}catch{}
    return data
  }catch(e){
    ai134HistoryAdd({status:"error",mode,question,error:ai134CorsError(e),files:(AI134_PENDING_FILES||[]).map(x=>x.name)});
    if(typeof persist==="function")persist().catch(()=>{});renderAi134();try{toast(`AI Bridge: ${ai134CorsError(e)}`)}catch{};throw e
  }finally{ai134Busy(false)}
}
function ai134Preset(mode){
  const q={today:"На основе только переданных фактов: что мне делать сегодня? Дай максимум 3 приоритета, объясни почему и что сознательно отложить.",risk:"Разбери мои ближайшие риски по доменам. Отдели факты, выводы и неизвестные. Для каждого существенного риска дай один проверяемый следующий шаг.",decision:"Проверь мои текущие приоритеты и решения. Где данные слабые, где рекомендация может быть ошибочной и какой факт сильнее всего изменит решение?",nevatom:"Разбери приложенную рабочую заявку NEVATOM. Сначала извлеки технические требования и противоречия/пробелы, затем предложи дальнейшие действия. Не выдумывай номенклатуру, характеристики или наличие, которых нет в переданных данных."}[mode]||"";
  const el=document.getElementById("ai134Question");if(el){el.value=q;el.focus?.()}return q
}

function ai134SharePrompt(question,mode="general",context=null,contextHash=""){
  const ctx=context||ai134BuildContext(),shared=ai134SharedText(),rules=[
    "Используй только факты из FACT_PACK и приложенных файлов.",
    "Отделяй факты от интерпретаций и неизвестного.",
    "Не утверждай, что изменил Life RPG: это только анализ.",
    "Если данных недостаточно, укажи конкретно, чего не хватает."
  ];
  return [
    "LIFE RPG → CHATGPT",
    `MODE: ${String(mode||"general")}`,
    `QUESTION:\n${String(question||"").trim()}`,
    `CONTEXT_HASH: ${contextHash||""}`,
    `RULES:\n- ${rules.join("\n- ")}`,
    `FACT_PACK:\n${JSON.stringify(ctx,null,2)}`,
    shared?`SHARED_TEXT:\n${shared}`:""
  ].filter(Boolean).join("\n\n")
}
async function ai134ShareToChatGPT(mode="general",explicitQuestion=""){
  const box=document.getElementById("ai134Question"),question=String(explicitQuestion||box?.value||"").trim();if(!question)throw new Error("Введите вопрос");
  const context=ai134BuildContext(),contextHash=await ai134Hash(context),text=ai134SharePrompt(question,mode,context,contextHash),files=(AI134_PENDING_FILES||[]).slice(0,AI134_MAX_FILES),payload={title:"Life RPG → ChatGPT",text};
  if(files.length&&navigator?.canShare?.({files}))payload.files=files;
  try{
    if(!navigator?.share)throw new Error("share-unavailable");
    await navigator.share(payload);
    ai134HistoryAdd({status:"shared",mode,question,contextHash,model:"ChatGPT / Android Share",files:files.map(x=>x.name),sources:context.sources||[]});
    if(typeof audit==="function")audit("Free AI Bridge → Share","system",`${mode} • ${contextHash.slice(0,24)}`);
    if(typeof persist==="function")await persist();renderAi134();try{toast("Пакет передан в Android Share — выбери ChatGPT")}catch{}
    return {shared:true,contextHash}
  }catch(e){
    if(String(e?.name||"")==="AbortError")return {shared:false,cancelled:true};
    if(navigator?.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      ai134HistoryAdd({status:"copied",mode,question,contextHash,model:"Clipboard → ChatGPT",files:files.map(x=>x.name),sources:context.sources||[]});
      if(typeof persist==="function")await persist();renderAi134();try{toast("Fact pack скопирован. Вставь его в ChatGPT; файлы при необходимости приложи вручную.")}catch{}
      return {shared:false,copied:true,contextHash}
    }
    throw new Error("Android Share и буфер обмена недоступны")
  }
}

function ai134SetFiles(input){
  AI134_PENDING_FILES=[...(input?.files||[])].slice(0,AI134_MAX_FILES);AI134_PENDING_SHARE=null;renderAi134()
}
function ai134ClearFiles(){AI134_PENDING_FILES=[];AI134_PENDING_SHARE=null;const x=document.getElementById("ai134Files");if(x)x.value="";renderAi134()}
async function ai134AttachLatestShare(){
  if(typeof share131QueueAll!=="function")throw new Error("Share Hub недоступен");
  const rows=await share131QueueAll();if(!rows.length){toast("Share Hub: очередь пуста");return}
  const row=rows[0];AI134_PENDING_SHARE={id:row.id,title:row.title||"",text:row.text||"",url:row.url||""};AI134_PENDING_FILES=typeof share131Files==="function"?share131Files(row).slice(0,AI134_MAX_FILES):[];
  if(typeof ux7Go==="function")ux7Go("more","overview");renderAi134();toast("Последний Share прикреплён к AI Bridge")
}
async function ai134PreviewContext(){
  const ctx=ai134BuildContext(),hash=await ai134Hash(ctx),box=document.getElementById("ai134ContextPreview");if(!box)return;
  const text=JSON.stringify({...ctx,contextHash:hash},null,2);box.innerHTML=`<pre style="white-space:pre-wrap;word-break:break-word;max-height:420px;overflow:auto">${escapeHtml(text.slice(0,24000))}</pre>`
}
async function ai134SaveSettings(){
  const st=ai134Store(),endpoint=document.getElementById("ai134Endpoint"),token=document.getElementById("ai134Token"),privacy=document.getElementById("ai134Privacy");
  if(endpoint)st.endpoint=ai134NormalizeBaseUrl(endpoint.value);if(privacy)st.privacy=privacy.value==="detailed"?"detailed":"summary";if(token)ai134SetToken(token.value);
  for(const k of Object.keys(st.scopes)){const el=document.getElementById(`ai134Scope-${k}`);if(el)st.scopes[k]=!!el.checked}
  if(typeof audit==="function")audit("Free AI Bridge settings","system",st.endpoint?"backend configured":"backend cleared");
  if(typeof persist==="function")await persist();renderAi134();toast("AI Bridge настройки сохранены")
}
async function ai134ClearToken(){ai134SetToken("");const el=document.getElementById("ai134Token");if(el)el.value="";renderAi134();toast("Bridge token удалён с этого устройства")}
async function ai134ClearHistory(){if(typeof confirm==="function"&&!confirm("Очистить локальную историю AI Bridge?"))return;ai134Store().history=[];if(typeof persist==="function")await persist();renderAi134()}
function ai134FilesHtml(){
  const names=(AI134_PENDING_FILES||[]).map(f=>`${escapeHtml(f.name)} • ${(f.size/1024/1024).toFixed(1)} МБ`),share=AI134_PENDING_SHARE?`Share Hub: ${escapeHtml(AI134_PENDING_SHARE.title||AI134_PENDING_SHARE.text||AI134_PENDING_SHARE.url||"элемент")}`:"";
  if(!names.length&&!share)return '<div class="qmeta">Файлы не прикреплены.</div>';
  return `<div class="notice">${share?`<div class="qmeta">${share}</div>`:""}${names.map(x=>`<div class="qmeta">${x}</div>`).join("")}<button class="btn ghost small" style="margin-top:6px" onclick="ai134ClearFiles()">Убрать</button></div>`
}
function ai134HealthHtml(){
  const h=AI134_LAST_HEALTH;if(!h)return '<span class="tag">Cloudflare не проверен</span>';if(!h.ok)return `<span class="tag">ошибка</span> <span class="qmeta">${escapeHtml(h.error||"")}</span>`;
  return `<span class="tag">Workers AI Free OK</span> <span class="qmeta">${escapeHtml(h.model||"")} • ${escapeHtml(h.provider||"Cloudflare")} • token ${h.tokenRequired?(h.accessTokenConfigured?"on":"нужен"):"optional"}</span>`
}
function ai134HistoryHtml(){
  const rows=ai134Store().history.slice(0,8);if(!rows.length)return '<div class="empty">Запросов пока нет.</div>';
  return rows.map(x=>{const body=x.answer?`<div style="white-space:pre-wrap;margin-top:8px">${escapeHtml(x.answer)}</div>`:x.status==="shared"?'<div class="notice" style="margin-top:8px">Fact pack передан через Android Share.</div>':x.status==="copied"?'<div class="notice" style="margin-top:8px">Fact pack скопирован в буфер обмена.</div>':`<div class="notice diagnostic-bad" style="margin-top:8px">${escapeHtml(x.error||"Ошибка")}</div>`;return `<details class="log-item"><summary><b>${new Date(x.at).toLocaleString("ru-RU")}</b> • ${escapeHtml(x.mode||"general")} • ${escapeHtml((x.question||"").slice(0,90))}</summary><div class="qmeta" style="margin-top:6px">${escapeHtml(x.model||"")}${x.contextHash?` • ${escapeHtml(x.contextHash.slice(0,24))}`:""}${x.files?.length?` • ${x.files.map(escapeHtml).join(", ")}`:""}</div>${body}</details>`}).join("")
}
function ai134LastAnswerHtml(){
  const x=ai134Store().history.find(r=>r.status==="ok"||r.status==="error");if(!x)return '<div class="empty">Здесь появится ответ. AI не изменяет данные Life RPG автоматически.</div>';
  if(x.status==="error")return `<div class="notice diagnostic-bad"><b>AI не ответил</b><div class="qmeta" style="margin-top:6px;white-space:pre-wrap">${escapeHtml(x.error||"Неизвестная ошибка")}</div><div class="qmeta" style="margin-top:6px">Можно повторить запрос или использовать «Поделиться → ChatGPT».</div></div>`;
  return `<div class="notice"><div class="split" style="gap:6px;flex-wrap:wrap"><b>${escapeHtml(x.model||"AI")}</b><span class="tag">${escapeHtml(x.contextHash?.slice(0,18)||"")}</span></div><div style="white-space:pre-wrap;margin-top:8px">${escapeHtml(x.answer||"")}</div></div>`
}
function ai134PatchShareHub(){
  const card=document.getElementById("share131Command")?.closest?.(".card");if(!card||document.getElementById("ai134ShareHubPatch"))return;
  card.insertAdjacentHTML("beforeend",`<div id="ai134ShareHubPatch" class="notice" style="margin-top:12px"><div class="split" style="gap:6px;flex-wrap:wrap"><div><b>Free AI Bridge 13.4.2</b><div class="qmeta">Cloudflare Workers AI Free или Android Share → ChatGPT.</div></div><button class="btn ghost small" onclick="ai134AttachLatestShare()">Последний Share → AI</button></div></div>`)
}
function ensureAi134Ui(){
  const grid=document.querySelector?.("#more .grid");if(!grid)return;
  if(!document.getElementById("ai134Card"))grid.insertAdjacentHTML("beforeend",`<div id="ai134Card" data-ux7-view="overview" class="card ux7-card span-12"><div class="split" style="gap:6px;flex-wrap:wrap"><div><div class="eyebrow">Free AI Bridge 13.4.2</div><div class="section-title">AI без платного API</div></div><div id="ai134HealthState"></div></div><div class="muted" style="margin-top:6px">Два канала: бесплатный Cloudflare Workers AI внутри Life RPG и Android Share → ChatGPT. Fact pack собирается локально и ничего сам не меняет в базе.</div><div class="field" style="margin-top:10px"><label>Вопрос</label><textarea id="ai134Question" rows="4" placeholder="Например: что мне делать сегодня и почему?"></textarea></div><div class="split" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button id="ai134AskBtn" class="btn secondary" onclick="ai134Ask()">Спросить бесплатно</button><button id="ai134ShareChatGptBtn" class="btn ghost" onclick="ai134ShareToChatGPT()">Поделиться → ChatGPT</button></div><div class="split" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button class="btn ghost small" onclick="ai134Preset('today')">Сегодня</button><button class="btn ghost small" onclick="ai134Preset('risk')">Риски</button><button class="btn ghost small" onclick="ai134Preset('decision')">Проверить решение</button><button class="btn ghost small" onclick="ai134Preset('nevatom')">NEVATOM-заявка</button></div><div class="split" style="margin-top:8px;gap:6px;flex-wrap:wrap"><label class="btn ghost small">Файл<input id="ai134Files" type="file" multiple accept=".pdf,.txt,.md,.json,.html,.xml,.csv,.xls,.xlsx,.doc,.docx,.rtf,.odt,.ppt,.pptx,image/*" style="display:none" onchange="ai134SetFiles(this)"></label><button class="btn ghost small" onclick="ai134AttachLatestShare()">Из Share Hub</button><button class="btn ghost small" onclick="ai134PreviewContext()">Показать fact pack</button></div><div id="ai134AttachmentState" style="margin-top:8px"></div><div id="ai134Answer" style="margin-top:10px"></div><details style="margin-top:12px"><summary>Fact pack / evidence</summary><div id="ai134ContextPreview" style="margin-top:8px"></div></details><details style="margin-top:12px"><summary>История запросов</summary><div id="ai134History" style="margin-top:8px"></div></details></div>`);
  if(!document.getElementById("ai134SettingsCard"))grid.insertAdjacentHTML("beforeend",`<div id="ai134SettingsCard" data-ux7-view="settings" class="card ux7-card span-12"><div class="eyebrow">Free AI Bridge 13.4.2</div><div class="section-title">Бесплатное подключение</div><div class="notice" style="margin-top:8px"><b>Платный API key не нужен.</b><div class="qmeta">Cloudflare Worker использует встроенный Workers AI binding. На Free-плане доступна бесплатная дневная квота. Backend URL нужен только для ответа внутри Life RPG; «Поделиться → ChatGPT» работает и без Worker.</div></div><div class="field" style="margin-top:10px"><label>Cloudflare Worker URL</label><input id="ai134Endpoint" type="url" placeholder="https://...workers.dev"></div><div class="field"><label>Bridge Access Token (необязательно, но рекомендуется)</label><input id="ai134Token" type="password" autocomplete="off" placeholder="случайная строка из Worker Secret"></div><div class="field"><label>Объём контекста</label><select id="ai134Privacy"><option value="summary">Summary — агрегаты и решения</option><option value="detailed">Detailed — + активные задачи/сделки/долги</option></select></div><div class="title" style="margin-top:10px">Что можно отправлять в fact pack</div><div id="ai134Scopes" style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px">${["finance","work","tennis","training","knowledge","planning","intelligence"].map(k=>`<label style="display:flex;align-items:center;gap:10px;min-width:0;line-height:1.35"><input id="ai134Scope-${k}" type="checkbox" style="width:22px;height:22px;min-width:22px;flex:0 0 auto"> <span style="min-width:0;white-space:normal;overflow-wrap:anywhere">${({finance:"Финансы",work:"Работа / CRM",tennis:"Теннис",training:"Training",knowledge:"Знания",planning:"Планы / календарь",intelligence:"Decision Intelligence"})[k]}</span></label>`).join("")}</div><div class="split" style="margin-top:10px;gap:6px;flex-wrap:wrap"><button class="btn secondary" onclick="ai134SaveSettings()">Сохранить</button><button id="ai134HealthBtn" class="btn ghost" onclick="ai134Health().then(()=>toast('Workers AI доступен')).catch(e=>toast(String(e.message||e)))">Проверить Worker</button><button class="btn ghost" onclick="ai134ClearToken()">Удалить token</button><button class="btn ghost" onclick="ai134ClearHistory()">Очистить историю</button></div><div id="ai134SettingsStatus" style="margin-top:8px"></div></div>`);
  ai134PatchShareHub()
}
function renderAi134(){
  const st=ai134Store();ai134PatchShareHub();
  const health=document.getElementById("ai134HealthState"),settingsStatus=document.getElementById("ai134SettingsStatus"),attach=document.getElementById("ai134AttachmentState"),answer=document.getElementById("ai134Answer"),history=document.getElementById("ai134History");
  if(health)health.innerHTML=ai134HealthHtml();if(settingsStatus)settingsStatus.innerHTML=`${st.endpoint?'<span class="tag">Worker настроен</span>':'<span class="tag">Worker не настроен</span>'} ${ai134Token()?'<span class="tag">token на устройстве</span>':'<span class="tag">token optional</span>'} <span class="tag">ChatGPT Share готов</span>`;if(attach)attach.innerHTML=ai134FilesHtml();if(answer)answer.innerHTML=ai134LastAnswerHtml();if(history)history.innerHTML=ai134HistoryHtml();
  const endpoint=document.getElementById("ai134Endpoint"),token=document.getElementById("ai134Token"),privacy=document.getElementById("ai134Privacy");if(endpoint&&document.activeElement!==endpoint)endpoint.value=st.endpoint||"";if(token&&document.activeElement!==token)token.value=ai134Token();if(privacy&&document.activeElement!==privacy)privacy.value=st.privacy;
  for(const [k,v] of Object.entries(st.scopes)){const el=document.getElementById(`ai134Scope-${k}`);if(el)el.checked=!!v}
  ai134Busy(AI134_BUSY,false)
}
