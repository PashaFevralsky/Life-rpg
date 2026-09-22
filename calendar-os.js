"use strict";

/* Calendar / Timeline OS — one temporal axis for money, CRM, projects, reviews
   and manually planned events such as training/tournaments.
   Calendar load is an estimate of active commitment time, not a full-day time tracker. */

function calendarStore(){
  if(!Array.isArray(S.settings.calendarEvents))S.settings.calendarEvents=[];
  return S.settings.calendarEvents
}
function calendarCapacity(){return Math.round(lifeOsSettingNumber("calendarDailyCapacityMin",180,30,720))}
function calendarHorizon(){return Math.round(lifeOsSettingNumber("calendarHorizonDays",30,7,90))}
function calendarTypeArea(type){
  if(["Тренировка","Турнир"].includes(type))return"Теннис";
  if(type==="Работа")return"Работа";
  if(type==="Финансы")return"Финансы";
  if(type==="Знания")return"Знания";
  if(type==="Личное")return"Личное";
  return"Система"
}
function calendarTypeMinutes(kind){
  const m={income:0,payment:10,crm:25,"crm-close":15,project:25,"project-deadline":15,review:20};
  return m[kind]??15
}
function calendarSemanticId(parts){return"cal:"+parts.map(x=>String(x??"").replace(/[^a-zа-яё0-9_-]+/gi,"-")).join(":")}
function calendarNormalizeManual(x){
  return {
    id:String(x.id||uid()),seriesId:String(x.seriesId||""),title:String(x.title||"Событие"),type:String(x.type||"Другое"),
    area:String(x.area||calendarTypeArea(x.type)),dateKey:String(x.dateKey||""),minutes:clamp(Math.round(+x.minutes||0),0,720),
    priority:clamp(Math.round(+x.priority||2),1,3),note:String(x.note||""),status:["planned","done","cancelled"].includes(x.status)?x.status:"planned",
    createdAt:String(x.createdAt||new Date().toISOString()),updatedAt:String(x.updatedAt||x.createdAt||new Date().toISOString()),manual:true
  }
}
function calendarManualEvents(){
  const arr=calendarStore();for(let i=0;i<arr.length;i++)arr[i]=calendarNormalizeManual(arr[i]);return arr
}
function addCalendarPlan(input){
  const title=String(input?.title||"").trim(),dateKey=String(input?.dateKey||"");
  if(!title||!validDateKey(dateKey))return[];
  const count=clamp(Math.round(+input.repeatWeeks||1),1,12),seriesId=count>1?uid():"",out=[],base=parseLocal(dateKey);
  for(let i=0;i<count;i++){
    const x=calendarNormalizeManual({
      id:uid(),seriesId,title,type:input.type||"Другое",area:calendarTypeArea(input.type||"Другое"),
      dateKey:localDateKey(addDays(base,i*7)),minutes:+input.minutes||0,priority:+input.priority||2,note:input.note||"",status:"planned",
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    });
    calendarStore().push(x);out.push(x)
  }
  return out
}
function calendarReviewEvents(startKey,endKey){
  const out=[],today=parseLocal(localDateKey()),[wa,wb]=weekBounds();
  let weeklyDate=parseLocal(wb);if(reviewCurrent("week"))weeklyDate=addDays(weeklyDate,7);
  let y=today.getFullYear(),m=today.getMonth(),monthEnd=new Date(y,m+1,0,12);if(reviewCurrent("month"))monthEnd=new Date(y,m+2,0,12);
  const push=(dateKey,title,kind,minutes)=>{
    if(dateKey>=startKey&&dateKey<=endKey)out.push({id:calendarSemanticId(["review",kind,dateKey]),dateKey,source:"review",kind:"review",area:"Система",title,meta:"Review / Planning OS",minutes,hard:false,priority:2,route:"reviews",manual:false})
  };
  push(localDateKey(weeklyDate),"Недельный обзор","week",20);push(localDateKey(monthEnd),"Месячный обзор","month",30);return out
}
function calendarAutoEvents(startKey,endKey){
  const out=[],seen=new Set(),add=e=>{if(!e||!validDateKey(e.dateKey)||e.dateKey<startKey||e.dateKey>endKey)return;const key=e.id||calendarSemanticId([e.source,e.kind,e.dateKey,e.title]);if(seen.has(key))return;seen.add(key);out.push({...e,id:key,manual:false})};
  if(typeof debtEventsBetween==="function"&&typeof regularEventsBetween==="function"&&typeof incomeEventsBetween==="function"){
    const start=parseLocal(startKey),end=parseLocal(endKey),fin=[...(typeof overdueMinimums==="function"?overdueMinimums():[]),...debtEventsBetween(start,end),...regularEventsBetween(start,end),...incomeEventsBetween(start,end)];
    for(const e of fin){
      const dateKey=e.dateKey||localDateKey(e.date),income=e.type==="income",overdue=!!e.overdue;
      add({id:calendarSemanticId(["finance",e.kind||e.type,dateKey,e.debtId||e.regularPaymentId||e.label]),dateKey,source:"finance",kind:income?"income":"payment",area:"Финансы",title:e.label||"Финансовое событие",meta:income?`Ожидается ${rub(e.amount||0)}`:`${overdue?"Просрочено • ":""}${rub(e.amount||0)}`,minutes:calendarTypeMinutes(income?"income":"payment"),hard:overdue,priority:overdue?1:2,amount:+e.amount||0,route:"finance"})
    }
  }else if(typeof financialEvents==="function"){
    for(const e of financialEvents()){
      const dateKey=e.dateKey||localDateKey(e.date),income=e.type==="income",overdue=!!e.overdue;
      add({id:calendarSemanticId(["finance",e.kind||e.type,dateKey,e.debtId||e.regularPaymentId||e.label]),dateKey,source:"finance",kind:income?"income":"payment",area:"Финансы",title:e.label||"Финансовое событие",meta:income?`Ожидается ${rub(e.amount||0)}`:`${overdue?"Просрочено • ":""}${rub(e.amount||0)}`,minutes:calendarTypeMinutes(income?"income":"payment"),hard:overdue,priority:overdue?1:2,amount:+e.amount||0,route:"finance"})
    }
  }
  for(const d of S.crmDeals||[]){
    if(["Выиграно","Проиграно"].includes(d.stage))continue;
    const potential=+d.potential||0;
    if(validDateKey(d.nextDate))add({id:calendarSemanticId(["crm","next",d.id,d.nextDate]),dateKey:d.nextDate,source:"crm",kind:"crm",area:"Работа",title:`CRM: ${d.name||"Сделка"}`,meta:`${d.nextStep||"следующий шаг"} • ${rub(potential)}`,minutes:25,hard:d.nextDate<localDateKey(),priority:d.nextDate<localDateKey()?1:2,refId:d.id,route:"crm"});
    if(validDateKey(d.decisionDate))add({id:calendarSemanticId(["crm","decision",d.id,d.decisionDate]),dateKey:d.decisionDate,source:"crm",kind:"crm-close",area:"Работа",title:`Решение: ${d.name||"Сделка"}`,meta:`${rub(potential)} • вероятность ${d.probability||0}%`,minutes:15,hard:false,priority:2,refId:d.id,route:"crm"});
    if(validDateKey(d.tenderDate))add({id:calendarSemanticId(["crm","tender",d.id,d.tenderDate]),dateKey:d.tenderDate,source:"crm",kind:"crm-close",area:"Работа",title:`Тендер: ${d.name||"Сделка"}`,meta:rub(potential),minutes:20,hard:false,priority:2,refId:d.id,route:"crm"});
    if(validDateKey(d.closeDate))add({id:calendarSemanticId(["crm","close",d.id,d.closeDate]),dateKey:d.closeDate,source:"crm",kind:"crm-close",area:"Работа",title:`Закрытие сделки: ${d.name||"Сделка"}`,meta:`${rub(potential)} • ${d.probability||0}%`,minutes:15,hard:d.closeDate<localDateKey(),priority:d.closeDate<localDateKey()?1:2,refId:d.id,route:"crm"})
  }
  for(const p of projectActive()){
    if(validDateKey(p.nextDate))add({id:calendarSemanticId(["project","next",p.id,p.nextDate]),dateKey:p.nextDate,source:"project",kind:"project",area:p.area||"Личное",title:`Проект: ${p.title}`,meta:p.nextStep||"следующий шаг",minutes:25,hard:p.nextDate<localDateKey()&&+p.priority===1,priority:+p.priority||2,refId:p.id,route:"projects"});
    if(validDateKey(p.deadline))add({id:calendarSemanticId(["project","deadline",p.id,p.deadline]),dateKey:p.deadline,source:"project",kind:"project-deadline",area:p.area||"Личное",title:`Дедлайн: ${p.title}`,meta:`Прогресс ${p.progress||0}%`,minutes:15,hard:p.deadline<localDateKey()&&+p.priority===1,priority:+p.priority||2,refId:p.id,route:"projects"})
  }
  if(typeof taskActive==="function")for(const t of taskActive())if(validDateKey(t.dueDate))add({id:calendarSemanticId(["task",t.id,t.dueDate]),dateKey:t.dueDate,source:"task",kind:"task",area:t.area||"Личное",title:`Задача: ${t.title}`,meta:t.note||`Приоритет ${t.priority}`,minutes:t.minutes||15,hard:t.dueDate<localDateKey()&&+t.priority===1,priority:+t.priority||2,refId:t.id,route:"tasks"});
  for(const e of calendarReviewEvents(startKey,endKey))add(e);
  return out.sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||(b.hard?1:0)-(a.hard?1:0)||(+a.priority||2)-(+b.priority||2))
}
function calendarEvents(days=calendarHorizon(),includePast=3){
  const start=localDateKey(addDays(new Date(),-Math.max(0,includePast))),end=localDateKey(addDays(new Date(),Math.max(1,days)-1)),manual=calendarManualEvents().filter(x=>x.status!=="cancelled"&&x.dateKey>=start&&x.dateKey<=end).map(x=>({...x,source:"manual",kind:"manual",hard:x.status==="planned"&&x.dateKey<localDateKey()&&+x.priority===1,route:"manual"}));
  return [...calendarAutoEvents(start,end),...manual].sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||(b.hard?1:0)-(a.hard?1:0)||(+a.priority||2)-(+b.priority||2))
}
function calendarDayLoad(dateKey,events=calendarEvents()){
  const rows=events.filter(x=>x.dateKey===dateKey&&x.status!=="cancelled"),minutes=rows.reduce((n,x)=>n+Math.max(0,+x.minutes||0),0),hard=rows.filter(x=>x.hard).length,active=rows.filter(x=>(+x.minutes||0)>0).length,capacity=calendarCapacity();
  const ratio=capacity>0?minutes/capacity:0,level=minutes>capacity||hard>=3?"bad":minutes>=capacity*.75||hard>=2||active>=6?"warn":"ok";
  return {dateKey,rows,minutes,hard,active,capacity,ratio,level}
}
function calendarOverloadedDays(days=calendarHorizon()){
  const events=calendarEvents(days,0),out=[];
  for(let i=0;i<days;i++){const k=localDateKey(addDays(new Date(),i)),d=calendarDayLoad(k,events);if(d.level==="bad")out.push(d)}
  return out
}
function calendarWeekLoads(days=calendarHorizon()){
  const events=calendarEvents(days,0),map=new Map();
  for(let i=0;i<days;i++){
    const k=localDateKey(addDays(new Date(),i)),w=isoWeekKey(parseLocal(k)),d=calendarDayLoad(k,events),cur=map.get(w)||{week:w,minutes:0,events:0,hard:0,overloadDays:0,start:k,end:k};
    cur.minutes+=d.minutes;cur.events+=d.rows.length;cur.hard+=d.hard;cur.overloadDays+=d.level==="bad"?1:0;cur.end=k;map.set(w,cur)
  }
  return [...map.values()]
}
function calendarDecisionEngine(){
  const out=[],today=localDateKey(),manual=calendarManualEvents().filter(x=>x.status==="planned");
  for(const x of manual){
    const overdue=x.dateKey<today,onToday=x.dateKey===today;if(!overdue&&!onToday)continue;
    const score=overdue?(+x.priority===1?120:92):(+x.priority===1?82:+x.priority===2?68:54);
    out.push({id:`calendar:${x.id}`,kind:overdue?"calendar-overdue":"calendar-today",area:x.area||calendarTypeArea(x.type),title:overdue?`Просрочено в календаре: ${x.title}`:`Сегодня: ${x.title}`,meta:`${x.type} • ${x.minutes||0} мин${x.note?` • ${x.note}`:""}`,score,hard:overdue&&+x.priority===1,minutes:x.minutes||15})
  }
  const todayLoad=calendarDayLoad(today);if(todayLoad.level==="bad")out.push({id:"calendar:overload:today",kind:"calendar-overload",area:"Система",title:"Разгрузить сегодняшний календарь",meta:`~${todayLoad.minutes} мин обязательств при лимите ${todayLoad.capacity} мин • событий ${todayLoad.rows.length}`,score:79,hard:false,minutes:10});
  return out.sort((a,b)=>b.score-a.score).slice(0,8)
}
function calendarFindEvent(id){return calendarEvents(calendarHorizon(),7).find(x=>x.id===id)||null}
function calendarOpenEvent(id){
  const e=calendarFindEvent(id);if(!e)return;
  if(e.source==="finance"){ux7Go("finance","analysis");return}
  if(e.source==="crm"){ux7Go("work","crm");return}
  if(e.source==="project"||e.source==="review"){ux7Go("more","overview");return}
  if(e.source==="task"){ux7Go("today","focus");setTimeout(()=>document.getElementById("tasksOsCommand")?.scrollIntoView?.({behavior:"smooth",block:"center"}),180);return}
  if(e.manual&&e.area==="Теннис"){ux7Go("tennis","training");return}
  if(e.manual&&e.area==="Работа"){ux7Go("work","log");return}
}
function calendarClearForm(){
  for(const id of ["calendarEditId","calendarTitle","calendarDate","calendarNote"]){const el=projectEl(id);if(el)el.value=""}
  if(projectEl("calendarMinutes"))projectEl("calendarMinutes").value="90";
  if(projectEl("calendarType"))projectEl("calendarType").value="Тренировка";
  if(projectEl("calendarPriority"))projectEl("calendarPriority").value="2";
  if(projectEl("calendarRepeatWeeks"))projectEl("calendarRepeatWeeks").value="1";
  const card=projectEl("calendarEditorCard");if(card)card.hidden=true
}
function calendarEdit(id){
  const x=calendarManualEvents().find(e=>e.id===id);if(!x)return;
  const vals={calendarEditId:x.id,calendarTitle:x.title,calendarDate:x.dateKey,calendarMinutes:x.minutes||0,calendarNote:x.note||"",calendarType:x.type||"Другое",calendarPriority:x.priority||2,calendarRepeatWeeks:1};
  for(const [id,v] of Object.entries(vals)){const el=projectEl(id);if(el)el.value=String(v)}
  const card=projectEl("calendarEditorCard");if(card)card.hidden=false
}
async function saveCalendarEvent(){
  const title=String(projectEl("calendarTitle")?.value||"").trim(),dateKey=String(projectEl("calendarDate")?.value||"");if(!title||!validDateKey(dateKey)){toast("Укажи название и дату");return}
  const editId=String(projectEl("calendarEditId")?.value||""),type=String(projectEl("calendarType")?.value||"Другое"),minutes=clamp(Math.round(+projectEl("calendarMinutes")?.value||0),0,720),priority=clamp(Math.round(+projectEl("calendarPriority")?.value||2),1,3),note=String(projectEl("calendarNote")?.value||"").trim(),repeatWeeks=clamp(Math.round(+projectEl("calendarRepeatWeeks")?.value||1),1,12);
  if(editId){
    const x=calendarManualEvents().find(e=>e.id===editId);if(!x)return;
    Object.assign(x,{title,type,area:calendarTypeArea(type),dateKey,minutes,priority,note,updatedAt:new Date().toISOString()});audit("Событие календаря обновлено","system",`${dateKey} • ${title}`)
  }else{
    const made=addCalendarPlan({title,dateKey,type,minutes,priority,note,repeatWeeks});audit("Событие календаря добавлено","system",`${made.length} шт. • ${title}`)
  }
  calendarClearForm();await save(editId?"Событие календаря обновлено":repeatWeeks>1?`Запланировано ${repeatWeeks} событий`:"Событие запланировано")
}
async function setCalendarEventStatus(id,status){
  const x=calendarManualEvents().find(e=>e.id===id);if(!x||!["planned","done","cancelled"].includes(status))return;x.status=status;x.updatedAt=new Date().toISOString();await save(status==="done"?"Плановое событие выполнено":"Событие отменено")
}
async function deleteCalendarEvent(id){
  const arr=calendarStore(),i=arr.findIndex(x=>x.id===id);if(i<0)return;arr.splice(i,1);await save("Событие удалено из календаря")
}
function calendarSummary(){
  const events=calendarEvents(),today=localDateKey(),future=events.filter(x=>x.dateKey>=today),over=calendarOverloadedDays(),week=calendarWeekLoads(7)[0]||{minutes:0,events:0,hard:0,overloadDays:0};
  return {events:future.length,manual:future.filter(x=>x.manual).length,money:future.filter(x=>x.source==="finance"&&x.kind==="payment").length,crm:future.filter(x=>x.source==="crm").length,projects:future.filter(x=>x.source==="project").length,overloadDays:over.length,nextOverload:over[0]||null,week}
}
function ensureCalendarOsUi(){
  if(projectEl("calendarOsCommand"))return;
  const grid=document.querySelector?.("#more .grid");if(!grid||typeof grid.insertAdjacentHTML!=="function")return;
  const anchor=projectEl("reviewHistory")?.closest?.(".card");
  const html=`
    <div data-ux7-view="overview" class="card ux7-card span-12">
      <div class="split"><div><div class="eyebrow">Calendar / Timeline OS</div><div class="section-title">Единая временная ось</div></div><button class="btn secondary small" onclick="projectEl('calendarEditorCard').hidden=false;projectEl('calendarDate').value=localDateKey()">+ Событие</button></div>
      <div class="muted" style="margin-top:6px">Автоматически: деньги, CRM, проекты и обзоры. Вручную: тренировки, турниры и другие планы. Нагрузка — оценка активного времени, а не полный тайм-трекинг.</div>
      <div id="calendarOsCommand" style="margin-top:12px"></div>
    </div>
    <div data-ux7-view="overview" class="card ux7-card span-8"><div class="title">Ближайшие 14 дней</div><div id="calendarTimeline"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-4"><div class="title">Нагрузка</div><div id="calendarLoad"></div><div class="formgrid" style="margin-top:12px"><div class="field"><label>Лимит активных обязательств / день, мин</label><input id="calendarCapacity" type="number" min="30" max="720"></div><div class="field"><label>Горизонт, дней</label><input id="calendarHorizon" type="number" min="7" max="90"></div></div><button class="btn ghost small" style="margin-top:8px" onclick="saveCalendarSettings()">Сохранить</button></div>
    <div data-ux7-view="overview" class="card ux7-card span-12" id="calendarEditorCard" hidden>
      <div class="title">Плановое событие</div><input id="calendarEditId" type="hidden">
      <div class="formgrid" style="margin-top:10px">
        <div class="field"><label>Название</label><input id="calendarTitle" placeholder="Например: групповая тренировка"></div>
        <div class="field"><label>Дата</label><input id="calendarDate" type="date"></div>
        <div class="field"><label>Тип</label><select id="calendarType"><option>Тренировка</option><option>Турнир</option><option>Работа</option><option>Финансы</option><option>Знания</option><option>Личное</option><option>Другое</option></select></div>
        <div class="field"><label>Длительность, мин</label><input id="calendarMinutes" type="number" min="0" max="720" value="90"></div>
        <div class="field"><label>Приоритет</label><select id="calendarPriority"><option value="1">Высокий</option><option value="2" selected>Средний</option><option value="3">Низкий</option></select></div>
        <div class="field"><label>Повторять еженедельно, недель</label><input id="calendarRepeatWeeks" type="number" min="1" max="12" value="1"></div>
      </div>
      <div class="field" style="margin-top:10px"><label>Комментарий</label><input id="calendarNote"></div>
      <div class="split" style="margin-top:10px"><button class="btn" onclick="saveCalendarEvent()">Сохранить</button><button class="btn ghost" onclick="calendarClearForm()">Отмена</button></div>
      <div class="sub" style="margin-top:8px">Плановая тренировка не заменяет фактическую запись в Tennis OS после занятия.</div>
    </div>`;
  if(anchor&&typeof anchor.insertAdjacentHTML==="function")anchor.insertAdjacentHTML("afterend",html);else grid.insertAdjacentHTML("beforeend",html)
}
async function saveCalendarSettings(){
  S.settings.calendarDailyCapacityMin=clamp(Math.round(+projectEl("calendarCapacity")?.value||180),30,720);
  S.settings.calendarHorizonDays=clamp(Math.round(+projectEl("calendarHorizon")?.value||30),7,90);
  await save("Настройки Calendar OS сохранены")
}
function renderCalendarOs(){
  if(!projectEl("calendarOsCommand"))return;
  const q=calendarSummary(),today=localDateKey();
  projectEl("calendarOsCommand").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Событий впереди</div><b>${q.events}</b></div><div class="report-item"><div class="smallcaps">Плановых вручную</div><b>${q.manual}</b></div><div class="report-item"><div class="smallcaps">Платежей</div><b>${q.money}</b></div><div class="report-item"><div class="smallcaps">CRM-сроков</div><b>${q.crm}</b></div><div class="report-item"><div class="smallcaps">Проектных сроков</div><b>${q.projects}</b></div><div class="report-item"><div class="smallcaps">Перегруженных дней</div><b class="${q.overloadDays?"income-bad":""}">${q.overloadDays}</b></div></div>${q.nextOverload?`<div class="notice" style="margin-top:10px"><b>Ближайшая перегрузка:</b> ${fmtDate(parseLocal(q.nextOverload.dateKey))} • ~${q.nextOverload.minutes}/${q.nextOverload.capacity} мин.</div>`:""}`;
  const events=calendarEvents(14,2),days=[...new Set(events.map(x=>x.dateKey))].sort();
  projectEl("calendarTimeline").innerHTML=days.length?days.map(k=>{
    const d=calendarDayLoad(k,events),past=k<today,label=k===today?"Сегодня":fmtDate(parseLocal(k)),cls=d.level==="bad"?"bad":d.level==="warn"?"warn":"";
    return `<div class="log-item"><div class="split"><div class="qtitle">${label}${past?" • просроченное":""}</div><span class="tag ${cls}">~${d.minutes}/${d.capacity} мин</span></div>${d.rows.map(e=>`<div class="quest" style="margin-top:7px"><span class="tag ${e.hard?"bad":+e.priority===1?"warn":""}">${escapeHtml(e.area||"Система")}</span><div class="qbody"><div class="qtitle">${escapeHtml(e.title)}</div><div class="qmeta">${escapeHtml(e.meta||e.note||"")}${e.minutes?` • ~${e.minutes} мин`:""}${e.manual&&e.status==="done"?" • выполнено":""}</div></div>${e.manual?`<div class="split"><button class="btn ghost small" onclick="calendarEdit('${e.id}')">Изм.</button>${e.status==="planned"?`<button class="btn ghost small" onclick="setCalendarEventStatus('${e.id}','done')">✓</button>`:""}<button class="btn ghost small" onclick="deleteCalendarEvent('${e.id}')">×</button></div>`:`<button class="btn ghost small" onclick="calendarOpenEvent('${e.id}')">Открыть</button>`}</div>`).join("")}</div>`
  }).join(""):'<div class="empty">На ближайшие 14 дней событий нет.</div>';
  const weeks=calendarWeekLoads(Math.min(calendarHorizon(),35));
  projectEl("calendarLoad").innerHTML=weeks.map(w=>`<div class="goal"><div class="goal-top"><span>${escapeHtml(w.week)}</span><b>${w.minutes} мин</b></div><div class="qmeta">${w.events} событий • жёстких ${w.hard} • перегруженных дней ${w.overloadDays}</div></div>`).join("")||'<div class="empty">Недостаточно данных.</div>';
  const cap=projectEl("calendarCapacity"),hor=projectEl("calendarHorizon");if(cap&&document.activeElement!==cap)cap.value=String(calendarCapacity());if(hor&&document.activeElement!==hor)hor.value=String(calendarHorizon())
}
