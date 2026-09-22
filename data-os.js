"use strict";

/* Life RPG 11.0.0 — Data Architecture / Entity Integrity */

const DATA_ENTITY_KEYS=["projects","tasks","goals","routines","routineLogs","reviews","inbox","calendarEvents"];
function entityStore(key){if(!S.entities||typeof S.entities!=="object")S.entities={};if(!Array.isArray(S.entities[key]))S.entities[key]=[];return S.entities[key]}
function entityIndex(key){return new Map(entityStore(key).map(x=>[String(x.id||""),x]).filter(([id])=>id))}
function entitySummary(){return Object.fromEntries(DATA_ENTITY_KEYS.map(k=>[k,entityStore(k).length]))}
function entityIntegrityIssues(){
  const out=[],idsByKey={};
  const add=(level,title,detail="")=>out.push({level,title,detail});
  for(const key of DATA_ENTITY_KEYS){
    const seen=new Set();idsByKey[key]=new Set();
    for(const x of entityStore(key)){
      const id=String(x?.id||"");
      if(!id){add("bad",`Сущность без ID: ${key}`);continue}
      if(seen.has(id))add("bad",`Дублирующийся ID: ${key}`,id);seen.add(id);idsByKey[key].add(id)
    }
  }
  const projects=idsByKey.projects,tasks=idsByKey.tasks,routines=idsByKey.routines,crm=new Set((S.crmDeals||[]).map(x=>String(x.id||"")));
  for(const t of entityStore("tasks")){
    if(t.projectId&&!projects.has(String(t.projectId)))add("warn",`Задача ссылается на отсутствующий проект: ${t.title||t.id}`,String(t.projectId));
    if(t.crmDealId&&!crm.has(String(t.crmDealId)))add("warn",`Задача ссылается на отсутствующую CRM-сделку: ${t.title||t.id}`,String(t.crmDealId));
    const deps=Array.isArray(t.blockedByIds)?t.blockedByIds:[];
    if(deps.includes(t.id))add("bad",`Задача зависит сама от себя: ${t.title||t.id}`);
    for(const id of deps)if(!tasks.has(String(id)))add("warn",`Задача имеет отсутствующую зависимость: ${t.title||t.id}`,String(id));
  }
  const taskRows=entityStore("tasks"),taskById=new Map(taskRows.map(x=>[String(x.id),x]));
  const visiting=new Set(),visited=new Set(),cycleReported=new Set();
  function walkTask(id,path=[]){if(visiting.has(id)){const cycle=[...path.slice(path.indexOf(id)),id],key=[...new Set(cycle)].sort().join("|");if(!cycleReported.has(key)){cycleReported.add(key);add("bad","Циклическая зависимость задач",cycle.join(" → "))}return}if(visited.has(id))return;visiting.add(id);const row=taskById.get(id);for(const dep of Array.isArray(row?.blockedByIds)?row.blockedByIds:[])if(taskById.has(String(dep)))walkTask(String(dep),[...path,id]);visiting.delete(id);visited.add(id)}
  for(const id of taskById.keys())walkTask(id,[]);
  for(const g of entityStore("goals"))for(const id of Array.isArray(g.projectIds)?g.projectIds:[])if(!projects.has(String(id)))add("warn",`Цель связана с отсутствующим проектом: ${g.title||g.id}`,String(id));
  for(const l of entityStore("routineLogs"))if(l.routineId&&!routines.has(String(l.routineId)))add("warn","Выполнение относится к отсутствующей рутине",`${l.routineId} • ${l.dateKey||""}`);
  for(const r of entityStore("reviews"))for(const id of Array.isArray(r?.plan?.focusProjectIds)?r.plan.focusProjectIds:[])if(!projects.has(String(id)))add("warn","Review ссылается на отсутствующий проект",String(id));
  return out
}
function repairEntityLinks(){
  const projects=new Set(entityStore("projects").map(x=>String(x.id))),tasks=new Set(entityStore("tasks").map(x=>String(x.id))),routines=new Set(entityStore("routines").map(x=>String(x.id))),crm=new Set((S.crmDeals||[]).map(x=>String(x.id||"")));
  let changed=0;
  for(const t of entityStore("tasks")){
    if(t.projectId&&!projects.has(String(t.projectId))){t.projectId="";changed++}
    if(t.crmDealId&&!crm.has(String(t.crmDealId))){t.crmDealId="";changed++}
    const next=[...new Set((Array.isArray(t.blockedByIds)?t.blockedByIds:[]).map(String))].filter(id=>id!==String(t.id)&&tasks.has(id));if(JSON.stringify(next)!==JSON.stringify(t.blockedByIds||[])){t.blockedByIds=next;changed++}
  }
  for(const g of entityStore("goals")){const next=[...new Set((Array.isArray(g.projectIds)?g.projectIds:[]).map(String))].filter(id=>projects.has(id));if(JSON.stringify(next)!==JSON.stringify(g.projectIds||[])){g.projectIds=next;changed++}}
  const logs=entityStore("routineLogs"),clean=logs.filter(x=>!x.routineId||routines.has(String(x.routineId)));if(clean.length!==logs.length){S.entities.routineLogs=clean;changed+=logs.length-clean.length}
  for(const r of entityStore("reviews")){if(!r.plan)continue;const next=(Array.isArray(r.plan.focusProjectIds)?r.plan.focusProjectIds:[]).map(String).filter(id=>projects.has(id));if(JSON.stringify(next)!==JSON.stringify(r.plan.focusProjectIds||[])){r.plan.focusProjectIds=next;changed++}}
  return changed
}
async function runEntityRepair(){if(!confirm("Исправить безопасные повреждённые ссылки? Перед изменением будет создан снимок. Циклические зависимости останутся для ручной проверки."))return;await createPreActionSnapshot("Перед ремонтом связей v18");const changed=repairEntityLinks();audit("Entity integrity repair","system",`Исправлено связей: ${changed}`);await save(changed?`Исправлено связей: ${changed}`:"Повреждённых связей не найдено")}

const dataOsBaseIntegrity=dataIntegrityIssues;
dataIntegrityIssues=function(){return [...dataOsBaseIntegrity(),...entityIntegrityIssues()]};

function ensureDataOsUi(){
  if(document.getElementById("dataOsCommand"))return;const grid=document.querySelector?.("#more .grid");if(!grid||typeof grid.insertAdjacentHTML!=="function")return;
  grid.insertAdjacentHTML("beforeend",`<div data-ux7-view="settings" class="card ux7-card span-12"><div class="eyebrow">Data Architecture v18</div><div class="section-title">Целостность сущностей</div><div class="muted" style="margin-top:6px">Projects, Tasks, Goals, Routines, Reviews, Inbox и Calendar хранятся в едином entities-слое. Ремонт удаляет только отсутствующие/self-ссылки. Циклы зависимостей показываются отдельно и требуют ручной проверки.</div><div id="dataOsCommand" style="margin-top:10px"></div><div class="split" style="margin-top:10px"><button class="btn secondary" onclick="runEntityRepair()">Исправить безопасные ссылки</button></div></div>`)
}
function renderDataOs(){const box=document.getElementById("dataOsCommand");if(!box)return;const q=entitySummary(),issues=entityIntegrityIssues();box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Проекты</div><b>${q.projects}</b></div><div class="report-item"><div class="smallcaps">Задачи</div><b>${q.tasks}</b></div><div class="report-item"><div class="smallcaps">Цели</div><b>${q.goals}</b></div><div class="report-item"><div class="smallcaps">Рутины</div><b>${q.routines}</b></div><div class="report-item"><div class="smallcaps">Проблемы связей</div><b class="${issues.some(x=>x.level==="bad")?"income-bad":""}">${issues.length}</b></div></div>${issues.length?issues.slice(0,6).map(x=>`<div class="notice" style="margin-top:7px"><b>${escapeHtml(x.title)}</b>${x.detail?`<div class="sub">${escapeHtml(x.detail)}</div>`:""}</div>`).join(""):'<div class="status" style="margin-top:8px">Связи сущностей корректны.</div>'}`}
