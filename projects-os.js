"use strict";

/* Projects OS — outcome -> deadline -> next action.
   Stored in the v18 entities layer; Goals can reference Projects and Tasks reference Projects. */

function projectStore(){if(!S.entities||typeof S.entities!=="object")S.entities={};if(!Array.isArray(S.entities.projects))S.entities.projects=[];return S.entities.projects}
function projectEl(id){return document.getElementById(id)}
function projectPriorityLabel(p){return +p===1?"Высокий":+p===2?"Средний":"Низкий"}
function projectAreaStat(area){return area==="Финансы"?"Финансы":area==="Работа"?"Карьера":area==="Теннис"?"Теннис":area==="Знания"?"Разум":"Дисциплина"}
function projectDaysTo(dateKey){
  if(!validDateKey(dateKey))return null;
  return Math.round((parseLocal(dateKey)-parseLocal(localDateKey()))/86400000)
}
function projectActive(){return projectStore().filter(x=>x.status==="active")}
function projectCompletedThisMonth(){return projectStore().filter(x=>x.status==="done"&&String(x.completedAt||"").slice(0,7)===localMonthKey()).length}
function projectHealth(p){
  const today=localDateKey(),deadlineDays=projectDaysTo(p.deadline),nextDays=projectDaysTo(p.nextDate),updated=Date.parse(p.updatedAt||p.createdAt||""),staleDays=Number.isFinite(updated)?Math.floor((Date.now()-updated)/86400000):null;
  const overdueNext=!!p.nextDate&&p.nextDate<today,overdueDeadline=!!p.deadline&&p.deadline<today,pct=clamp(+p.progress||0,0,100);
  let state="ok",label="В работе";
  if(overdueDeadline){state="bad";label="Дедлайн просрочен"}
  else if(overdueNext){state="bad";label="Следующий шаг просрочен"}
  else if(!String(p.nextStep||"").trim()){state="warn";label="Нет следующего шага"}
  else if(deadlineDays!=null&&deadlineDays<=7){state="warn";label=`До дедлайна ${Math.max(0,deadlineDays)} дн.`}
  else if(staleDays!=null&&staleDays>=14){state="warn";label=`Без обновлений ${staleDays} дн.`}
  return {deadlineDays,nextDays,staleDays,overdueNext,overdueDeadline,pct,state,label}
}
function projectDecisionEngine(){
  const out=[];
  for(const p of projectActive()){
    const h=projectHealth(p),boost=+p.priority===1?20:+p.priority===2?10:0,area=p.area||"Личное",base={projectId:p.id,area,minutes:25};
    if(h.overdueNext)out.push({...base,kind:"project-next",score:112+boost,hard:+p.priority===1,title:`Проект: ${p.title} — выполнить следующий шаг`,meta:`${area} • просрочено: ${p.nextStep||"следующий шаг"}${p.nextDate?` • ${fmtDate(parseLocal(p.nextDate))}`:""}`});
    if(h.overdueDeadline)out.push({...base,kind:"project-deadline",score:108+boost,hard:+p.priority===1,title:`Перепланировать проект: ${p.title}`,meta:`${area} • дедлайн был ${fmtDate(parseLocal(p.deadline))} • прогресс ${h.pct}%`});
    else if(h.nextDays===0)out.push({...base,kind:"project-next",score:98+boost,hard:false,title:`Сегодня по проекту: ${p.title}`,meta:`${area} • ${p.nextStep||"следующий шаг"}`});
    else if(h.deadlineDays!=null&&h.deadlineDays>=0&&h.deadlineDays<=7)out.push({...base,kind:"project-deadline",score:82+boost,hard:false,title:`Дедлайн проекта приближается: ${p.title}`,meta:`${area} • ${h.deadlineDays} дн. • прогресс ${h.pct}%`});
    if(!String(p.nextStep||"").trim())out.push({...base,kind:"project-plan",score:72+boost,hard:false,title:`Определить следующий шаг: ${p.title}`,meta:`${area} • прогресс ${h.pct}%`});
    else if(h.staleDays!=null&&h.staleDays>=14)out.push({...base,kind:"project-stale",score:58+boost,hard:false,title:`Обновить проект: ${p.title}`,meta:`${area} • без изменений ${h.staleDays} дн. • следующий шаг: ${p.nextStep}`});
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,12)
}
function projectSummary(){
  const active=projectActive(),health=active.map(projectHealth),avg=active.length?active.reduce((s,p)=>s+clamp(+p.progress||0,0,100),0)/active.length:0;
  return {
    active:active.length,
    overdue:health.filter(x=>x.overdueNext||x.overdueDeadline).length,
    noNext:active.filter(x=>!String(x.nextStep||"").trim()).length,
    due7:health.filter(x=>x.deadlineDays!=null&&x.deadlineDays>=0&&x.deadlineDays<=7).length,
    avg,
    completed:projectCompletedThisMonth()
  }
}
function projectSortValue(p){
  const h=projectHealth(p),priority=+p.priority||2;
  return (h.overdueDeadline?1000:0)+(h.overdueNext?900:0)+(h.deadlineDays!=null&&h.deadlineDays<=7?500:0)+(4-priority)*100+(100-h.pct)
}
function ensureProjectsOsUi(){
  if(projectEl("projectsOsCommand"))return;
  const grid=document.querySelector?.("#more .grid");if(!grid||typeof grid.insertAdjacentHTML!=="function")return;
  grid.insertAdjacentHTML("afterbegin",`
    <div data-ux7-view="overview" class="card ux7-card span-12">
      <div class="eyebrow">Projects OS</div>
      <div class="section-title">Проекты</div>
      <div class="muted" style="margin-top:6px">Результат → дедлайн → следующий шаг. Life OS автоматически поднимает просроченные и застрявшие проекты.</div>
      <div id="projectsOsCommand" style="margin-top:12px"></div>
    </div>
    <div data-ux7-view="overview" class="card ux7-card span-12">
      <div class="split"><div><div class="eyebrow">Portfolio</div><div class="title">Активные проекты</div></div><button class="btn secondary small" onclick="projectToggleEditor(true)">+ Проект</button></div>
      <div id="projectsOsList" style="margin-top:10px"></div>
    </div>
    <div data-ux7-view="overview" class="card ux7-card span-12" id="projectEditorCard" hidden>
      <div class="title">Редактор проекта</div>
      <input id="projectEditId" type="hidden">
      <div class="formgrid" style="margin-top:12px">
        <div class="field"><label>Проект</label><input id="projectTitle" placeholder="Например: выйти на 4,5 млн продаж"></div>
        <div class="field"><label>Область</label><select id="projectArea"><option>Работа</option><option>Финансы</option><option>Теннис</option><option>Знания</option><option>Личное</option><option>Система</option></select></div>
        <div class="field"><label>Приоритет</label><select id="projectPriority"><option value="1">Высокий</option><option value="2" selected>Средний</option><option value="3">Низкий</option></select></div>
        <div class="field"><label>Дедлайн</label><input id="projectDeadline" type="date"></div>
        <div class="field"><label>Прогресс, %</label><input id="projectProgress" type="number" min="0" max="100" value="0"></div>
        <div class="field"><label>Дата следующего шага</label><input id="projectNextDate" type="date"></div>
      </div>
      <div class="field" style="margin-top:10px"><label>Как выглядит готовый результат</label><input id="projectOutcome" placeholder="Конкретный проверяемый результат"></div>
      <div class="field" style="margin-top:10px"><label>Следующий физический шаг</label><input id="projectNextStep" placeholder="Что именно сделать дальше"></div>
      <div class="split" style="margin-top:12px"><button class="btn" onclick="saveProject()">Сохранить</button><button class="btn ghost" onclick="clearProjectForm()">Отмена</button></div>
    </div>
  `)
}
function projectToggleEditor(open=true){const card=projectEl("projectEditorCard");if(card)card.hidden=!open;if(open)projectEl("projectTitle")?.focus()}
function clearProjectForm(){
  for(const id of ["projectEditId","projectTitle","projectDeadline","projectOutcome","projectNextStep","projectNextDate"])if(projectEl(id))projectEl(id).value="";
  if(projectEl("projectPriority"))projectEl("projectPriority").value="2";
  if(projectEl("projectProgress"))projectEl("projectProgress").value="0";
  if(projectEl("projectArea"))projectEl("projectArea").value="Работа";
  projectToggleEditor(false)
}
async function saveProject(){
  const title=String(projectEl("projectTitle")?.value||"").trim();if(!title){toast("Укажи название проекта");return}
  const id=String(projectEl("projectEditId")?.value||""),arr=projectStore(),old=id?arr.find(x=>x.id===id):null,now=new Date().toISOString();
  const p={
    id:old?.id||uid(),title,area:String(projectEl("projectArea")?.value||"Личное"),priority:clamp(Math.round(+projectEl("projectPriority")?.value||2),1,3),
    deadline:String(projectEl("projectDeadline")?.value||""),outcome:String(projectEl("projectOutcome")?.value||"").trim(),
    progress:clamp(Math.round(+projectEl("projectProgress")?.value||0),0,100),nextStep:String(projectEl("projectNextStep")?.value||"").trim(),
    nextDate:String(projectEl("projectNextDate")?.value||""),status:old?.status||"active",createdAt:old?.createdAt||now,updatedAt:now,
    completedAt:old?.completedAt||"",xpAwarded:old?.xpAwarded||0
  };
  if(old)Object.assign(old,p);else arr.push(p);
  audit(old?"Проект обновлён":"Проект создан","system",`${p.area} • ${p.title}`);
  clearProjectForm();await save(old?"Проект обновлён":"Проект создан")
}
function editProject(id){
  const p=projectStore().find(x=>x.id===id);if(!p)return;
  const vals={projectEditId:p.id,projectTitle:p.title,projectArea:p.area||"Личное",projectPriority:p.priority||2,projectDeadline:p.deadline||"",projectOutcome:p.outcome||"",projectProgress:p.progress||0,projectNextStep:p.nextStep||"",projectNextDate:p.nextDate||""};
  for(const [id,v] of Object.entries(vals))if(projectEl(id))projectEl(id).value=String(v??"");
  projectToggleEditor(true)
}
async function projectProgress(id,delta){
  const p=projectStore().find(x=>x.id===id);if(!p)return;p.progress=clamp((+p.progress||0)+delta,0,100);p.updatedAt=new Date().toISOString();
  if(p.progress>=100){await completeProject(id);return}await save(`Прогресс проекта: ${p.progress}%`)
}
async function completeProject(id){
  const p=projectStore().find(x=>x.id===id);if(!p||p.status==="done")return;
  p.status="done";p.progress=100;p.completedAt=new Date().toISOString();p.updatedAt=p.completedAt;
  if(!p.xpAwarded){const xp=+p.priority===1?250:+p.priority===2?150:100;p.xpAwarded=xp;addXp(xp,projectAreaStat(p.area),"Проект завершён",`project:${p.id}`,"result",localDateKey())}
  audit("Проект завершён","system",p.title);await save("Проект завершён")
}
async function setProjectStatus(id,status){
  const p=projectStore().find(x=>x.id===id);if(!p||!["active","paused","archived"].includes(status))return;
  p.status=status;p.updatedAt=new Date().toISOString();if(status==="archived")p.archivedAt=p.updatedAt;await save(status==="active"?"Проект возобновлён":status==="paused"?"Проект на паузе":"Проект архивирован")
}
function renderProjectsOs(){
  if(!projectEl("projectsOsCommand"))return;
  const q=projectSummary(),actions=projectDecisionEngine();
  const attention=actions.length
    ?'<div class="title" style="margin-top:14px">Требуют внимания</div>'+actions.slice(0,4).map(a=>{
      const cls=a.hard?"bad":a.score>=90?"warn":"";
      return '<div class="quest"><span class="tag '+cls+'">'+escapeHtml(a.area)+'</span><div class="qbody"><div class="qtitle">'+escapeHtml(a.title)+'</div><div class="qmeta">'+escapeHtml(a.meta)+'</div></div></div>'
    }).join("")
    :'<div class="status" style="margin-top:10px">Активные проекты не требуют срочного вмешательства.</div>';
  projectEl("projectsOsCommand").innerHTML=
    '<div class="report-grid">'+
      '<div class="report-item"><div class="smallcaps">Активных</div><b>'+q.active+'</b></div>'+
      '<div class="report-item"><div class="smallcaps">Просрочено</div><b class="'+(q.overdue?"income-bad":"")+'">'+q.overdue+'</b></div>'+
      '<div class="report-item"><div class="smallcaps">Без следующего шага</div><b>'+q.noNext+'</b></div>'+
      '<div class="report-item"><div class="smallcaps">Дедлайн ≤7 дней</div><b>'+q.due7+'</b></div>'+
      '<div class="report-item"><div class="smallcaps">Средний прогресс</div><b>'+Math.round(q.avg)+'%</b></div>'+
      '<div class="report-item"><div class="smallcaps">Завершено в месяце</div><b>'+q.completed+'</b></div>'+
    '</div>'+attention;

  const active=projectActive().slice().sort((a,b)=>projectSortValue(b)-projectSortValue(a));
  const paused=projectStore().filter(x=>x.status==="paused");
  const rows=[...active,...paused];
  projectEl("projectsOsList").innerHTML=rows.length?rows.map(p=>{
    const h=projectHealth(p),pausedState=p.status==="paused";
    const statusCls=h.state==="bad"?"bad":h.state==="warn"?"warn":"";
    const deadline=p.deadline?' • дедлайн '+fmtDate(parseLocal(p.deadline)):"";
    const outcome=p.outcome?'<div class="qmeta" style="margin-top:7px">Результат: '+escapeHtml(p.outcome)+'</div>':"";
    const next=p.nextStep?'<div class="status" style="margin-top:7px"><b>Дальше:</b> '+escapeHtml(p.nextStep)+(p.nextDate?' • '+fmtDate(parseLocal(p.nextDate)):"")+'</div>':"";
    const activeButtons='<button class="btn ghost small" onclick="projectProgress(\''+p.id+'\',10)">+10%</button><button class="btn secondary small" onclick="completeProject(\''+p.id+'\')">Готово</button><button class="btn ghost small" onclick="setProjectStatus(\''+p.id+'\',\'paused\')">Пауза</button>';
    const pausedButtons='<button class="btn secondary small" onclick="setProjectStatus(\''+p.id+'\',\'active\')">Продолжить</button>';
    return '<div class="log-item">'+
      '<div class="split"><div><div class="qtitle">'+escapeHtml(p.title)+'</div><div class="qmeta">'+escapeHtml(p.area||"Личное")+' • '+projectPriorityLabel(p.priority)+' • '+h.label+deadline+'</div></div><span class="tag '+statusCls+'">'+(pausedState?"Пауза":h.pct+"%")+'</span></div>'+
      '<div class="progress" style="margin-top:8px"><i style="width:'+h.pct+'%"></i></div>'+
      outcome+next+
      '<div class="split" style="margin-top:8px"><button class="btn ghost small" onclick="editProject(\''+p.id+'\')">Изменить</button>'+(pausedState?pausedButtons:activeButtons)+'<button class="btn ghost small" onclick="setProjectStatus(\''+p.id+'\',\'archived\')">Архив</button></div>'+
    '</div>'
  }).join(""):'<div class="empty">Проектов пока нет. Добавь только те цели, для которых нужен контроль следующего шага.</div>'
}
