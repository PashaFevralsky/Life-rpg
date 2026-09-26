"use strict";

/* Life RPG 13.5.1 — GPT Exchange Guidance Layer.
   Backward-compatible extension for gpt-exchange-13.5.js.
   Adds optional GPT guidance (today Top-3, weekly focus, guardrails and domain notes)
   without changing the native Life OS ranking algorithm. */

const GPT1351_GUIDANCE_VERSION=1;

function gpt1351Status(v){
  const x=String(v||"").trim().toLowerCase();
  const map={
    "critical":"critical","критично":"critical","критический":"critical",
    "watch":"watch","наблюдать":"watch","внимание":"watch",
    "stable":"stable","стабильно":"stable","стабильный":"stable",
    "unknown":"unknown","неизвестно":"unknown","нет данных":"unknown"
  };
  return map[x]||"unknown"
}
function gpt1351TextItem(x,field="title",max=300){
  if(typeof x==="string")return {title:gpt135NormText(x,max),area:"",reason:"",outcome:""};
  return {
    title:gpt135NormText(x?.[field]??x?.title,max),
    area:x?.area?gpt135Area(x.area):"",
    reason:gpt135NormText(x?.reason,1000),
    outcome:gpt135NormText(x?.outcome,1000)
  }
}
function gpt1351NormalizeGuidance(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  const todayTop3=(Array.isArray(raw.todayTop3)?raw.todayTop3:[]).slice(0,3).map(x=>gpt1351TextItem(x)).filter(x=>x.title);
  const weekFocus=(Array.isArray(raw.weekFocus)?raw.weekFocus:[]).slice(0,5).map(x=>gpt1351TextItem(x)).filter(x=>x.title);
  const guardrails=(Array.isArray(raw.guardrails)?raw.guardrails:[]).slice(0,8).map(x=>gpt135NormText(x,1000)).filter(Boolean);
  const domainNotes=(Array.isArray(raw.domainNotes)?raw.domainNotes:[]).slice(0,10).map(x=>({
    area:x?.area?gpt135Area(x.area):"",
    status:gpt1351Status(x?.status),
    title:gpt135NormText(x?.title,280),
    detail:gpt135NormText(x?.detail,1800)
  })).filter(x=>x.title||x.detail);
  const validThrough=gpt135ValidDate(raw.validThrough,"guidance.validThrough");
  const headline=gpt135NormText(raw.headline,500);
  const reviewPrompt=gpt135NormText(raw.reviewPrompt,1200);
  if(!headline&&!todayTop3.length&&!weekFocus.length&&!guardrails.length&&!domainNotes.length&&!reviewPrompt)return null;
  return {version:GPT1351_GUIDANCE_VERSION,headline,validThrough,todayTop3,weekFocus,guardrails,domainNotes,reviewPrompt}
}
function gpt1351GuidanceExpired(g){
  if(!g?.validThrough||typeof localDateKey!=="function")return false;
  return g.validThrough<localDateKey()
}
function gpt1351GuidanceStatusLabel(status){
  return ({critical:"Критично",watch:"Наблюдать",stable:"Стабильно",unknown:"Неизвестно"})[status]||"Неизвестно"
}

const gpt1351BaseStore=gpt135Store;
gpt135Store=function(){
  const x=gpt1351BaseStore();
  if(!("activeGuidance" in x))x.activeGuidance=null;
  return x
};

const gpt1351BaseBuildContext=gpt135BuildContext;
gpt135BuildContext=function(){
  const ctx=gpt1351BaseBuildContext(),st=gpt135Store();
  if(st.activeGuidance||st.lastAnalysis){
    ctx.previousGpt=gpt135Plain({
      activeGuidance:st.activeGuidance?{...st.activeGuidance,expired:gpt1351GuidanceExpired(st.activeGuidance)}:null,
      lastAnalysis:st.lastAnalysis?{
        at:st.lastAnalysis.at||"",
        summary:st.lastAnalysis.summary||"",
        recommendations:(st.lastAnalysis.recommendations||[]).slice(0,8),
        assumptions:(st.lastAnalysis.assumptions||[]).slice(0,8)
      }:null
    });
    if(!ctx.sources.includes("Previous GPT Exchange"))ctx.sources.push("Previous GPT Exchange")
  }
  return ctx
};

const gpt1351BaseResponseSchema=gpt135ResponseSchema;
gpt135ResponseSchema=function(){
  const s=gpt1351BaseResponseSchema();
  s.guidance={
    headline:"Главный смысл плана одной фразой",
    validThrough:"YYYY-MM-DD или пусто; обычно горизонт не более 7 дней",
    todayTop3:[{title:"Приоритет на сегодня",area:"Работа | Финансы | Теннис | Знания | Личное | Система",reason:"Почему это входит в Top-3"}],
    weekFocus:[{title:"Фокус недели",area:"Работа | Финансы | Теннис | Знания | Личное | Система",outcome:"Какой наблюдаемый результат нужен к концу периода"}],
    guardrails:["Что не делать / какое ограничение соблюдать"],
    domainNotes:[{area:"Работа | Финансы | Теннис | Знания | Личное | Система",status:"critical | watch | stable | unknown",title:"Краткий вывод по области",detail:"Факты и ограничения вывода"}],
    reviewPrompt:"Что проверить при следующем обмене с GPT"
  };
  return s
};

const gpt1351BaseInstructions=gpt135Instructions;
gpt135Instructions=function(packageId){
  return [
    ...gpt1351BaseInstructions(packageId),
    "Если запрос касается планирования, обзора или приоритетов, заполни guidance.",
    "guidance.todayTop3 — максимум 3 приоритета именно как ориентир; не создавай отдельную задачу только ради дублирования этого текста.",
    "guidance.weekFocus — максимум 5 фокусов на ближайший период с проверяемым outcome.",
    "guidance.guardrails — только ограничения, реально следующие из FACT_PACK; не придумывай запреты.",
    "guidance.domainNotes — статус и краткое объяснение по значимым областям; если данных недостаточно, используй status=unknown.",
    "guidance.validThrough обычно не дальше 7 дней от даты context.generatedAt.",
    "GPT guidance — советующий слой. Исполняемые действия по-прежнему передавай через tasks/calendar."
  ]
};

const gpt1351BaseNormalizeResponse=gpt135NormalizeResponse;
gpt135NormalizeResponse=function(obj){
  const x=gpt1351BaseNormalizeResponse(obj);
  x.guidance=gpt1351NormalizeGuidance(obj?.guidance);
  return x
};

const gpt1351BasePreparePayload=gpt135PreparePayload;
gpt135PreparePayload=function(obj,fileName="gpt-response.json"){
  const p=gpt1351BasePreparePayload(obj,fileName);
  if(!p?.payload)return p;
  p.guidanceInclude=!!p.payload.guidance;
  p.fingerprint=gpt135FNV({
    packageId:p.payload.packageId,
    summary:p.payload.summary,
    tasks:p.payload.tasks.map(({include,duplicate,...x})=>x),
    calendar:p.payload.calendar.map(({include,duplicate,...x})=>x),
    guidance:p.payload.guidance
  });
  p.alreadyApplied=gpt135Store().appliedFingerprints.includes(p.fingerprint);
  renderGpt135();
  return p
};

function gpt1351ToggleGuidance(checked){
  if(!GPT135_PREVIEW?.payload?.guidance)return;
  GPT135_PREVIEW.guidanceInclude=!!checked;
  renderGpt135()
}

async function gpt135Apply(){
  const p=GPT135_PREVIEW;if(!p?.payload||p.error)return;
  if(p.alreadyApplied){toast("Этот GPT-ответ уже применялся");return}
  const tasks=p.payload.tasks.filter(x=>x.include&&!x.duplicate),
        calendar=p.payload.calendar.filter(x=>x.include&&!x.duplicate),
        guidance=p.guidanceInclude?p.payload.guidance:null;
  if(!tasks.length&&!calendar.length&&!guidance){toast("Нет выбранных новых действий или GPT-слоя");return}
  if(tasks.length&&typeof taskCreate!=="function")throw new Error("Tasks OS недоступен");
  if(calendar.length&&typeof addCalendarPlan!=="function")throw new Error("Calendar OS недоступен");
  const guidanceLine=guidance?`\nGPT-слой Life OS: да`:"";
  if(typeof confirm==="function"&&!confirm(`Применить ответ GPT?\nЗадач: ${tasks.length}\nСобытий календаря: ${calendar.length}${guidanceLine}`))return;
  const snap=typeof createPreActionSnapshot==="function"?await createPreActionSnapshot(`GPT Exchange 13.5.1 • ${p.fileName}`):null,
        createdTasks=[],createdEvents=[];
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
  if(guidance){
    st.activeGuidance={...guidance,appliedAt:now,packageId:p.payload.packageId,sourceGeneratedAt:p.payload.generatedAt||""}
  }
  st.lastAnalysis={
    at:now,packageId:p.payload.packageId,summary:p.payload.summary,
    recommendations:p.payload.recommendations,assumptions:p.payload.assumptions,
    guidance:p.payload.guidance||null
  };
  st.appliedFingerprints.push(p.fingerprint);st.appliedFingerprints=st.appliedFingerprints.slice(-200);
  gpt135HistoryAdd({
    kind:"import",packageId:p.payload.packageId,fileName:p.fileName,
    tasks:createdTasks.length,calendar:createdEvents.length,guidance:!!guidance,
    snapshotTs:snap,summary:p.payload.summary
  });
  if(typeof audit==="function")audit("GPT Exchange applied","system",`${createdTasks.length} задач • ${createdEvents.length} событий • GPT-слой ${guidance?"обновлён":"без изменений"}`);
  GPT135_PREVIEW=null;
  if(typeof persist==="function")await persist();
  if(typeof render==="function")render();else renderGpt135();
  toast(`GPT: задач ${createdTasks.length}, событий ${createdEvents.length}${guidance?" • GPT-слой обновлён":""}`)
}

function gpt1351GuidancePreviewHtml(g,checked=true){
  if(!g)return "";
  const top=(g.todayTop3||[]).map((x,i)=>`<div class="log-item"><b>#${i+1} ${escapeHtml(x.title)}</b><div class="qmeta">${x.area?escapeHtml(x.area)+" • ":""}${escapeHtml(x.reason||"")}</div></div>`).join("");
  const week=(g.weekFocus||[]).map(x=>`<div class="log-item"><b>${escapeHtml(x.title)}</b><div class="qmeta">${x.area?escapeHtml(x.area)+" • ":""}${escapeHtml(x.outcome||"")}</div></div>`).join("");
  const guard=(g.guardrails||[]).map(x=>`<div class="qmeta">• ${escapeHtml(x)}</div>`).join("");
  const domains=(g.domainNotes||[]).map(x=>`<div class="log-item"><b>${escapeHtml(x.area||"Система")} • ${escapeHtml(gpt1351GuidanceStatusLabel(x.status))}</b>${x.title?`<div>${escapeHtml(x.title)}</div>`:""}${x.detail?`<div class="qmeta">${escapeHtml(x.detail)}</div>`:""}</div>`).join("");
  return `<div class="notice" style="margin-top:12px">
    <label style="display:flex;gap:10px;align-items:flex-start"><input id="gpt135GuidanceInclude" type="checkbox" ${checked?"checked":""} onchange="gpt1351ToggleGuidance(this.checked)" style="margin-top:3px;width:22px;height:22px"><span><b>Сохранить GPT-слой в Life OS</b><div class="qmeta">Советующий слой; нативный алгоритм Life OS не перенастраивается.</div></span></label>
    ${g.headline?`<div style="margin-top:10px"><b>${escapeHtml(g.headline)}</b></div>`:""}
    ${g.validThrough?`<div class="qmeta">Актуально до ${escapeHtml(g.validThrough)}</div>`:""}
    ${top?`<div class="title" style="margin-top:10px">Top-3 на сегодня</div>${top}`:""}
    ${week?`<details style="margin-top:8px"><summary>Фокус недели</summary><div style="margin-top:6px">${week}</div></details>`:""}
    ${guard?`<details style="margin-top:8px"><summary>Ограничения / guardrails</summary><div style="margin-top:6px">${guard}</div></details>`:""}
    ${domains?`<details style="margin-top:8px"><summary>Заметки по областям</summary><div style="margin-top:6px">${domains}</div></details>`:""}
    ${g.reviewPrompt?`<div class="qmeta" style="margin-top:8px"><b>Следующая проверка:</b> ${escapeHtml(g.reviewPrompt)}</div>`:""}
  </div>`
}

const gpt1351BasePreviewHtml=gpt135PreviewHtml;
gpt135PreviewHtml=function(){
  const html=gpt1351BasePreviewHtml(),p=GPT135_PREVIEW,g=p?.payload?.guidance;
  if(!g)return html;
  const block=gpt1351GuidancePreviewHtml(g,p.guidanceInclude!==false);
  return html.replace('<button id="gpt135ApplyBtn"',block+'<button id="gpt135ApplyBtn"')
};

function gpt1351ActiveGuidanceHtml(g,compact=false){
  if(!g)return "";
  const expired=gpt1351GuidanceExpired(g),
        top=(g.todayTop3||[]).map((x,i)=>`<div class="quest"><span class="tag ${i===0?"warn":""}">GPT #${i+1}</span><div class="qbody"><div class="qtitle">${escapeHtml(x.title)}</div><div class="qmeta">${x.area?escapeHtml(x.area)+" • ":""}${escapeHtml(x.reason||"")}</div></div></div>`).join(""),
        week=(g.weekFocus||[]).map(x=>`<div class="qmeta">• ${escapeHtml(x.title)}${x.outcome?` — ${escapeHtml(x.outcome)}`:""}</div>`).join(""),
        guard=(g.guardrails||[]).map(x=>`<div class="qmeta">• ${escapeHtml(x)}</div>`).join(""),
        domains=(g.domainNotes||[]).map(x=>`<div class="log-item"><b>${escapeHtml(x.area||"Система")} • ${escapeHtml(gpt1351GuidanceStatusLabel(x.status))}</b>${x.title?`<div class="qmeta">${escapeHtml(x.title)}</div>`:""}${x.detail&&!compact?`<div class="qmeta">${escapeHtml(x.detail)}</div>`:""}</div>`).join("");
  return `<div class="notice ${expired?"diagnostic-bad":""}">
    <div class="split"><div><b>GPT-слой${expired?" • срок истёк":""}</b>${g.validThrough?`<div class="qmeta">Актуально до ${escapeHtml(g.validThrough)}</div>`:""}</div>${compact?"":'<button class="btn ghost small" onclick="gpt1351ClearGuidance()">Очистить</button>'}</div>
    ${g.headline?`<div style="margin-top:8px"><b>${escapeHtml(g.headline)}</b></div>`:""}
    ${top?`<div style="margin-top:8px">${top}</div>`:""}
    ${week&&!compact?`<details style="margin-top:8px"><summary>Фокус недели</summary><div style="margin-top:6px">${week}</div></details>`:""}
    ${guard&&!compact?`<details style="margin-top:8px"><summary>Guardrails GPT</summary><div style="margin-top:6px">${guard}</div></details>`:""}
    ${domains&&!compact?`<details style="margin-top:8px"><summary>По областям</summary><div style="margin-top:6px">${domains}</div></details>`:""}
    ${g.reviewPrompt&&!compact?`<div class="qmeta" style="margin-top:8px"><b>Следующий обмен:</b> ${escapeHtml(g.reviewPrompt)}</div>`:""}
  </div>`
}
async function gpt1351ClearGuidance(){
  const st=gpt135Store();if(!st.activeGuidance)return;
  if(typeof confirm==="function"&&!confirm("Очистить активный GPT-слой Life OS? Задачи и календарь не изменятся."))return;
  if(typeof createPreActionSnapshot==="function")await createPreActionSnapshot("Перед очисткой GPT-слоя");
  st.activeGuidance=null;
  if(typeof audit==="function")audit("GPT guidance cleared","system","Tasks/Calendar unchanged");
  if(typeof persist==="function")await persist();
  if(typeof render==="function")render();else renderGpt135();
  toast("GPT-слой очищен")
}
function gpt1351EnsureLifeOsLayer(){
  const cmd=document.getElementById("lifeOsCommand");if(!cmd||document.getElementById("gpt135LifeOsLayer"))return;
  cmd.insertAdjacentHTML("afterend",'<div id="gpt135LifeOsLayer" style="margin-top:12px" hidden></div>')
}
function gpt1351RenderLifeOsLayer(){
  gpt1351EnsureLifeOsLayer();
  const box=document.getElementById("gpt135LifeOsLayer");if(!box)return;
  const g=gpt135Store().activeGuidance;
  box.hidden=!g;
  box.innerHTML=g?gpt1351ActiveGuidanceHtml(g,false):""
}
function gpt1351RefreshHeader(){
  const card=document.getElementById("gpt135Card");if(!card)return;
  const eyebrow=card.querySelector(".eyebrow");if(eyebrow)eyebrow.textContent="GPT Exchange 13.5.1";
  const muted=card.querySelector(".muted");if(muted)muted.textContent="Локальный обмен файлами. Помимо задач и календаря GPT может вернуть Top-3, фокус недели, guardrails и заметки по областям — они сохраняются отдельным советующим слоем Life OS только после подтверждения."
}

const gpt1351BaseEnsureUi=ensureGpt135Ui;
ensureGpt135Ui=function(){
  gpt1351BaseEnsureUi();
  gpt1351RefreshHeader();
  gpt1351EnsureLifeOsLayer()
};

const gpt1351BaseLastHtml=gpt135LastHtml;
gpt135LastHtml=function(){
  const base=gpt1351BaseLastHtml(),g=gpt135Store().activeGuidance;
  return base+(g?`<div style="margin-top:10px">${gpt1351ActiveGuidanceHtml(g,true)}</div>`:"")
};

const gpt1351BaseRender=renderGpt135;
renderGpt135=function(){
  gpt1351BaseRender();
  gpt1351RefreshHeader();
  gpt1351RenderLifeOsLayer()
};
