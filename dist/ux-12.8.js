"use strict";

/* Life RPG 12.8 — Mobile UX & Interface Consolidation.
   Shell-only enhancement: navigation memory, global search, Recent, quick actions,
   duplicate cleanup, compact overview and mobile-safe sticky actions. No state migration. */

const UX128_NAV_KEY="life-rpg-ux128-nav";
let UX128_NAV=null,UX128_RESTORING=false,UX128_NAV_HOOKED=false,UX128_CLARITY_HOOKED=false,UX128_RESTORED=false;

function ux128EnsureCss(){
  if(document.getElementById("ux128Css"))return;
  const link=document.createElement("link");link.id="ux128Css";link.rel="stylesheet";link.href=`./ux-12.8.css?v=${APP_VERSION}`;document.head.appendChild(link)
}
ux128EnsureCss();

function ux128LoadNav(){
  if(UX128_NAV)return UX128_NAV;
  try{UX128_NAV=JSON.parse(localStorage.getItem(UX128_NAV_KEY)||"{}")||{}}catch{UX128_NAV={}}
  if(!UX128_NAV.views||typeof UX128_NAV.views!=="object")UX128_NAV.views={};
  if(!UX128_NAV.scroll||typeof UX128_NAV.scroll!=="object")UX128_NAV.scroll={};
  return UX128_NAV
}
function ux128SaveNav(){
  try{localStorage.setItem(UX128_NAV_KEY,JSON.stringify(ux128LoadNav()))}catch{}
}
function ux128ActiveSection(){return document.querySelector(".section.active")?.id||"today"}
function ux128ActiveView(section=ux128ActiveSection()){return UX7_PREFS?.[section]||UX7_DEFAULTS?.[section]||"overview"}
function ux128ScrollKey(section=ux128ActiveSection(),view=ux128ActiveView(section)){return `${section}:${view}`}
function ux128RememberPosition(){
  if(UX128_RESTORING)return;const n=ux128LoadNav(),section=ux128ActiveSection(),view=ux128ActiveView(section);
  n.section=section;n.views[section]=view;n.scroll[ux128ScrollKey(section,view)]=Math.max(0,Math.round(window.scrollY||0));ux128SaveNav()
}
function ux128InstallNavigationMemory(){
  if(UX128_NAV_HOOKED)return;UX128_NAV_HOOKED=true;
  if(typeof ux7RegisterNavigationListener==="function")ux7RegisterNavigationListener("ux128-navigation",event=>{
    if(UX128_RESTORING)return;
    if(event?.type==="section:before"||event?.type==="view:before")ux128RememberPosition();
    const n=ux128LoadNav();
    if(event?.type==="section:after"){n.section=event.section;n.views[event.section]=UX7_PREFS?.[event.section]||UX7_DEFAULTS?.[event.section]||"overview";ux128SaveNav()}
    if(event?.type==="view:after"){n.section=event.section;n.views[event.section]=event.view;ux128SaveNav()}
  });
  window.addEventListener("pagehide",ux128RememberPosition);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")ux128RememberPosition()})
}
function ux128RestoreNavigation(){
  if(UX128_RESTORED)return;UX128_RESTORED=true;const n=ux128LoadNav(),validSections=Object.keys(UX7_META||{}),section=validSections.includes(n.section)?n.section:"";
  if(!section)return;const validViews=(UX7_META[section]?.tabs||[]).map(x=>x[0]),view=validViews.includes(n.views?.[section])?n.views[section]:(UX7_PREFS[section]||UX7_DEFAULTS[section]);
  UX128_RESTORING=true;switchTab(section);ux7SetView(section,view,false);
  const y=Math.max(0,+n.scroll?.[ux128ScrollKey(section,view)]||0);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{window.scrollTo({top:y,behavior:"auto"});UX128_RESTORING=false}))
}

function ux128OpenSearch(){
  const m=document.getElementById("ux128SearchSheet");if(!m)return;openModal("ux128SearchSheet");const q=document.getElementById("ux128SearchInput");if(q){q.value="";ux128Search();setTimeout(()=>q.focus(),20)}
}
function ux128Search(){
  const input=document.getElementById("ux128SearchInput"),box=document.getElementById("ux128SearchResults");if(!box)return;const q=String(input?.value||"").trim(),rows=typeof dashboardSearchRows==="function"?dashboardSearchRows(q):[];
  box.innerHTML=!q?'<div class="empty">Начни вводить задачу, сделку, человека, книгу или заметку.</div>':rows.length?rows.map((x,i)=>`<button type="button" class="ux128-search-row" data-index="${i}"><span><span class="tag">${escapeHtml(x.kind)}</span><b>${escapeHtml(x.title)}</b>${x.meta?`<small>${escapeHtml(x.meta)}</small>`:""}</span><span aria-hidden="true">→</span></button>`).join(""):'<div class="empty">Ничего не найдено.</div>';
  box.querySelectorAll(".ux128-search-row").forEach((b,i)=>b.addEventListener("click",()=>{const x=rows[i];closeModal("ux128SearchSheet");ux7Go(x.section,x.view)}))
}
function ux128EnsureSearch(){
  if(!document.getElementById("ux128SearchBtn")){
    const actions=document.querySelector(".top-actions"),b=document.createElement("button");if(actions){b.id="ux128SearchBtn";b.className="iconbtn ux128-search-btn";b.type="button";b.title="Глобальный поиск";b.setAttribute("aria-label","Глобальный поиск");b.innerHTML='<i data-lucide="search"></i>';b.addEventListener("click",ux128OpenSearch);actions.insertBefore(b,actions.firstChild);window.LifePlatform?.refreshIcons?.(b)}
  }
  if(document.getElementById("ux128SearchSheet"))return;
  const m=document.createElement("div");m.className="modal ux7-sheet";m.id="ux128SearchSheet";m.innerHTML=`<div class="modal-card ux128-search-sheet"><div class="modal-head"><div><div class="eyebrow">Глобальный поиск</div><div class="title">Найти в Life RPG</div></div><button class="close" aria-label="Закрыть" onclick="closeModal('ux128SearchSheet')">×</button></div><div class="field"><input id="ux128SearchInput" type="search" autocomplete="off" placeholder="задача, сделка, человек, книга..." aria-label="Поиск" oninput="ux128Search()"></div><div id="ux128SearchResults" class="ux128-search-results" style="margin-top:10px"></div></div>`;
  document.body.appendChild(m);m.addEventListener("click",e=>{if(e.target===m)closeModal("ux128SearchSheet")})
}

function ux128AuditRoute(entity){
  const s=String(entity||"").toLowerCase();
  if(/work|crm|career/.test(s))return["work","overview"];
  if(/sport|tennis/.test(s))return["tennis","overview"];
  if(/knowledge|reading|book/.test(s))return["more","knowledge"];
  if(/finance|debt|account|asset|payment/.test(s))return["finance","overview"];
  if(/system|task|project|goal|routine/.test(s))return["today","focus"];
  return["more","overview"]
}
function ux128RecentRows(limit=30){
  return (S.auditLog||[]).slice(0,limit).map(x=>{const [section,view]=ux128AuditRoute(x.entity);return {id:x.id||"",at:x.date||"",title:x.action||"Изменение",meta:[x.entity,x.detail].filter(Boolean).join(" • "),section,view}}).filter(x=>x.at)
}
function ux128RenderRecent(){
  const box=document.getElementById("ux128RecentList");if(!box)return;const rows=ux128RecentRows();
  box.innerHTML=rows.length?rows.map((x,i)=>`<div class="log-item ux128-recent-row"><div><div class="qtitle">${escapeHtml(x.title)}</div><div class="qmeta">${new Date(x.at).toLocaleString("ru-RU")}${x.meta?` • ${escapeHtml(x.meta)}`:""}</div></div><button class="btn ghost small" data-index="${i}">Открыть</button></div>`).join(""):'<div class="empty">Недавних действий пока нет.</div>';
  box.querySelectorAll("button[data-index]").forEach((b,i)=>b.addEventListener("click",()=>{const x=rows[i];closeModal("ux128RecentSheet");ux7Go(x.section,x.view)}))
}
function ux128OpenRecent(){ux128RenderRecent();openModal("ux128RecentSheet")}
function ux128EnsureRecent(){
  if(document.getElementById("ux128RecentSheet"))return;const m=document.createElement("div");m.className="modal ux7-sheet";m.id="ux128RecentSheet";m.innerHTML=`<div class="modal-card ux128-recent-sheet"><div class="modal-head"><div><div class="eyebrow">Недавнее</div><div class="title">Последние изменения</div></div><button class="close" aria-label="Закрыть" onclick="closeModal('ux128RecentSheet')">×</button></div><div id="ux128RecentList" class="ux128-recent-list"></div><button class="btn ghost" style="margin-top:10px" onclick="closeModal('ux128RecentSheet');ux7Go('more','settings');setTimeout(()=>document.getElementById('auditLog')?.scrollIntoView({behavior:'smooth',block:'start'}),120)">Полный журнал</button></div>`;document.body.appendChild(m);m.addEventListener("click",e=>{if(e.target===m)closeModal("ux128RecentSheet")})
}

function ux128OpenTask(){
  ux7Go("today","focus");setTimeout(()=>{const card=document.getElementById("taskEditorCard");if(card)card.hidden=false;document.getElementById("taskTitle")?.focus()},120)
}
function ux128OpenCapture(){ux7Go("today","focus");setTimeout(()=>document.getElementById("inboxCaptureInput")?.focus(),120)}
function ux128OpenImport(){ux7Go("more","settings");setTimeout(()=>document.getElementById("import127Command")?.closest(".card")?.scrollIntoView({behavior:"smooth",block:"start"}),140)}
function ux128QuickButton(action,label,icon,fn){
  const b=document.createElement("button");b.type="button";b.dataset.ux128Action=action;b.innerHTML=`${ui82Icon(icon)}<span>${label}</span>`;b.addEventListener("click",()=>{closeModal("ux7QuickSheet");fn()});return b
}
function ux128PatchQuickSheet(){
  const grid=document.querySelector("#ux7QuickSheet .ux7-action-grid");if(!grid||grid.querySelector("[data-ux128-action]"))return;
  grid.append(
    ux128QuickButton("task","Задача","work",ux128OpenTask),
    ux128QuickButton("inbox","В Inbox","plus",ux128OpenCapture),
    ux128QuickButton("recent","Недавнее","activity",ux128OpenRecent),
    ux128QuickButton("search","Поиск","spend",ux128OpenSearch),
    ux128QuickButton("import","Импорт","bank",ux128OpenImport)
  );window.LifePlatform?.refreshIcons?.(grid)
}

function ux128Consolidate(){
  const hero=document.querySelector("#more .book-hero");if(hero)hero.hidden=true;
  const oldWeekly=document.getElementById("weeklyReview")?.closest(".card"),review=document.getElementById("reviewOsCommand");if(oldWeekly&&review)oldWeekly.hidden=true;
  const legacyPersonal=document.getElementById("personalImportCommand")?.closest(".card"),hub=document.getElementById("import127Command");if(legacyPersonal&&hub)legacyPersonal.hidden=true;
  const calibration=document.getElementById("calibrationOsCommand")?.closest(".card");if(calibration){calibration.dataset.ux7View="settings";const view=UX7_PREFS?.more||"overview";calibration.classList.toggle("ux7-hidden",view!=="settings");calibration.classList.add("ux7-view-ready")}
}
function ux128InstallClarity(){
  if(UX128_CLARITY_HOOKED)return;UX128_CLARITY_HOOKED=true;if(typeof ux7RegisterClarityProvider!=="function")return;
  ux7RegisterClarityProvider("ux128-clarity",(sectionId,card,t=ux7CardText(card))=>{
    if(sectionId==="finance")return /состояние финансов|кампания против долгов/.test(t);
    if(sectionId==="work")return /воронка действий|карьерные квесты|активность месяца/.test(t);
    if(sectionId==="tennis")return /навыки игрока|теннисный отчет месяца/.test(t);
    if(sectionId==="more")return /итог текущего месяца|personal analytics|книги, навыки, ачивки и настройки/.test(t);
    return false
  })
}
function ux128MarkStickyActions(){
  const selectors=["#workSaveBtn","#ttSaveBtn","#import127Apply","#aiApplyBtn",'#taskEditorCard button[onclick*="saveTaskForm"]','#crmEditorCard button[onclick*="saveCrmDeal"]'];
  for(const sel of selectors){const b=document.querySelector(sel),row=b?.closest(".split");if(row)row.classList.add("ux128-sticky-actions")}
}
function ux128EnhanceA11y(){
  document.querySelectorAll("input,select,textarea").forEach(el=>{if(!el.getAttribute("aria-label")&&!el.id&&!el.closest(".field")?.querySelector("label"))el.setAttribute("aria-label","Поле ввода")});
  document.querySelectorAll(".ux7-tabs").forEach(el=>el.setAttribute("aria-orientation","horizontal"))
}
function ensureUx128Ui(){
  ux128EnsureCss();ux128InstallNavigationMemory();ux128EnsureSearch();ux128EnsureRecent();ux128PatchQuickSheet();ux128InstallClarity();ux128Consolidate();ux128MarkStickyActions();ux128EnhanceA11y();
  if(!UX128_RESTORED)requestAnimationFrame(ux128RestoreNavigation)
}
function renderUx128(){
  ux128Consolidate();ux128MarkStickyActions();ux128PatchQuickSheet();
  for(const section of UX7_CLARITY_SECTIONS||[])ux7ApplyClarity(section,UX7_PREFS[section])
}
