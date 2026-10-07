"use strict";

/* Life RPG 14.1.2 navigation hardening.
   One deep-navigation contract for section -> view -> target -> reveal -> focus -> verify.
   No state schema or domain calculations are changed. */

let NAV1412_INSTALLED=false;
const NAV1412_BASE={};

function nav1412Frame(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
function nav1412Wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function nav1412Node(target){if(!target)return null;if(typeof target==="string")return document.querySelector(target);return target?.nodeType===1?target:null}
function nav1412Visible(el){if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return !el.hidden&&s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0}
function nav1412SectionFor(node){return node?.closest?.(".section")?.id||""}
function nav1412Card(node){return node?.closest?.(".card")||node||null}
function nav1412Views(card){return String(card?.dataset?.ux7View||"").split(/\s+/).filter(Boolean)}
function nav1412CurrentView(section){return document.querySelector(`#${section} .ux7-tab.active`)?.dataset?.view||""}
function nav1412ValidView(section,view){const meta=typeof UX7_META!=="undefined"?UX7_META:{},defs=typeof UX7_DEFAULTS!=="undefined"?UX7_DEFAULTS:{};const valid=(meta?.[section]?.tabs||[]).map(x=>x[0]);return valid.includes(view)?view:(defs?.[section]||valid[0]||view||"overview")}

function nav1412Reveal(node){
  if(!node)return null;
  const card=nav1412Card(node),section=nav1412SectionFor(node);
  if(section==="today"&&card?.classList?.contains("product-core141-secondary")&&typeof productCore141SetExpanded==="function")productCore141SetExpanded(true,false);
  if(card?.classList?.contains("ux7-clarity-collapsed")&&typeof ux7ToggleClarity==="function")ux7ToggleClarity(section);
  if(card?.hidden)card.hidden=false;
  if(card?.classList?.contains("ux7-editor-collapsed")&&typeof ux7ToggleEditor==="function")ux7ToggleEditor(card,true);
  for(let d=node.closest?.("details");d;d=d.parentElement?.closest?.("details"))d.open=true;
  if(card?.dataset?.personalWidget&&getComputedStyle(card).display==="none")card.style.display="";
  return card
}

async function lifeNavigate(opts={}){
  let {section="",view="",target="",focus="",block="start",behavior="smooth",verify=true}=opts||{};
  let node=nav1412Node(target),card=nav1412Card(node);
  const targetSection=nav1412SectionFor(node);if(targetSection)section=targetSection;
  if(!section)section=document.querySelector(".section.active")?.id||"today";
  const cardViews=nav1412Views(card);if(cardViews.length)view=cardViews[0];
  view=nav1412ValidView(section,view||nav1412CurrentView(section));
  switchTab(section);ux7SetView(section,view,false);
  await nav1412Frame();
  node=nav1412Node(target);card=nav1412Reveal(node);
  if(node){
    const actualSection=nav1412SectionFor(node);if(actualSection&&actualSection!==section){section=actualSection;switchTab(section)}
    const meta=typeof UX7_META!=="undefined"?UX7_META:{};const actualViews=nav1412Views(card),actualView=actualViews.find(v=>(meta?.[section]?.tabs||[]).some(x=>x[0]===v));
    if(actualView&&actualView!==nav1412CurrentView(section))ux7SetView(section,actualView,false);
    nav1412Reveal(node);await nav1412Frame();
  }
  if(!node){
    const sec=document.getElementById(section);if(sec)window.scrollTo({top:Math.max(0,sec.offsetTop-8),behavior:"auto"});
    return !target
  }
  card=nav1412Reveal(node);
  if(!nav1412Visible(card)){await nav1412Frame();card=nav1412Reveal(node)}
  if(!nav1412Visible(card)){if(typeof toast==="function")toast("Не удалось открыть нужный блок");return false}
  card.scrollIntoView({behavior,block,inline:"nearest"});
  await nav1412Frame();
  const f=nav1412Node(focus);if(f){nav1412Reveal(f);try{f.focus({preventScroll:true})}catch{f.focus?.()}}
  if(verify){
    await nav1412Wait(behavior==="smooth"?280:20);
    const r=card.getBoundingClientRect(),topPad=Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0,vh=window.innerHeight||document.documentElement.clientHeight;
    if(r.bottom<=topPad||r.top>=vh-8)card.scrollIntoView({behavior:"auto",block,inline:"nearest"})
  }
  try{document.dispatchEvent(new CustomEvent("life-rpg:navigation-complete",{detail:{section,view:nav1412CurrentView(section),target:typeof target==="string"?target:""}}))}catch{}
  return true
}

async function lifeNavigateEntity(type,id="",extra={}){
  type=String(type||"").toLowerCase();id=String(id||"");
  if(type==="task"){
    await lifeNavigate({section:"today",view:"focus",target:"#tasksOsCommand",behavior:"auto"});if(id&&typeof editTask==="function")editTask(id);
    return lifeNavigate({section:"today",view:"focus",target:id?"#taskEditorCard":"#tasksOsCommand",focus:id?"#taskTitle":""})
  }
  if(type==="routine"){
    await lifeNavigate({section:"today",view:"focus",target:"#routinesOsCommand",behavior:"auto"});if(id&&typeof editRoutine==="function")editRoutine(id);
    return lifeNavigate({section:"today",view:"focus",target:id?"#routineEditorCard":"#routinesOsCommand",focus:id?"#routineTitle":""})
  }
  if(type==="project"){
    await lifeNavigate({section:"more",view:"overview",target:"#projectsOsCommand",behavior:"auto"});if(id&&typeof editProject==="function")editProject(id);
    return lifeNavigate({section:"more",view:"overview",target:id?"#projectEditorCard":"#projectsOsCommand",focus:id?"#projectTitle":""})
  }
  if(type==="goal"){
    await lifeNavigate({section:"more",view:"overview",target:"#goalsOsCommand",behavior:"auto"});if(id&&typeof editGoal==="function")editGoal(id);
    return lifeNavigate({section:"more",view:"overview",target:id?"#goalEditorCard":"#goalsOsCommand",focus:id?"#goalTitle":""})
  }
  if(type==="crm"){
    await lifeNavigate({section:"work",view:"crm",target:"#crmDealList",behavior:"auto"});if(id&&typeof editCrmDeal==="function")editCrmDeal(id);
    return lifeNavigate({section:"work",view:"crm",target:id?"#crmEditorCard":"#crmDealList",focus:id?"#crmName":""})
  }
  if(type==="calendar")return lifeNavigate({section:"more",view:"overview",target:"#calendarOsCommand"});
  if(type==="inbox")return lifeNavigate({section:"today",view:"focus",target:"#inboxOsCommand"});
  if(type==="tennis"){if(id&&typeof editTennis==="function"){editTennis(id);return lifeNavigate({section:"tennis",view:"training",target:"#ttDate",focus:"#ttDate"})}return lifeNavigate({section:"tennis",view:"training"})}
  if(type==="person")return lifeNavigate({section:"more",view:"overview",target:"#peopleOsCommand"});
  if(type==="book")return lifeNavigate({section:"more",view:"knowledge",target:"#bookList",behavior:"auto"}).then(ok=>{if(!ok||!id)return ok;const row=[...document.querySelectorAll("#bookList .book")].find(el=>[...el.querySelectorAll("button")].some(b=>String(b.getAttribute("onclick")||"").includes(`'${id}'`)));if(row)row.scrollIntoView({behavior:"smooth",block:"center"});return true});
  if(type==="knowledge")return lifeNavigate({section:"more",view:"knowledge",target:"#knowledgeBase"});
  return lifeNavigate(extra)
}

function nav1412PatchSearchRows(){
  if(typeof dashboardSearchRows!=="function"||dashboardSearchRows.__nav1412)return;
  dashboardSearchRows=function(q){
    q=String(q||"").toLowerCase().trim();if(!q)return[];const out=[];
    const add=(kind,title,meta="",section="more",view="overview",entityType="",entityId="")=>{const hay=(String(title||"")+" "+String(meta||"")).toLowerCase();if(hay.includes(q))out.push({kind,title,meta,section,view,entityType,entityId:String(entityId||"")})};
    for(const x of typeof journalEntries==="function"?journalEntries():[])add("Дневник",x.text||x.happened||x.learned,[x.learned,x.change].filter(Boolean).join(" • "),"more","overview","journal",x.id);
    for(const x of typeof journalDecisions==="function"?journalDecisions():[])add("Решение",x.title,x.rationale||x.result,"more","overview","journal",x.id);
    for(const p of typeof peopleAll==="function"?peopleAll():[])add("Человек",p.name,`${p.relation} ${p.note||""}`,"more","overview","person",p.id);
    for(const x of typeof peopleInteractions==="function"?peopleInteractions():[])add("Контакт",typeof peopleFind==="function"?peopleFind(x.personId)?.name||"Контакт":"Контакт",x.note||"","more","overview","person",x.personId);
    for(const x of typeof taskAll==="function"?taskAll():[])add("Задача",x.title,`${x.area} ${x.note||""}`,"today","focus","task",x.id);
    for(const x of typeof projectAll==="function"?projectAll():[])add("Проект",x.title,`${x.area||""} ${x.outcome||""}`,"more","overview","project",x.id);
    for(const x of typeof goalAll==="function"?goalAll():[])add("Цель",x.title,x.outcome||"","more","overview","goal",x.id);
    for(const x of typeof calendarEvents==="function"?calendarEvents():[])add("Календарь",x.title,`${x.dateKey||""} ${x.type||x.kind||""}`,"more","overview","calendar",x.id);
    for(const x of typeof routineAll==="function"?routineAll():[])add("Рутина",x.title,x.area||"","today","focus","routine",x.id);
    for(const x of typeof inboxOpen==="function"?inboxOpen():[])add("Inbox",x.text,x.area||"","today","focus","inbox",x.id);
    for(const x of typeof focusTimeboxes==="function"?focusTimeboxes():[])add("Фокус",x.title,`${x.dateKey} ${x.minutes} мин`,"today","focus");
    for(const x of typeof knowledgeGrowthNotes==="function"?knowledgeGrowthNotes():[])add("Знание",x.text,(x.tags||[]).join(" "),"more","knowledge","knowledge",x.id);
    for(const x of S.books||[])add("Книга",x.title,`${x.author||""} ${x.notes||""}`,"more","knowledge","book",x.id);
    for(const x of S.crmDeals||[])add("CRM",x.name||"Сделка",`${x.client||""} ${x.city||""} ${x.nextStep||""}`,"work","crm","crm",x.id);
    for(const x of typeof homeChores==="function"?homeChores():[])add("Дом",x.title,"повторяющееся дело","more","overview");
    for(const x of typeof homeInventory==="function"?homeInventory():[])add("Запас",x.name,`${x.qty} ${x.unit||""}`,"more","overview");
    for(const x of typeof homeShopping==="function"?homeShopping():[])add("Покупка",x.name,"список покупок","more","overview");
    for(const x of typeof growthTrackers==="function"?growthTrackers():[])add("Трекер",x.name,`${x.area||""} ${x.unit||""}`,"today","focus");
    for(const x of S.tennis||[])add("Теннис",x.type||"Сессия",`${x.dateKey||""} ${x.note||""}`,"tennis","training","tennis",x.id);
    return out.slice(0,50)
  };dashboardSearchRows.__nav1412=true
}
function lifeNavigateSearchResult(x){if(x?.entityType)return lifeNavigateEntity(x.entityType,x.entityId||"",{section:x.section,view:x.view});return lifeNavigate({section:x?.section||"more",view:x?.view||"overview"})}

function nav1412InstallOverrides(){
  if(NAV1412_INSTALLED)return;NAV1412_INSTALLED=true;nav1412PatchSearchRows();
  NAV1412_BASE.ux7Go=ux7Go;ux7Go=function(sectionId,view){return lifeNavigate({section:sectionId,view,behavior:"auto",verify:false})};
  if(typeof ui139MoreNavigate==="function")ui139MoreNavigate=function(view,target=""){return lifeNavigate({section:"more",view,target})};
  if(typeof productCore141OpenCapture==="function")productCore141OpenCapture=function(){if(typeof productUsage141Track==="function")productUsage141Track("today:capture");return lifeNavigate({section:"today",view:"focus",target:"#capture2Command",focus:"#inboxCaptureInput"})};
  if(typeof productCore141OpenTask==="function")productCore141OpenTask=function(){if(typeof productUsage141Track==="function")productUsage141Track("today:new-task");if(typeof productCore141SetExpanded==="function")productCore141SetExpanded(true,false);const c=document.getElementById("taskEditorCard");if(c)c.hidden=false;return lifeNavigate({section:"today",view:"focus",target:"#taskEditorCard",focus:"#taskTitle"})};
  if(typeof productCore1411OpenSetup==="function")productCore1411OpenSetup=function(id,done=false){if(typeof productUsage141Track==="function")productUsage141Track("more:setup");if(id==="cash")return lifeNavigate({section:"finance",view:done?"overview":"operations",target:done?"":"#bankSyncCard"});if(id==="income")return lifeNavigate({section:done?"finance":"more",view:done?"overview":"settings",target:done?"":"#incomeScheduleEditor"});if(id==="obligations")return lifeNavigate({section:"finance",view:done?"debts":"operations",target:done?"":"#regularPaymentList"});if(id==="work")return lifeNavigate({section:done?"work":"more",view:done?"overview":"settings",target:done?"":"#settingWorkPlan"});if(id==="execution")return lifeNavigate({section:"today",view:"focus",target:"#tasksOsCommand"})};

  if(typeof commandRoute==="function")commandRoute=function(type,id){if(typeof closeCommandPalette==="function")closeCommandPalette();if(["task","routine","project","goal","crm","book","calendar"].includes(type))return lifeNavigateEntity(type,id);if(type==="calibration")return lifeNavigate({section:"more",view:"settings",target:"#calibrationOsCommand"});if(type==="review")return lifeNavigate({section:"more",view:"overview",target:"#reviewOsCommand"})};
  if(typeof dashboardOpen==="function")dashboardOpen=function(section,view){return lifeNavigate({section,view})};
  if(typeof ux128Search==="function")ux128Search=function(){const input=document.getElementById("ux128SearchInput"),box=document.getElementById("ux128SearchResults");if(!box)return;const q=String(input?.value||"").trim(),rows=typeof dashboardSearchRows==="function"?dashboardSearchRows(q):[];box.innerHTML=!q?'<div class="empty">Начни вводить задачу, сделку, человека, книгу или заметку.</div>':rows.length?rows.map((x,i)=>`<button type="button" class="ux128-search-row" data-index="${i}"><span><span class="tag">${escapeHtml(x.kind)}</span><b>${escapeHtml(x.title)}</b>${x.meta?`<small>${escapeHtml(x.meta)}</small>`:""}</span><span aria-hidden="true">→</span></button>`).join(""):'<div class="empty">Ничего не найдено.</div>';box.querySelectorAll(".ux128-search-row").forEach((b,i)=>b.addEventListener("click",()=>{const x=rows[i];closeModal("ux128SearchSheet");lifeNavigateSearchResult(x)}))};
  if(typeof ux128AuditRoute==="function")ux128AuditRoute=function(entity){const s=String(entity||"").toLowerCase();if(/project|goal/.test(s))return["more","overview"];if(/task|routine|system/.test(s))return["today","focus"];if(/work|crm|career/.test(s))return["work","overview"];if(/sport|tennis/.test(s))return["tennis","overview"];if(/knowledge|reading|book/.test(s))return["more","knowledge"];if(/finance|debt|account|asset|payment/.test(s))return["finance","overview"];return["more","overview"]};
  if(typeof ux128RenderRecent==="function")ux128RenderRecent=function(){const box=document.getElementById("ux128RecentList");if(!box)return;const rows=ux128RecentRows();box.innerHTML=rows.length?rows.map((x,i)=>`<div class="log-item ux128-recent-row"><div><div class="qtitle">${escapeHtml(x.title)}</div><div class="qmeta">${new Date(x.at).toLocaleString("ru-RU")}${x.meta?` • ${escapeHtml(x.meta)}`:""}</div></div><button class="btn ghost small" data-index="${i}">К разделу</button></div>`).join(""):'<div class="empty">Недавних действий пока нет.</div>';box.querySelectorAll("button[data-index]").forEach((b,i)=>b.addEventListener("click",()=>{const x=rows[i];closeModal("ux128RecentSheet");const text=String(x.meta||"").toLowerCase(),target=/project/.test(text)?"#projectsOsCommand":/goal/.test(text)?"#goalsOsCommand":/task/.test(text)?"#tasksOsCommand":/routine/.test(text)?"#routinesOsCommand":"";lifeNavigate({section:x.section,view:x.view,target})}))};

  if(typeof calendarOpenEvent==="function")calendarOpenEvent=function(id){const e=calendarFindEvent(id);if(!e)return;if(e.source==="task")return lifeNavigateEntity("task",e.refId);if(e.source==="routine")return lifeNavigateEntity("routine",e.refId);if(e.source==="project")return lifeNavigateEntity("project",e.refId);if(e.source==="goal")return lifeNavigateEntity("goal",e.refId);if(e.source==="crm")return lifeNavigateEntity("crm",e.refId);if(e.source==="finance")return lifeNavigate({section:"finance",view:e.kind==="payment"?"debts":"analysis"});if(e.source==="review")return lifeNavigate({section:"more",view:"overview",target:"#reviewOsCommand"});if(e.manual&&e.area==="Теннис")return lifeNavigate({section:"tennis",view:"training"});if(e.manual&&e.area==="Работа")return lifeNavigate({section:"work",view:"log"});return lifeNavigate({section:"more",view:"overview",target:"#calendarOsCommand"})};

  if(typeof lifeOsOpen==="function")lifeOsOpen=function(area,route="",ctx={}){if(lifeOsTryRouteHandler(area,route))return;if(route==="projects")return lifeNavigateEntity("project",ctx.projectId||"");if(route==="goals")return lifeNavigateEntity("goal",ctx.goalId||"");if(route==="tasks")return lifeNavigateEntity("task",ctx.taskId||"");if(route==="routines")return lifeNavigateEntity("routine",ctx.routineId||"");if(route==="inbox")return lifeNavigate({section:"today",view:"focus",target:"#inboxOsCommand"});if(route==="reviews")return lifeNavigate({section:"more",view:"overview",target:"#reviewOsCommand"});if(route==="rules")return lifeNavigate({section:"more",view:"overview",target:"#rulesOsCommand"});if(route==="insights")return lifeNavigate({section:"more",view:"overview",target:"#insightsOsCommand"});if(route==="calendar")return lifeNavigate({section:"more",view:"overview",target:"#calendarOsCommand"});if(route==="execution")return lifeNavigate({section:"today",view:"focus",target:"#executionOsCommand"});if(area==="Финансы")return lifeNavigate({section:"finance",view:/debt|payment|minimum/i.test(String(ctx.kind||ctx.id||""))?"debts":"overview"});if(area==="Работа")return ctx.dealId?lifeNavigateEntity("crm",ctx.dealId):lifeNavigate({section:"work",view:"crm"});if(area==="Теннис")return lifeNavigate({section:"tennis",view:"analytics"});if(area==="Знания")return lifeNavigate({section:"more",view:"knowledge"});return lifeNavigate({section:"more",view:"settings"})};
  if(typeof decisionExecuteToken==="function")decisionExecuteToken=async function(token){const x=decisionByToken(token);if(!x)return;if(typeof calibrationRecordDecisionAction==="function")calibrationRecordDecisionAction("execute",x.id,{source:decisionSource(x),kind:x.kind||""});if(x.taskId&&typeof completeTask==="function"){await completeTask(x.taskId);return}if(x.routineId&&typeof completeRoutine==="function"){await completeRoutine(x.routineId);return}return lifeOsOpen(x.area,x.route,x)};
  if(typeof todayFlowJump==="function")todayFlowJump=function(id){const map={inboxOsCommand:["today","focus"],tasksOsCommand:["today","focus"],routinesOsCommand:["today","focus"],executionOsCommand:["today","focus"]},m=map[id]||[document.querySelector(".section.active")?.id||"today",""];return lifeNavigate({section:m[0],view:m[1],target:`#${id}`})};

  if(typeof import127Route==="function")import127Route=function(){const p=IMPORT127_PREVIEW;if(!p)return;if(p.kind==="image-route"){lifeNavigate({section:"finance",view:"operations",target:".financial-command-card"});if(typeof recognizeSmartInbox==="function")Promise.resolve(recognizeSmartInbox([p.file])).catch(e=>toast("OCR: "+String(e?.message||e)));return}if(p.kind==="finance-route")return lifeNavigate({section:"finance",view:"operations",target:"#bankSyncCard"});if(p.kind==="ai-package"){return handleAiImportFile(p.file).then(()=>lifeNavigate({section:"finance",view:"operations",target:"#aiImportPreview"}))}};

  if(typeof editWork==="function"&&!editWork.__nav1412){const base=editWork;editWork=function(id){lifeNavigate({section:"work",view:"log",target:"#workDate",behavior:"auto",verify:false});const card=document.getElementById("workDate")?.closest(".card");if(card&&typeof ux7ToggleEditor==="function")ux7ToggleEditor(card,true);const r=base(id);lifeNavigate({section:"work",view:"log",target:"#workDate",focus:"#workDate"});return r};editWork.__nav1412=true}
  if(typeof editTennis==="function"&&!editTennis.__nav1412){const base=editTennis;editTennis=function(id){lifeNavigate({section:"tennis",view:"training",target:"#ttDate",behavior:"auto",verify:false});const card=document.getElementById("ttDate")?.closest(".card");if(card&&typeof ux7ToggleEditor==="function")ux7ToggleEditor(card,true);const r=base(id);lifeNavigate({section:"tennis",view:"training",target:"#ttDate",focus:"#ttDate"});return r};editTennis.__nav1412=true}

  if(typeof lifeOsRegisterRouteHandler==="function"){
    lifeOsRegisterRouteHandler("training129",()=>lifeNavigate({section:"more",view:"overview",target:"#training129Command"}));
    lifeOsRegisterRouteHandler("intelligence132",()=>lifeNavigate({section:"today",view:"focus",target:"#intelligence132Command"}));
    lifeOsRegisterRouteHandler("predictive1322",()=>lifeNavigate({section:"today",view:"focus",target:"#predictive1322Command"}));
  }
}

function ensureNavigationHotfix1412Ui(){nav1412InstallOverrides()}
function renderNavigationHotfix1412(){/* navigation only; no render mutation */}
