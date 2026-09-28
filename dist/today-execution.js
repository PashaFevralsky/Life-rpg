"use strict";

/* Life RPG 12.3 — Today / Execution Decision Layer
   Builds one realistic daily action queue from existing Calendar, Execution and Life OS data.
   No state migration. No invented clock times: the current calendar stores dates and durations only. */

function today123Norm(v){return String(v||"").toLocaleLowerCase("ru-RU").replace(/[^a-zа-яё0-9]+/g," ").trim()}
function today123SetHtml(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html}
function today123Today(){return localDateKey()}

function today123ReservedEvents(){
  const today=today123Today(),rows=typeof calendarEvents==="function"?calendarEvents(1,0):[];
  return rows.filter(x=>x&&x.dateKey===today&&x.source!=="task"&&x.status!=="cancelled"&&(Math.max(0,+x.minutes||0)>0||x.hard)).sort((a,b)=>(b.hard?1:0)-(a.hard?1:0)||(+a.priority||2)-(+b.priority||2)||String(a.title||"").localeCompare(String(b.title||""),"ru"))
}

function today123ExecutionSnapshot(){
  const today=today123Today(),plan=typeof executionPlan==="function"?executionPlan():null;
  const load=plan?.load?.find(x=>x.dateKey===today)||null;
  const baseMap=typeof executionBaseLoads==="function"?executionBaseLoads(plan?.days||7):null;
  const reservedMinutes=Math.max(0,baseMap?.get?.(today)??today123ReservedEvents().reduce((s,x)=>s+Math.max(0,+x.minutes||0),0));
  const assignments=(plan?.assignments||[]).filter(x=>x.dateKey===today).map(a=>({assignment:a,task:typeof executionTaskById==="function"?executionTaskById(a.taskId):null})).filter(x=>x.task);
  const taskMinutes=assignments.reduce((s,x)=>s+Math.max(0,+x.assignment.minutes||+x.task.minutes||15),0);
  const capacity=Math.max(0,+load?.capacity||+(typeof calendarCapacity==="function"?calendarCapacity():180));
  return {today,plan,load,reservedMinutes,assignments,taskMinutes,capacity,usedBeforeExtras:reservedMinutes+taskMinutes}
}

function today123CandidateCovered(c,reserved,assignments){
  if(!c)return true;
  if(c.taskId&&assignments.some(x=>String(x.task?.id)===String(c.taskId)))return true;
  if(c.routineId&&reserved.some(x=>x.source==="routine"&&String(x.refId||"")===String(c.routineId)))return true;
  if(String(c.id||"").startsWith("calendar:")){
    const id=String(c.id).slice("calendar:".length);if(reserved.some(x=>String(x.id||"")===id))return true
  }
  if(String(c.id||"").startsWith("work:")){
    const id=String(c.id).slice("work:".length);if(reserved.some(x=>x.source==="crm"&&String(x.refId||"")===id))return true
  }
  const title=today123Norm(c.title),area=String(c.area||"");
  if(title.length>=8&&reserved.some(x=>String(x.area||"")===area&&today123Norm(x.title).includes(title)))return true;
  return false
}

function today123CandidateAllowed(c){
  if(!c)return false;
  const kind=String(c.kind||"");
  if(kind.startsWith("execution-"))return false;
  if(kind==="calendar-overload")return false;
  return Math.max(0,+c.minutes||0)>0||c.hard
}

function today123Plan(){
  const ex=today123ExecutionSnapshot(),reservedEvents=today123ReservedEvents(),all=typeof lifeOsCandidates==="function"?lifeOsCandidates():[],limit=typeof intelligence1321SelectPlan==="function"?3:Math.max(2,Math.round(typeof lifeOsSettingNumber==="function"?lifeOsSettingNumber("lifeDailyPriorityLimit",4,2,6):4));
  const covered=all.filter(c=>today123CandidateCovered(c,reservedEvents,ex.assignments));
  const candidates=all.filter(c=>today123CandidateAllowed(c)&&!today123CandidateCovered(c,reservedEvents,ex.assignments));
  const hard=candidates.filter(x=>x.hard).sort((a,b)=>b.score-a.score),soft=candidates.filter(x=>!x.hard&&x.score>=42).sort((a,b)=>b.score-a.score);
  let used=ex.usedBeforeExtras;const extras=[],picked=new Set();
  for(const x of hard){const minutes=Math.max(0,+x.minutes||0);extras.push({...x,fit:used+minutes<=ex.capacity,forced:true});picked.add(x.id);used+=minutes}
  let softCount=0;
  for(const x of soft){
    if(picked.has(x.id)||softCount>=limit)continue;
    const minutes=Math.max(0,+x.minutes||0);
    if(used+minutes<=ex.capacity){extras.push({...x,fit:true,forced:false});picked.add(x.id);used+=minutes;softCount++}
  }
  const deferred=soft.filter(x=>!picked.has(x.id)).map(x=>({...x,reason:used>=ex.capacity?"task-бюджет дня заполнен":softCount>=limit?"достигнут лимит дополнительных приоритетов":"не вошло в верх плана"}));
  const overload=Math.max(0,used-ex.capacity),remaining=Math.max(0,ex.capacity-used),utilization=ex.capacity?used/ex.capacity:0;
  const conflicts={late:ex.plan?.late?.length||0,unscheduled:ex.plan?.unscheduled?.length||0,overloaded:ex.plan?.overloaded?.length||0,blocked:ex.plan?.blocked?.length||0};
  return {...ex,reservedEvents,covered,extras,deferred,used,remaining,overload,utilization,conflicts,limit}
}

function today123OpenCandidate(id){
  const token=typeof decisionToken==="function"?decisionToken(id):encodeURIComponent(String(id||""));
  if(typeof decisionExecuteToken==="function"){decisionExecuteToken(token);return}
  const x=(typeof lifeOsCandidates==="function"?lifeOsCandidates():[]).find(z=>String(z.id)===String(id));if(x&&typeof lifeOsOpen==="function")lifeOsOpen(x.area,x.route)
}

function today123OpenReserved(id){
  const e=(typeof calendarEvents==="function"?calendarEvents(1,0):[]).find(x=>String(x.id)===String(id));if(!e)return;
  if(e.source==="routine"&&e.refId&&typeof completeRoutine==="function"){completeRoutine(e.refId);return}
  if(e.manual&&e.status==="planned"&&typeof setCalendarEventStatus==="function"){setCalendarEventStatus(e.id,"done");return}
  if(typeof calendarOpenEvent==="function")calendarOpenEvent(e.id)
}

function today123OpenTask(id){
  const t=typeof executionTaskById==="function"?executionTaskById(id):null;if(!t)return;
  if(typeof completeTask==="function"){completeTask(t.id);return}
  if(typeof ux7Go==="function")ux7Go("today","focus")
}

function today123Primary(){
  const p=today123Plan();
  const hardExtra=p.extras.find(x=>x.hard),task=p.assignments.find(x=>x.task),reserved=p.reservedEvents.find(x=>x.hard)||p.reservedEvents[0],soft=p.extras.find(x=>!x.hard);
  if(hardExtra)return {kind:"candidate",id:hardExtra.id,title:hardExtra.title,meta:hardExtra.meta,area:hardExtra.area};
  if(task)return {kind:"task",id:task.task.id,title:task.task.title,meta:`Запланировано сегодня • ~${task.assignment.minutes||task.task.minutes||15} мин`,area:task.task.area||"Задача"};
  if(reserved)return {kind:"reserved",id:reserved.id,title:reserved.title,meta:`${reserved.area||"Событие"} • ~${reserved.minutes||0} мин`,area:reserved.area||"Событие"};
  if(soft)return {kind:"candidate",id:soft.id,title:soft.title,meta:soft.meta,area:soft.area};
  return null
}

function today123DoPrimary(){const x=today123Primary();if(!x)return;if(x.kind==="candidate")today123OpenCandidate(x.id);else if(x.kind==="task")today123OpenTask(x.id);else today123OpenReserved(x.id)}

function today123ReservedActionLabel(x){if(x.source==="routine")return"✓";if(x.manual&&x.status==="planned")return"Готово";return"Открыть"}
function today123TaskActionLabel(){return"✓"}
function today123CandidateActionLabel(x){return x.taskId||x.routineId?"✓":"Открыть"}

function ensureTodayExecution123Ui(){
  if(document.getElementById("today123Command"))return;
  const grid=document.querySelector?.("#today .grid"),anchor=document.getElementById("todayFlowCommand")?.closest?.(".card")||document.getElementById("lifeOsCommand")?.closest?.(".card");
  if(!grid||!anchor||typeof anchor.insertAdjacentHTML!=="function")return;
  anchor.insertAdjacentHTML("afterend",`
    <div data-ux7-view="focus" class="card ux7-card span-12">
      <div class="eyebrow">Today / Execution OS 12.3</div><div class="section-title">Исполнимый день</div>
      <div class="muted" style="margin-top:6px">Сводит резерв календаря, автоплан задач и приоритеты Life OS в один task-бюджет. Время начала событий не назначается: приложение не хранит часовую сетку.</div>
      <div id="today123Command" style="margin-top:12px"></div>
    </div>
    <div data-ux7-view="focus" class="card ux7-card span-6"><div class="eyebrow">Reserved</div><div class="title">Уже зарезервировано сегодня</div><div id="today123Reserved"></div></div>
    <div data-ux7-view="focus" class="card ux7-card span-6"><div class="eyebrow">Deferred</div><div class="title">Осознанно отложено</div><div id="today123Deferred"></div></div>
  `)
}

function renderToday123Command(){
  const p=today123Plan(),primary=today123Primary(),conf=p.conflicts,confCount=conf.late+conf.unscheduled+conf.overloaded+conf.blocked;
  const rows=[];
  for(const a of p.assignments){rows.push({kind:"task",id:a.task.id,area:a.task.area||"Задача",title:a.task.title,meta:`Автоплан • ~${a.assignment.minutes||a.task.minutes||15} мин${a.assignment.fixed?" • зафиксировано":""}`,hard:false,minutes:a.assignment.minutes||a.task.minutes||15})}
  for(const x of p.extras)rows.push({kind:"candidate",id:x.id,area:x.area,title:x.title,meta:x.meta,hard:x.hard,minutes:x.minutes||0,fit:x.fit});
  today123SetHtml("today123Command",`<div class="report-grid">
    <div class="report-item"><div class="smallcaps">Task-бюджет</div><b>${p.capacity} мин</b></div>
    <div class="report-item"><div class="smallcaps">Зарезервировано</div><b>${p.reservedMinutes} мин</b></div>
    <div class="report-item"><div class="smallcaps">Задачи автоплана</div><b>${p.taskMinutes} мин</b></div>
    <div class="report-item"><div class="smallcaps">Итоговая загрузка</div><b class="${p.overload?"income-bad":""}">${p.used} мин</b></div>
    <div class="report-item"><div class="smallcaps">Остаток</div><b>${p.remaining} мин</b></div>
    <div class="report-item"><div class="smallcaps">Конфликты недели</div><b class="${confCount?"income-bad":"income-good"}">${confCount}</b></div>
  </div>
  ${primary?`<div class="notice" style="margin-top:12px"><div class="smallcaps">Сейчас</div><div class="qtitle" style="margin-top:4px">${escapeHtml(primary.title)}</div><div class="qmeta">${escapeHtml(primary.meta||"")}</div><button class="btn" style="margin-top:10px" onclick="today123DoPrimary()">${primary.kind==="task"?"Выполнить":"Открыть"}</button></div>`:'<div class="status" style="margin-top:12px">Активных действий на сегодня не найдено.</div>'}
  <div class="title" style="margin-top:14px">Очередь действий</div>
  ${rows.length?rows.map((x,i)=>`<div class="quest"><span class="tag ${x.hard?"bad":""}">#${i+1} • ${escapeHtml(x.area||"Действие")}</span><div class="qbody"><div class="qtitle">${escapeHtml(x.title)}</div><div class="qmeta">${escapeHtml(x.meta||"")}${x.minutes?` • ~${x.minutes} мин`:""}${x.fit===false?" • сверх лимита":""}</div></div><button class="btn ghost small" onclick="${x.kind==="task"?`today123OpenTask('${x.id}')`:`today123OpenCandidate('${x.id}')`}">${x.kind==="task"?today123TaskActionLabel():today123CandidateActionLabel(x)}</button></div>`).join(""):'<div class="empty">Очередь пуста.</div>'}
  ${p.overload?`<div class="notice" style="margin-top:10px"><b>Перегруз ${p.overload} мин.</b> Обязательные действия показаны даже если они не помещаются в task-бюджет.</div>`:""}
  ${confCount?`<div class="status" style="margin-top:10px">Execution: после дедлайна ${conf.late} • не помещается ${conf.unscheduled} • перегруженных дней ${conf.overloaded} • заблокировано ${conf.blocked}.</div>`:""}`)
}

function renderToday123Reserved(){
  const p=today123Plan();
  today123SetHtml("today123Reserved",p.reservedEvents.length?p.reservedEvents.map(x=>`<div class="log-item"><div class="split"><div><div class="qtitle">${escapeHtml(x.title||"Событие")}</div><div class="qmeta">${escapeHtml(x.area||x.type||x.source||"")} • ~${Math.max(0,+x.minutes||0)} мин${x.hard?" • обязательное":""}</div></div><button class="btn ghost small" onclick="today123OpenReserved('${x.id}')">${today123ReservedActionLabel(x)}</button></div></div>`).join(""):'<div class="empty">На сегодня календарный резерв не найден.</div>')
}

function renderToday123Deferred(){
  const p=today123Plan();
  today123SetHtml("today123Deferred",p.deferred.length?p.deferred.slice(0,8).map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.title)}</div><div class="qmeta">${escapeHtml(x.area)} • ${escapeHtml(x.reason)}${x.minutes?` • ~${x.minutes} мин`:""}</div><button class="btn ghost small" style="margin-top:7px" onclick="today123OpenCandidate('${x.id}')">Открыть</button></div>`).join(""):'<div class="empty">Нет приоритетных действий, которые пришлось отложить.</div>')
}

function renderTodayExecution123(){
  if(!document.getElementById("today123Command"))return;
  renderToday123Command();renderToday123Reserved();renderToday123Deferred()
}
