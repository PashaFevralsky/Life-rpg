"use strict";

/* Life RPG 14.1.1 — Setup Center + Adaptive More.
   Product-shell enhancement only. No state migration. No external telemetry. */

const PRODUCT_CORE1411_MORE_FEATURES={
  "more:knowledge":{label:"Знания",meta:"Книги, заметки и база знаний"},
  "more:progress":{label:"Прогресс",meta:"XP, достижения и сезоны"},
  "more:import":{label:"Импорт и Share",meta:"Файлы, скриншоты и внешние данные"},
  "more:recent":{label:"Недавние действия",meta:"Последние изменения"},
  "more:recovery":{label:"Backup и Recovery",meta:"Резервные копии и восстановление"},
  "more:diagnostics":{label:"Диагностика",meta:"Целостность данных"},
  "more:settings":{label:"Профиль и параметры",meta:"Основные настройки"}
};

let PRODUCT_CORE1411_USAGE_BOUND=false;

function productCore1411Positive(v){return Number.isFinite(+v)&&+v>0}
function productCore1411Any(arr,fn=()=>true){return Array.isArray(arr)&&arr.some(fn)}

function productCore1411SetupStatus(){
  const settings=S?.settings||{},entities=S?.entities||{};
  const verifiedCash=
    productCore1411Any(S?.accounts,a=>a&&a.active!==false&&a.verifiedBalance!=null&&!!String(a.verifiedAt||"").trim())||
    !!String(settings.cashBalanceVerifiedAt||"").trim();
  const incomePlan=
    productCore1411Any(settings.incomeEvents,x=>x&&productCore1411Positive(x.amount))||
    productCore1411Positive(settings.monthlyIncome);
  const obligations=
    productCore1411Any(S?.debts,x=>x&&productCore1411Positive(x.balance))||
    productCore1411Any(S?.regularPayments,x=>x&&x.active!==false&&productCore1411Positive(x.amount));
  const work=
    productCore1411Positive(settings.workMonthlyPlan)||
    productCore1411Any(S?.workLogs)||
    productCore1411Any(S?.crmDeals);
  const execution=
    productCore1411Any(entities.tasks)||
    productCore1411Any(entities.routines)||
    productCore1411Any(entities.goals)||
    productCore1411Any(entities.projects)||
    productCore1411Any(entities.inbox);

  const steps=[
    {id:"cash",title:"Актуальные деньги",meta:"Подтверждён хотя бы один фактический баланс.",done:verifiedCash},
    {id:"income",title:"План поступлений",meta:"Есть реальный график или заданный месячный доход.",done:incomePlan},
    {id:"obligations",title:"Обязательства",meta:"Учтён хотя бы один долг или регулярный платёж.",done:obligations},
    {id:"work",title:"Рабочий контур",meta:"Есть план продаж, CRM или рабочие записи.",done:work},
    {id:"execution",title:"Контур действий",meta:"Есть задача, рутина, цель, проект или Inbox.",done:execution}
  ];
  const done=steps.filter(x=>x.done).length,score=Math.round(done/steps.length*100);
  const optional={
    tennis:productCore1411Any(S?.tennis),
    knowledge:productCore1411Any(S?.books)||productCore1411Any(S?.readingLogs)
  };
  return {steps,done,total:steps.length,score,optional,next:steps.find(x=>!x.done)||null}
}

function productCore1411Scroll(target){
  if(!target)return;
  setTimeout(()=>{
    const node=document.querySelector(target),card=node?.closest?.(".card")||node;
    card?.scrollIntoView?.({behavior:"smooth",block:"start"})
  },160)
}

function productCore1411OpenSetup(id,done=false){
  if(typeof productUsage141Track==="function")productUsage141Track("more:setup");
  if(id==="cash"){
    ux7Go("finance",done?"overview":"operations");
    if(!done)productCore1411Scroll("#bankSyncCard");
    return
  }
  if(id==="income"){
    if(done){ux7Go("finance","overview");return}
    ux7Go("more","settings");productCore1411Scroll("#incomeScheduleEditor");return
  }
  if(id==="obligations"){
    ux7Go("finance",done?"debts":"operations");
    if(!done)productCore1411Scroll("#regularPaymentList");
    return
  }
  if(id==="work"){
    if(done){ux7Go("work","overview");return}
    ux7Go("more","settings");productCore1411Scroll("#settingWorkPlan");return
  }
  if(id==="execution"){
    ux7Go("today","focus");
    if(typeof productCore141SetExpanded==="function")productCore141SetExpanded(true,false);
    productCore1411Scroll("#tasksOsCommand");
  }
}

function productCore1411EnsureSetup(){
  if(document.getElementById("productSetup1411Card"))return;
  const hub=document.querySelector("#more .ui139-more-hub"),grid=document.querySelector("#more .grid");
  if(!hub||!grid)return;
  const card=document.createElement("div");
  card.id="productSetup1411Card";
  card.dataset.ux7View="overview";
  card.className="card ux7-card span-12";
  card.innerHTML=`<div class="eyebrow">Setup Center</div>
    <div class="section-title">Готовность системы</div>
    <div class="muted" style="margin-top:6px">Считается по фактическим данным. Значения, которые Life RPG подставляет по умолчанию, сами по себе не дают готовность.</div>
    <div id="productSetup1411Summary" style="margin-top:12px"></div>
    <div id="productSetup1411Steps" style="margin-top:10px"></div>`;
  hub.insertAdjacentElement("afterend",card)
}

function productCore1411RenderSetup(){
  const summary=document.getElementById("productSetup1411Summary"),box=document.getElementById("productSetup1411Steps");
  if(!summary||!box)return;
  const x=productCore1411SetupStatus();
  const optional=[x.optional.tennis?"Теннис активен":"Теннис не активирован",x.optional.knowledge?"Знания активны":"Знания не активированы"];
  summary.innerHTML=`<div class="report-grid">
    <div class="report-item"><div class="smallcaps">Базовая готовность</div><b>${x.score}%</b></div>
    <div class="report-item"><div class="smallcaps">Настроено</div><b>${x.done}/${x.total}</b></div>
    <div class="report-item"><div class="smallcaps">Доп. домены</div><b>${Number(x.optional.tennis)+Number(x.optional.knowledge)}/2</b><div class="sub">${escapeHtml(optional.join(" • "))}</div></div>
  </div>
  <div class="progress" style="margin-top:10px"><i style="width:${x.score}%"></i></div>
  ${x.next?`<div class="notice" style="margin-top:10px"><b>Следующий шаг:</b> ${escapeHtml(x.next.title)}<button type="button" class="btn secondary small" data-setup-next="${x.next.id}" style="margin-top:8px">Продолжить настройку</button></div>`:`<div class="status" style="margin-top:10px"><b>Базовая настройка завершена.</b> Дальше приложение может опираться на реальные данные, а не на значения по умолчанию.</div>`}`;
  summary.querySelector("[data-setup-next]")?.addEventListener("click",e=>productCore1411OpenSetup(e.currentTarget.dataset.setupNext,false));

  box.innerHTML=x.steps.map(s=>`<div class="quest">
    <span class="tag ${s.done?"":"warn"}">${s.done?"✓":"!"}</span>
    <div class="qbody"><div class="qtitle">${escapeHtml(s.title)}</div><div class="qmeta">${escapeHtml(s.meta)}</div></div>
    <button type="button" class="btn ${s.done?"ghost":"secondary"} small" data-setup-step="${s.id}" data-setup-done="${s.done?"1":"0"}">${s.done?"Открыть":"Настроить"}</button>
  </div>`).join("");
  box.querySelectorAll("[data-setup-step]").forEach(b=>b.addEventListener("click",()=>productCore1411OpenSetup(b.dataset.setupStep,b.dataset.setupDone==="1")))
}

function productCore1411FeatureFromLabel(label){
  const map={
    "Знания":"more:knowledge",
    "Прогресс":"more:progress",
    "Импорт и Share":"more:import",
    "Недавние действия":"more:recent",
    "Backup и Recovery":"more:recovery",
    "Диагностика":"more:diagnostics",
    "Профиль и параметры":"more:settings"
  };
  return map[String(label||"").trim()]||""
}

function productCore1411InstrumentHub(){
  document.querySelectorAll("#more .ui139-more-hub .ui139-hub-row").forEach(b=>{
    if(b.dataset.productFeature)return;
    const id=productCore1411FeatureFromLabel(b.querySelector("b")?.textContent||"");
    if(id)b.dataset.productFeature=id
  })
}

function productCore1411TrackHubClick(e){
  const b=e.target?.closest?.("#more [data-product-feature]");
  if(!b||!b.dataset.productFeature)return;
  if(typeof productUsage141Track==="function")productUsage141Track(b.dataset.productFeature)
}

function productCore1411InstallUsage(){
  if(PRODUCT_CORE1411_USAGE_BOUND)return;
  PRODUCT_CORE1411_USAGE_BOUND=true;
  document.addEventListener("click",productCore1411TrackHubClick,{passive:true})
}

function productCore1411RunFeature(id){
  if(id==="more:knowledge"){ux7Go("more","knowledge");return}
  if(id==="more:progress"){ux7Go("more","rewards");return}
  if(id==="more:recent"){if(typeof ux128OpenRecent==="function")ux128OpenRecent();return}
  if(id==="more:import"){ui139MoreNavigate("settings","#import127Command");return}
  if(id==="more:recovery"){ui139MoreNavigate("settings","#recovery133Center");return}
  if(id==="more:diagnostics"){ui139MoreNavigate("settings","#systemDiagnostics");return}
  if(id==="more:settings")ui139MoreNavigate("settings","#profileName")
}

function productCore1411FrequentRows(){
  if(typeof productUsage141Totals!=="function")return[];
  return productUsage141Totals(30)
    .filter(x=>PRODUCT_CORE1411_MORE_FEATURES[x.feature]&&x.count>=2)
    .slice(0,3)
}

function productCore1411RenderAdaptiveMore(){
  const hub=document.querySelector("#more .ui139-more-hub");if(!hub)return;
  productCore1411InstrumentHub();
  let group=document.getElementById("productCore1411Frequent");
  const rows=productCore1411FrequentRows();
  if(!rows.length){group?.remove();return}
  if(!group){
    group=document.createElement("div");
    group.id="productCore1411Frequent";
    group.className="ui139-hub-group";
    const first=hub.querySelector(".ui139-hub-group");
    first?hub.insertBefore(group,first):hub.appendChild(group)
  }
  group.innerHTML=`<div class="ui139-hub-label">Часто используете</div>`+rows.map(x=>{
    const m=PRODUCT_CORE1411_MORE_FEATURES[x.feature];
    return `<button type="button" class="ui139-hub-row" data-product-feature="${x.feature}" data-product-adaptive="1">
      <span><b>${escapeHtml(m.label)}</b><small>${escapeHtml(m.meta)} • ${x.count} раз</small></span><i>›</i>
    </button>`
  }).join("");
  group.querySelectorAll("[data-product-adaptive]").forEach(b=>b.addEventListener("click",()=>productCore1411RunFeature(b.dataset.productFeature)))
}

function productCore1411Apply(){
  productCore1411EnsureSetup();
  productCore1411InstrumentHub();
  productCore1411RenderSetup();
  productCore1411RenderAdaptiveMore()
}

function ensureProductCore1411Ui(){
  productCore1411InstallUsage();
  productCore1411Apply()
}
function renderProductCore1411(){productCore1411Apply()}
