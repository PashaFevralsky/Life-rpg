"use strict";

/* Review / Planning OS — close the loop between activity, projects and the next period.
   Reviews are snapshots; optional notes never block closing a period. */

function reviewStore(){
  if(!Array.isArray(S.settings.reviews))S.settings.reviews=[];
  return S.settings.reviews
}
function reviewWipLimit(){return Math.round(lifeOsSettingNumber("reviewProjectWipLimit",5,1,12))}
function reviewPeriodKey(kind,date=new Date()){return kind==="month"?localMonthKey(date):isoWeekKey(date)}
function reviewCurrent(kind){const key=reviewPeriodKey(kind);return reviewStore().find(x=>x.kind===kind&&x.periodKey===key)||null}
function reviewLatest(kind){
  return reviewStore().filter(x=>x.kind===kind).slice().sort((a,b)=>Date.parse(b.savedAt||b.createdAt||0)-Date.parse(a.savedAt||a.createdAt||0))[0]||null
}
function reviewPrevious(kind,currentKey=reviewPeriodKey(kind)){
  return reviewStore().filter(x=>x.kind===kind&&x.periodKey!==currentKey).slice().sort((a,b)=>Date.parse(b.savedAt||b.createdAt||0)-Date.parse(a.savedAt||a.createdAt||0))[0]||null
}
function reviewCompletedProjects(a,b){
  return projectStore().filter(p=>p.status==="done"&&p.completedAt&&inRange(localDateKey(new Date(p.completedAt)),a,b)).length
}
function reviewSnapshot(kind){
  const score=lifeScore(),projects=projectSummary(),life=lifeOsDailyPlan(),finance=typeof decisionEngineData==="function"?decisionEngineData():null,tasks=typeof taskSummary==="function"?taskSummary():{active:0,overdue:0,due:0,high:0,doneMonth:0},inboxRows=typeof inboxOpen==="function"?inboxOpen():[];
  const inbox={open:inboxRows.length,old:inboxRows.filter(x=>typeof inboxAgeDays==="function"&&inboxAgeDays(x)>=2).length};
  if(kind==="month"){
    const r=currentMonthReport(),month=localMonthKey(),readDays=new Set((S.readingLogs||[]).filter(x=>String(x.dateKey||"").startsWith(month)).map(x=>x.dateKey)).size;
    return {
      at:new Date().toISOString(),kind,periodKey:month,lifeScore:Math.round(score.total),
      finance:{income:r.income,expenses:r.expenses,payments:r.payments,cash:r.cash,debt:totalDebt(),cashGap:finance?.p?.cashGapDate||""},
      work:{sales:r.work.sales,contacts:r.work.contacts,proposals:r.work.proposals,plan:+S.settings.workMonthlyPlan||0,crmOverdue:crmOverdue().length},
      tennis:{sessions:r.tennis,tournaments:r.tournaments,target:Math.round(lifeOsSettingNumber("tennisMonthlyTarget",12,1,60))},
      knowledge:{minutes:r.readMinutes,books:r.books,days:readDays,reviewDue:typeof knowledgeReviewQueue==="function"?knowledgeReviewQueue().length:0},
      projects:{...projects,completed:r?projectCompletedThisMonth():0},
      tasks:{...tasks},inbox,
      system:{hard:life.hardAll.length,deferred:life.deferred.length}
    }
  }
  const [a,b]=weekBounds(),w=workWeek(),t=tennisWeek(),reads=(S.readingLogs||[]).filter(x=>inRange(x.dateKey,a,b)),readDays=new Set(reads.map(x=>x.dateKey)).size;
  const income=(S.incomeLogs||[]).filter(x=>inRange(x.dateKey||String(x.date||"").slice(0,10),a,b)).reduce((n,x)=>n+(+x.amount||0),0);
  const expenses=(S.expenses||[]).filter(x=>inRange(x.dateKey,a,b)).reduce((n,x)=>n+(+x.amount||0),0);
  const payments=(S.payments||[]).filter(x=>inRange(x.localDate||String(x.date||"").slice(0,10),a,b)).reduce((n,x)=>n+(+x.amount||0),0);
  return {
    at:new Date().toISOString(),kind,periodKey:isoWeekKey(),lifeScore:Math.round(score.total),
    finance:{income,expenses,payments,debt:totalDebt(),cashGap:finance?.p?.cashGapDate||""},
    work:{sales:w.sales,contacts:w.contacts,followups:w.followups,lpr:w.lpr,meetings:w.meetings,proposals:w.proposals,crmOverdue:crmOverdue().length},
    tennis:{sessions:t.sessions,tournaments:t.tournaments,target:Math.round(lifeOsSettingNumber("tennisWeeklyTarget",4,1,14))},
    knowledge:{minutes:reads.reduce((n,x)=>n+(+x.minutes||0),0),days:readDays,target:Math.round(lifeOsSettingNumber("readingWeeklyDaysTarget",7,1,7)),reviewDue:typeof knowledgeReviewQueue==="function"?knowledgeReviewQueue().length:0},
    projects:{...projects,completed:reviewCompletedProjects(a,b)},
    tasks:{...tasks},inbox,
    system:{hard:life.hardAll.length,deferred:life.deferred.length}
  }
}
function reviewProjectRank(p){
  const h=projectHealth(p),priority=+p.priority||2;
  return (h.overdueDeadline?1000:0)+(h.overdueNext?900:0)+(h.deadlineDays!=null&&h.deadlineDays<=14?500:0)+(4-priority)*120+(h.staleDays||0)*2+(100-h.pct)*.2
}
function reviewPauseCandidates(){
  const active=projectActive(),limit=reviewWipLimit(),excess=Math.max(0,active.length-limit);if(!excess)return[];
  return active.slice().sort((a,b)=>{
    const ha=projectHealth(a),hb=projectHealth(b);
    const protectedA=(+a.priority===1||ha.overdueDeadline||ha.overdueNext)?1:0,protectedB=(+b.priority===1||hb.overdueDeadline||hb.overdueNext)?1:0;
    if(protectedA!==protectedB)return protectedA-protectedB;
    if((+a.priority||2)!== (+b.priority||2))return (+b.priority||2)-(+a.priority||2);
    if((ha.staleDays||0)!==(hb.staleDays||0))return (hb.staleDays||0)-(ha.staleDays||0);
    return ha.pct-hb.pct
  }).slice(0,excess)
}
function reviewSuggestedPlan(){
  const candidates=lifeOsCandidates().filter(x=>x.area!=="Система"),focusAreas=[],seen=new Set();
  for(const x of candidates){if(!seen.has(x.area)){focusAreas.push(x.area);seen.add(x.area)}if(focusAreas.length>=3)break}
  const pauseIds=new Set(reviewPauseCandidates().map(x=>x.id));
  const focusProjects=projectActive().filter(x=>!pauseIds.has(x.id)).sort((a,b)=>reviewProjectRank(b)-reviewProjectRank(a)).slice(0,3);
  return {focusAreas,focusProjectIds:focusProjects.map(x=>x.id),pauseProjectIds:[...pauseIds],generatedAt:new Date().toISOString()}
}
function reviewActivePlan(){
  const current=reviewCurrent("week");if(current?.plan)return current.plan;
  const latest=reviewLatest("week");if(!latest?.plan)return null;
  const age=(Date.now()-Date.parse(latest.savedAt||latest.createdAt||0))/86400000;
  return age<=8?latest.plan:null
}
function reviewPlanCandidates(){
  const plan=reviewActivePlan();if(!plan)return[];
  return (plan.focusProjectIds||[]).map(id=>projectStore().find(p=>p.id===id&&p.status==="active")).filter(Boolean).slice(0,2).map(p=>({
    projectId:p.id,area:p.area||"Личное",score:64+(+p.priority===1?12:+p.priority===2?6:0),minutes:25,
    title:`Фокус недели: ${p.title}`,meta:p.nextStep?`Следующий шаг: ${p.nextStep}${p.nextDate?` • ${fmtDate(parseLocal(p.nextDate))}`:""}`:`Определи следующий шаг • прогресс ${p.progress||0}%`
  }))
}
function reviewNeedsWeekly(){
  const current=reviewCurrent("week");if(current)return false;
  const latest=reviewLatest("week"),age=latest?(Date.now()-Date.parse(latest.savedAt||latest.createdAt||0))/86400000:null,day=new Date().getDay();
  if(age!=null&&age>=7)return true;
  return !latest&&(day===0||day===1)
}
function reviewNeedsMonthly(){
  const current=reviewCurrent("month");if(current)return false;
  return new Date().getDate()>=28
}
function reviewDecisionEngine(){
  const out=[];
  if(reviewNeedsWeekly())out.push({kind:"weekly-review",score:52,minutes:20,title:"Провести недельный обзор",meta:"Зафиксировать факты, выбрать до 3 фокусов и проверить перегрузку проектов."});
  if(reviewNeedsMonthly())out.push({kind:"monthly-review",score:58,minutes:30,title:"Закрыть месячный обзор",meta:"Сохранить итог месяца и перенести приоритеты в следующий цикл."});
  return out
}
function reviewDelta(kind){
  const current=reviewSnapshot(kind),prev=reviewPrevious(kind,current.periodKey);if(!prev?.snapshot)return null;
  const p=prev.snapshot;
  return {
    life:(current.lifeScore||0)-(p.lifeScore||0),
    debt:(current.finance?.debt||0)-(p.finance?.debt||0),
    sales:(current.work?.sales||0)-(p.work?.sales||0),
    overdue:(current.projects?.overdue||0)-(p.projects?.overdue||0)
  }
}
function reviewFocusReason(area){
  const map={Финансы:"денежные обязательства и устойчивость",Работа:"продажи, CRM и рабочий темп",Теннис:"регулярность и игровая практика",Знания:"чтение и повторение",Личное:"личные проекты",Проекты:"портфель проектов"};
  return map[area]||"важные действия периода"
}
async function saveReview(kind){
  const key=reviewPeriodKey(kind),store=reviewStore(),existing=store.find(x=>x.kind===kind&&x.periodKey===key),snapshot=reviewSnapshot(kind),plan=reviewSuggestedPlan(),now=new Date().toISOString();
  const prefix=kind==="month"?"reviewMonth":"reviewWeek",wins=String(projectEl(prefix+"Wins")?.value||"").trim(),change=String(projectEl(prefix+"Change")?.value||"").trim();
  if(existing){existing.snapshot=snapshot;existing.plan=plan;existing.wins=wins;existing.change=change;existing.savedAt=now}
  else{
    store.push({id:uid(),kind,periodKey:key,snapshot,plan,wins,change,createdAt:now,savedAt:now});
    const xp=kind==="month"?100:50;addXp(xp,"Дисциплина",kind==="month"?"Месячный обзор":"Недельный обзор",`review:${kind}:${key}`,"process",localDateKey())
  }
  store.sort((a,b)=>Date.parse(b.savedAt||0)-Date.parse(a.savedAt||0));if(store.length>36)store.length=36;
  audit(kind==="month"?"Месячный обзор":"Недельный обзор","system",`${key} • фокусы: ${plan.focusAreas.join(", ")||"нет"}`);
  await save(kind==="month"?"Месячный обзор сохранён":"Недельный обзор и план сохранены")
}
function reviewTrendHtml(kind){
  const d=reviewDelta(kind);if(!d)return'<div class="sub">Предыдущего сохранённого периода пока нет — тренд появится после следующего обзора.</div>';
  const sign=n=>n>0?"+":"";
  return `<div class="report-grid"><div class="report-item"><div class="smallcaps">Life Score Δ</div><b>${sign(d.life)}${d.life}</b></div><div class="report-item"><div class="smallcaps">Долг Δ</div><b>${sign(d.debt)}${compactRub(d.debt)}</b></div><div class="report-item"><div class="smallcaps">Продажи Δ</div><b>${sign(d.sales)}${compactRub(d.sales)}</b></div><div class="report-item"><div class="smallcaps">Просроч. проектов Δ</div><b>${sign(d.overdue)}${d.overdue}</b></div></div>`
}
function ensureReviewOsUi(){
  if(projectEl("reviewOsCommand"))return;
  const grid=document.querySelector?.("#more .grid");if(!grid||typeof grid.insertAdjacentHTML!=="function")return;
  const anchor=projectEl("projectEditorCard")?.closest?.(".card")||projectEl("projectEditorCard");
  const html=`
    <div data-ux7-view="overview" class="card ux7-card span-12">
      <div class="eyebrow">Review / Planning OS</div><div class="section-title">Недельный и месячный цикл</div>
      <div class="muted" style="margin-top:6px">Система сохраняет снимок фактов, сравнивает периоды и предлагает фокус. Ручные заметки необязательны.</div>
      <div id="reviewOsCommand" style="margin-top:12px"></div>
    </div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="eyebrow">Weekly Review</div><div class="title">Неделя → следующий фокус</div><div id="reviewWeekCard"></div><div class="field" style="margin-top:10px"><label>Что сработало — необязательно</label><input id="reviewWeekWins"></div><div class="field" style="margin-top:8px"><label>Что изменить — необязательно</label><input id="reviewWeekChange"></div><button class="btn secondary" style="margin-top:10px" onclick="saveReview('week')">Зафиксировать неделю</button></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="eyebrow">Monthly Review</div><div class="title">Месяц → следующий цикл</div><div id="reviewMonthCard"></div><div class="field" style="margin-top:10px"><label>Главный результат — необязательно</label><input id="reviewMonthWins"></div><div class="field" style="margin-top:8px"><label>Что изменить — необязательно</label><input id="reviewMonthChange"></div><button class="btn secondary" style="margin-top:10px" onclick="saveReview('month')">Зафиксировать месяц</button></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="title">План следующего периода</div><div id="reviewPlanCard"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="title">История обзоров</div><div id="reviewHistory"></div><div class="field" style="margin-top:10px"><label>WIP-лимит активных проектов</label><input id="reviewWipLimit" type="number" min="1" max="12"></div><button class="btn ghost small" style="margin-top:8px" onclick="saveReviewSettings()">Сохранить лимит</button></div>`;
  if(anchor&&typeof anchor.insertAdjacentHTML==="function")anchor.insertAdjacentHTML("afterend",html);else grid.insertAdjacentHTML("afterbegin",html)
}
async function saveReviewSettings(){
  S.settings.reviewProjectWipLimit=clamp(Math.round(+projectEl("reviewWipLimit")?.value||5),1,12);await save("WIP-лимит проектов сохранён")
}
function renderReviewOs(){
  if(!projectEl("reviewOsCommand"))return;
  const week=reviewSnapshot("week"),month=reviewSnapshot("month"),plan=reviewActivePlan()||reviewSuggestedPlan(),pause=reviewPauseCandidates(),currentWeek=reviewCurrent("week"),currentMonth=reviewCurrent("month");
  projectEl("reviewOsCommand").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Life Score</div><b>${week.lifeScore}</b></div><div class="report-item"><div class="smallcaps">Жёстких действий</div><b>${week.system.hard}</b></div><div class="report-item"><div class="smallcaps">Активных проектов</div><b>${week.projects.active}/${reviewWipLimit()}</b></div><div class="report-item"><div class="smallcaps">Просрочено задач</div><b class="${week.tasks.overdue?"income-bad":""}">${week.tasks.overdue}</b></div><div class="report-item"><div class="smallcaps">Inbox</div><b>${week.inbox.open}</b></div><div class="report-item"><div class="smallcaps">Обзор недели</div><b>${currentWeek?"✓":"—"}</b></div><div class="report-item"><div class="smallcaps">Обзор месяца</div><b>${currentMonth?"✓":"—"}</b></div></div>`;
  projectEl("reviewWeekCard").innerHTML=`<div class="goal"><div class="goal-top"><span>Продажи</span><b>${compactRub(week.work.sales)}</b></div><div class="goal-top" style="margin-top:6px"><span>CRM просрочено</span><b>${week.work.crmOverdue}</b></div><div class="goal-top" style="margin-top:6px"><span>Теннис</span><b>${week.tennis.sessions}/${week.tennis.target}</b></div><div class="goal-top" style="margin-top:6px"><span>Чтение</span><b>${week.knowledge.days}/${week.knowledge.target} дн.</b></div><div class="goal-top" style="margin-top:6px"><span>Проекты завершены</span><b>${week.projects.completed}</b></div><div class="goal-top" style="margin-top:6px"><span>Задачи / Inbox</span><b>${week.tasks.active} / ${week.inbox.open}</b></div></div><div style="margin-top:10px">${reviewTrendHtml("week")}</div>`;
  projectEl("reviewMonthCard").innerHTML=`<div class="goal"><div class="goal-top"><span>Доход / расходы</span><b>${compactRub(month.finance.income)} / ${compactRub(month.finance.expenses)}</b></div><div class="goal-top" style="margin-top:6px"><span>В долги</span><b>${compactRub(month.finance.payments)}</b></div><div class="goal-top" style="margin-top:6px"><span>Продажи</span><b>${compactRub(month.work.sales)}${month.work.plan?` / ${compactRub(month.work.plan)}`:""}</b></div><div class="goal-top" style="margin-top:6px"><span>Теннис</span><b>${month.tennis.sessions}/${month.tennis.target}</b></div><div class="goal-top" style="margin-top:6px"><span>Чтение</span><b>${month.knowledge.minutes} мин</b></div><div class="goal-top" style="margin-top:6px"><span>Задачи / Inbox</span><b>${month.tasks.active} / ${month.inbox.open}</b></div></div><div style="margin-top:10px">${reviewTrendHtml("month")}</div>`;
  const focus=(plan.focusAreas||[]).map(x=>`<div class="status" style="margin-top:7px"><b>${escapeHtml(x)}</b> — ${escapeHtml(reviewFocusReason(x))}</div>`).join("");
  const projects=(plan.focusProjectIds||[]).map(id=>projectStore().find(p=>p.id===id)).filter(Boolean).map(p=>`<div class="log-item"><div class="qtitle">${escapeHtml(p.title)}</div><div class="qmeta">${escapeHtml(p.area)} • ${p.progress||0}%${p.nextStep?` • ${escapeHtml(p.nextStep)}`:""}</div></div>`).join("");
  const pauseHtml=pause.length?`<div class="title" style="margin-top:12px">Кандидаты на паузу из-за WIP</div>${pause.map(p=>`<div class="log-item"><div class="qtitle">${escapeHtml(p.title)}</div><div class="qmeta">${escapeHtml(p.area)} • ${p.progress||0}% • ${projectPriorityLabel(p.priority)}</div><button class="btn ghost small" style="margin-top:7px" onclick="setProjectStatus('${p.id}','paused')">Поставить на паузу</button></div>`).join("")}`:"";
  projectEl("reviewPlanCard").innerHTML=(focus||'<div class="empty">Фокус появится после накопления данных.</div>')+(projects?`<div class="title" style="margin-top:12px">Фокус-проекты</div>${projects}`:"")+pauseHtml;
  const history=reviewStore().slice().sort((a,b)=>Date.parse(b.savedAt||0)-Date.parse(a.savedAt||0)).slice(0,6);
  projectEl("reviewHistory").innerHTML=history.length?history.map(r=>`<div class="log-item"><div class="qtitle">${r.kind==="week"?"Неделя":"Месяц"} • ${escapeHtml(r.periodKey)}</div><div class="qmeta">Life Score ${r.snapshot?.lifeScore??"—"} • фокусы ${(r.plan?.focusAreas||[]).map(escapeHtml).join(", ")||"—"}</div>${r.wins?`<div class="qmeta">Результат: ${escapeHtml(r.wins)}</div>`:""}</div>`).join(""):'<div class="empty">Сохранённых обзоров пока нет.</div>';
  const wip=projectEl("reviewWipLimit");if(wip&&document.activeElement!==wip)wip.value=String(reviewWipLimit());
  for(const [id,val] of [["reviewWeekWins",currentWeek?.wins||""],["reviewWeekChange",currentWeek?.change||""],["reviewMonthWins",currentMonth?.wins||""],["reviewMonthChange",currentMonth?.change||""]]){const el=projectEl(id);if(el&&!el.dataset.ready){el.value=val;el.dataset.ready="1"}}
}
