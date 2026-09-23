"use strict";

/* Personal Dashboard 12.0 — widget layout + cross-domain search/navigation. */
function dashboardPrefs(){return personalWidgetPrefs()}
function dashboardWidgetIds(section){return Object.values(PERSONAL_WIDGETS).filter(x=>!section||x.section===section).map(x=>x.id)}
function dashboardOrderedIds(section){const all=dashboardWidgetIds(section),order=dashboardPrefs().order.filter(x=>all.includes(x));for(const id of all)if(!order.includes(id))order.push(id);return order}
function dashboardApply(){const p=dashboardPrefs(),hidden=new Set(p.hidden||[]);for(const meta of Object.values(PERSONAL_WIDGETS)){const el=document.querySelector(`[data-personal-widget="${meta.id}"]`);if(el)el.style.display=hidden.has(meta.id)?"none":""}for(const section of ["today","more"]){const grid=document.querySelector(`#${section} .grid`);if(!grid)continue;const ids=dashboardOrderedIds(section),nodes=ids.map(id=>document.querySelector(`[data-personal-widget="${id}"]`)).filter(Boolean);for(const n of nodes)grid.appendChild(n)}}
async function dashboardToggle(id){const p=dashboardPrefs(),set=new Set(p.hidden||[]);set.has(id)?set.delete(id):set.add(id);p.hidden=[...set];await save("Виджет обновлён")}
async function dashboardMove(id,dir){const p=dashboardPrefs(),meta=PERSONAL_WIDGETS[id];if(!meta)return;const ids=dashboardOrderedIds(meta.section),i=ids.indexOf(id),j=i+dir;if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];const other=p.order.filter(x=>!ids.includes(x));p.order=[...other,...ids];await save("Порядок виджетов обновлён")}
function dashboardSearchRows(q){
  q=String(q||"").toLowerCase().trim();if(!q)return[];const out=[],add=(kind,title,meta="",section="more",view="overview")=>{const hay=(title+" "+meta).toLowerCase();if(hay.includes(q))out.push({kind,title,meta,section,view})};
  for(const x of journalEntries())add("Дневник",x.text||x.happened||x.learned,[x.learned,x.change].filter(Boolean).join(" • "),"more","overview");
  for(const x of journalDecisions())add("Решение",x.title,x.rationale||x.result,"more","overview");
  for(const p of peopleAll())add("Человек",p.name,`${p.relation} ${p.note||""}`,"more","overview");
  for(const x of peopleInteractions())add("Контакт",peopleFind(x.personId)?.name||"Контакт",x.note||"","more","overview");
  for(const x of typeof taskAll==="function"?taskAll():[])add("Задача",x.title,`${x.area} ${x.note||""}`,"today","focus");
  for(const x of typeof projectAll==="function"?projectAll():[])add("Проект",x.title,`${x.area||""} ${x.outcome||""}`,"more","overview");
  for(const x of typeof goalAll==="function"?goalAll():[])add("Цель",x.title,x.outcome||"","more","overview");
  for(const x of typeof calendarEvents==="function"?calendarEvents():[])add("Календарь",x.title,`${x.dateKey||""} ${x.type||""}`,"more","overview");
  for(const x of typeof routineAll==="function"?routineAll():[])add("Рутина",x.title,x.area||"","today","focus");
  for(const x of typeof inboxOpen==="function"?inboxOpen():[])add("Inbox",x.text,x.area||"","today","focus");
  for(const x of focusTimeboxes())add("Фокус",x.title,`${x.dateKey} ${x.minutes} мин`,"today","focus");
  for(const x of typeof knowledgeGrowthNotes==="function"?knowledgeGrowthNotes():[])add("Знание",x.text,(x.tags||[]).join(" "),"more","knowledge");
  for(const x of S.books||[])add("Книга",x.title,`${x.author||""} ${x.notes||""}`,"more","knowledge");
  for(const x of homeChores())add("Дом",x.title,"повторяющееся дело","more","overview");
  for(const x of homeInventory())add("Запас",x.name,`${x.qty} ${x.unit||""}`,"more","overview");
  for(const x of homeShopping())add("Покупка",x.name,"список покупок","more","overview");
  for(const x of typeof growthTrackers==="function"?growthTrackers():[])add("Трекер",x.name,`${x.area||""} ${x.unit||""}`,"today","focus");
  for(const x of S.tennis||[])add("Теннис",x.type||"Сессия",`${x.dateKey||""} ${x.note||""}`,"tennis","overview");
  return out.slice(0,50)
}
function dashboardOpen(section,view){switchTab(section);requestAnimationFrame(()=>ux7SetView(section,view,false))}
function dashboardSearch(){const box=document.getElementById("dashboardSearchResults"),q=document.getElementById("dashboardSearchInput")?.value||"";if(!box)return;const rows=dashboardSearchRows(q);box.innerHTML=rows.length?rows.map(x=>`<div class="log-item"><div class="split"><div><span class="tag">${escapeHtml(x.kind)}</span><div class="qtitle" style="margin-top:5px">${escapeHtml(x.title)}</div>${x.meta?`<div class="qmeta">${escapeHtml(x.meta)}</div>`:""}</div><button class="btn ghost small" onclick="dashboardOpen('${x.section}','${x.view}')">Открыть</button></div></div>`).join(""):(q?'<div class="empty">Ничего не найдено.</div>':'')}
function ensureDashboardOsUi(){if(document.getElementById("dashboardOsCommand"))return;const grid=document.querySelector("#more .grid");if(!grid)return;grid.insertAdjacentHTML("beforeend",`<div data-ux7-view="settings" class="card ux7-card span-12"><div><div class="eyebrow">Personal Dashboard</div><div class="section-title">Что видеть и в каком порядке</div></div><div class="field" style="margin-top:10px"><label>Глобальный поиск</label><input id="dashboardSearchInput" placeholder="задача, человек, фокус, покупка, книга..." oninput="dashboardSearch()"></div><div id="dashboardSearchResults" style="margin-top:8px"></div><div class="title" style="margin-top:14px">Виджеты Personal OS</div><div id="dashboardOsCommand" style="margin-top:8px"></div></div>`)}
function renderDashboardOs(){const box=document.getElementById("dashboardOsCommand");if(!box)return;const p=dashboardPrefs(),hidden=new Set(p.hidden||[]);box.innerHTML=Object.values(PERSONAL_WIDGETS).map(x=>`<div class="quest"><span class="tag">${x.section==="today"?"Сегодня":"Ещё"}</span><div class="qbody"><div class="qtitle">${escapeHtml(x.title)}</div></div><div class="split"><button class="btn ghost small" onclick="dashboardMove('${x.id}',-1)">↑</button><button class="btn ghost small" onclick="dashboardMove('${x.id}',1)">↓</button><button class="btn ${hidden.has(x.id)?"secondary":"ghost"} small" onclick="dashboardToggle('${x.id}')">${hidden.has(x.id)?"Показать":"Скрыть"}</button></div></div>`).join("");dashboardApply()}
