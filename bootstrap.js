"use strict";

/* Life RPG 10.0.2 — Runtime bootstrap + Life OS Command Center */

const ux7BaseRender=render;

render=function(){ux7BaseRender();ensureProjectsOsUi();renderProjectsOs();ensureReviewOsUi();renderReviewOs();ensureCalendarOsUi();renderCalendarOs();requestAnimationFrame(()=>{renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();for(const id of Object.keys(UX7_META))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false);window.LifePlatform?.refreshIcons?.()})};

const ux7BaseSwitchTab=switchTab;

switchTab=function(id){ux7BaseSwitchTab(id);requestAnimationFrame(()=>{const view=UX7_PREFS[id]||UX7_DEFAULTS[id];ux7SetView(id,view,false);ux7RefreshHeaders();ui82SyncChrome(id,view)})};


/* Life OS Command Center — cross-domain orchestration layer.
   Uses existing Finance / Work / Tennis / Knowledge engines.
   It does not create new mandatory input fields or change the state schema. */

function lifeOsSettingNumber(key,fallback,min=0,max=Number.POSITIVE_INFINITY){
  const v=Number(S.settings?.[key]);
  return Number.isFinite(v)?clamp(v,min,max):fallback
}

const lifeOsLegacyScore=lifeScore;
lifeScore=function(){
  const base=lifeOsLegacyScore(),week=typeof tennisWeek==="function"?tennisWeek():{sessions:0},monthSessions=(S.tennis||[]).filter(x=>x.dateKey?.startsWith(localMonthKey())).length;
  const tennisMonthTarget=Math.max(1,lifeOsSettingNumber("tennisMonthlyTarget",12,1,60)),tennisWeekTarget=Math.max(1,lifeOsSettingNumber("tennisWeeklyTarget",4,1,14));
  const tennisRegular=clamp(monthSessions/tennisMonthTarget*100,0,100),tennisWeekScore=clamp((week.sessions||0)/tennisWeekTarget*100,0,100),rated=typeof tennisAllMatches==="function"?tennisAllMatches().filter(m=>(+m.opponentRating||0)>0).length:0;
  base.tennis=tennisRegular*.55+tennisWeekScore*.30+Math.min(100,rated*10)*.15;

  const readingWeekTarget=Math.max(1,lifeOsSettingNumber("readingWeeklyDaysTarget",7,1,7)),readDays=clamp(readingDaysThisWeek()/readingWeekTarget*100,0,100),b=currentBook(),bookProgress=b&&+b.totalPages?clamp((+b.currentPage||0)/(+b.totalPages||1)*100,0,100):50,applied=(S.readingLogs||[]).filter(x=>x.application).filter(x=>x.dateKey>=localDateKey(addDays(new Date(),-30))).length;
  base.reading=readDays*.55+bookProgress*.25+Math.min(100,applied*20)*.20;

  base.total=(base.finance+base.career+base.tennis+base.reading+base.discipline)/5;
  base.details=base.details.map(x=>x.name==="Теннис"?{...x,reason:`месяц ${monthSessions}/${tennisMonthTarget} • неделя ${week.sessions||0}/${tennisWeekTarget} • рейтинговых матчей ${rated}`}:
    x.name==="Знания"?{...x,reason:`чтение ${readingDaysThisWeek()}/${readingWeekTarget} дней • прогресс книги ${Math.round(bookProgress)}% • применений ${applied}`}:x);
  return base
};


function lifeOsEstimateMinutes(area,kind){
  if(area==="Финансы"||area==="Система")return 10;
  if(area==="Работа")return ["activity","pace","pipeline"].includes(kind)?30:20;
  if(area==="Теннис")return kind==="competition"?90:kind==="load"?30:60;
  if(area==="Знания")return kind==="review"?15:kind==="read"?Math.max(15,Math.round(+S.settings.readingDailyMin||30)):20;
  return 15
}

function lifeOsAddCandidate(arr,c){
  if(!c||!String(c.title||"").trim())return;
  arr.push({
    id:String(c.id||[c.area,c.kind,c.title].join(":")),
    area:String(c.area||"Система"),
    kind:String(c.kind||"action"),
    title:String(c.title||""),
    meta:String(c.meta||""),
    score:Math.max(0,+c.score||0),
    hard:!!c.hard,
    route:String(c.route||""),
    projectId:String(c.projectId||""),
    minutes:Math.max(0,Math.round(c.minutes!=null?+c.minutes:lifeOsEstimateMinutes(c.area,c.kind)))
  })
}

function lifeOsRawCandidates(){
  const out=[],today=localDateKey();

  if(typeof decisionEngineData==="function"){
    const f=decisionEngineData();
    for(const x of (f.actions||[]).slice(0,5)){
      lifeOsAddCandidate(out,{
        id:/просроч/i.test(String(x.title||""))?"finance:overdue":/кассов/i.test(String(x.title||""))?"finance:cash-gap":"finance:"+(x.level||"finance")+":"+String(x.title||""),
        area:"Финансы",kind:x.level||"finance",title:x.title,meta:x.meta,
        score:x.level==="bad"?145:x.level==="warn"?105:60,
        hard:x.level==="bad"
      })
    }
    const next=typeof nextDebtEvent==="function"?nextDebtEvent():null;
    if(next){
      const days=daysBetween(new Date(),next.date),overdue=!!next.overdue;
      if(overdue||days<=3)lifeOsAddCandidate(out,{
        id:overdue?"finance:overdue":"finance:deadline:"+String(next.label||""),
        area:"Финансы",kind:"deadline",
        title:(overdue?"Просрочен платёж: ":"Ближайший платёж: ")+next.label,
        meta:rub(next.amount)+" • "+(overdue?"срок был "+fmtDate(next.date):days===0?"сегодня":days===1?"завтра":"через "+days+" дн."),
        score:overdue?155:days===0?145:days===1?132:112,
        hard:overdue||days<=1
      })
    }
  }

  const workActions=typeof workDecisionEngineDeep==="function"?workDecisionEngineDeep():(typeof crmDecisionEngine==="function"?crmDecisionEngine():[]);
  for(const x of workActions.slice(0,6)){
    const kind=String(x.kind||"work");
    const score=kind==="overdue"?135:kind==="pace"?108:kind==="pipeline"?100:kind==="next"?98:kind==="date"?92:kind==="quality"?88:kind==="stale"?82:kind==="close"?78:kind==="activity"?68:72;
    lifeOsAddCandidate(out,{
      area:"Работа",kind,title:x.title,meta:x.meta,score,
      hard:kind==="overdue",id:"work:"+(x.dealId||x.title)
    })
  }

  const tennisActions=typeof tennisDecisionEngineDeep==="function"?tennisDecisionEngineDeep():[];
  for(const x of tennisActions.slice(0,4)){
    const kind=String(x.kind||"tennis");
    const score=kind==="load"?68:kind==="form"?58:kind==="regularity"?54:kind==="competition"?48:kind==="matches"?46:kind==="technique"?42:40;
    lifeOsAddCandidate(out,{area:"Теннис",kind,title:x.title,meta:x.meta,score})
  }

  const knowledgeActions=typeof knowledgeDecisionEngine==="function"?knowledgeDecisionEngine():[];
  for(const x of knowledgeActions.slice(0,5)){
    const kind=String(x.kind||"knowledge");
    const score=kind==="review"?68:kind==="read"?62:kind==="consistency"?52:kind==="book"?46:kind==="capture"?38:kind==="data"?36:kind==="pace"?28:35;
    lifeOsAddCandidate(out,{area:"Знания",kind,title:x.title,meta:x.meta,score})
  }

  const projectActions=typeof projectDecisionEngine==="function"?projectDecisionEngine():[];
  for(const x of projectActions.slice(0,5)){
    lifeOsAddCandidate(out,{
      id:`project:${x.projectId}:${x.kind}`,projectId:x.projectId,area:x.area||"Проекты",kind:x.kind,
      title:x.title,meta:x.meta,score:x.score,hard:!!x.hard,route:"projects",
      minutes:x.minutes||25
    })
  }

  const reviewActions=typeof reviewDecisionEngine==="function"?reviewDecisionEngine():[];
  for(const x of reviewActions.slice(0,3)){
    lifeOsAddCandidate(out,{id:`review:${x.kind}`,area:"Система",kind:x.kind,title:x.title,meta:x.meta,score:x.score,hard:false,route:"reviews",minutes:x.minutes||20})
  }
  const calendarActions=typeof calendarDecisionEngine==="function"?calendarDecisionEngine():[];
  for(const x of calendarActions.slice(0,4)){
    lifeOsAddCandidate(out,{id:x.id,area:x.area||"Система",kind:x.kind,title:x.title,meta:x.meta,score:x.score,hard:!!x.hard,route:"calendar",minutes:x.minutes||15})
  }
  const plannedProjects=typeof reviewPlanCandidates==="function"?reviewPlanCandidates():[];
  for(const x of plannedProjects){
    lifeOsAddCandidate(out,{id:`project:${x.projectId}:plan`,projectId:x.projectId,area:x.area,kind:"project-focus",title:x.title,meta:x.meta,score:x.score,hard:false,route:"projects",minutes:x.minutes||25})
  }

  if(!dailyQuestState("focus",today)){
    lifeOsAddCandidate(out,{area:"Работа",kind:"focus",title:"Один фокус-блок по работе",meta:"Закрыть самое важное рабочее действие без переключений.",score:58,minutes:45})
  }

  if(typeof dataIntegrityIssues==="function"){
    const duplicatedByDomain=/^(Просрочена дата платежа:|CRM без следующего шага:|Неполная карточка ≥500k:)/i;
    for(const x of dataIntegrityIssues().filter(x=>!duplicatedByDomain.test(String(x.title||""))).sort((a,b)=>(a.level==="bad"?0:1)-(b.level==="bad"?0:1)).slice(0,4)){
      lifeOsAddCandidate(out,{
        id:"system:"+String(x.title||""),
        area:"Система",kind:"integrity",title:x.title||"Проверить данные",meta:x.meta||x.detail||"",
        score:x.level==="bad"?140:x.level==="warn"?94:55,
        hard:x.level==="bad",minutes:10
      })
    }
  }
  return out
}

function lifeOsDedupCandidates(rows){
  const seenIds=new Set(),seenTitles=new Set(),seenProjects=new Set(),out=[];
  for(const x of rows.slice().sort((a,b)=>b.score-a.score)){
    const id=String(x.id||""),projectId=String(x.projectId||""),key=(x.area+"|"+x.title).toLocaleLowerCase("ru-RU").replace(/[^a-zа-яё0-9]+/g," ").trim();
    if((id&&seenIds.has(id))||(projectId&&seenProjects.has(projectId))||seenTitles.has(key))continue;
    if(id)seenIds.add(id);if(projectId)seenProjects.add(projectId);seenTitles.add(key);out.push(x)
  }
  const read=out.find(x=>x.area==="Знания"&&x.kind==="read"),review=out.find(x=>x.area==="Знания"&&x.kind==="review");
  if(read&&review){
    const filtered=out.filter(x=>x!==read&&x!==review);
    filtered.push({
      id:"knowledge:combined",area:"Знания",kind:"knowledge",
      title:"Чтение + повторение знаний",
      meta:read.meta+" • "+review.meta,
      score:Math.max(read.score,review.score)+4,hard:false,
      minutes:Math.max(read.minutes,Math.round(+S.settings.readingDailyMin||30))+10
    });
    return filtered.sort((a,b)=>b.score-a.score)
  }
  return out
}

function lifeOsCandidates(){
  let rows=lifeOsDedupCandidates(lifeOsRawCandidates());
  const focusAreas=typeof reviewActivePlan==="function"?new Set(reviewActivePlan()?.focusAreas||[]):new Set();
  if(focusAreas.size)rows=rows.map(x=>focusAreas.has(x.area)?{...x,score:x.score+6}:x).sort((a,b)=>b.score-a.score);
  const load=typeof tennisLoadProfile==="function"?tennisLoadProfile():null;
  const hardElsewhere=rows.some(x=>x.hard&&x.area!=="Теннис");
  if(load?.interpretable&&load.ratio>1.5&&hardElsewhere){
    rows=rows.map(x=>x.area==="Теннис"&&x.kind!=="load"?{...x,score:Math.min(x.score,32),meta:x.meta+" • сегодня приоритет — лёгкая нагрузка/восстановление"}:x)
  }
  return rows.sort((a,b)=>b.score-a.score)
}

function lifeOsDailyPlan(){
  const limit=Math.round(lifeOsSettingNumber("lifeDailyPriorityLimit",4,2,6)),all=lifeOsCandidates(),plan=[],picked=new Set(),hardAll=all.filter(x=>x.hard);
  const add=x=>{if(!x||picked.has(x.id))return;plan.push(x);picked.add(x.id)};
  for(const x of hardAll)add(x);
  const softLimit=Math.max(limit,hardAll.length),areas=new Set(plan.map(x=>x.area));
  for(const x of all)if(plan.length<softLimit&&x.score>=42&&!areas.has(x.area)){add(x);areas.add(x.area)}
  for(const x of all)if(plan.length<softLimit&&x.score>=42)add(x);
  const deferred=all.filter(x=>x.score>=42&&!picked.has(x.id));
  return {
    limit,all,plan,deferred,hardAll,
    minutes:plan.reduce((s,x)=>s+x.minutes,0),
    overload:hardAll.length>limit||all.filter(x=>x.score>=60).length>limit+2
  }
}

function lifeOsDomainState(){
  const s=lifeScore(),rows=[
    {area:"Финансы",score:s.finance,reason:s.details.find(x=>x.name==="Финансы")?.reason||""},
    {area:"Работа",score:s.career,reason:s.details.find(x=>x.name==="Работа")?.reason||""},
    {area:"Теннис",score:s.tennis,reason:s.details.find(x=>x.name==="Теннис")?.reason||""},
    {area:"Знания",score:s.reading,reason:s.details.find(x=>x.name==="Знания")?.reason||""},
    {area:"Система",score:s.discipline,reason:s.details.find(x=>x.name==="Система")?.reason||""}
  ];
  const candidates=lifeOsCandidates();
  for(const r of rows){
    const top=candidates.find(x=>x.area===r.area);
    r.attention=top?.score||0;r.hard=!!top?.hard;r.next=top?.title||"Нет отдельного действия"
  }
  return rows
}

function lifeOsGuardrails(){
  const out=[],plan=lifeOsDailyPlan(),finance=typeof decisionEngineData==="function"?decisionEngineData():null;
  if(finance?.p?.cashGapDate)out.push("До устранения риска кассового разрыва не повышать необязательные расходы.");
  const load=typeof tennisLoadProfile==="function"?tennisLoadProfile():null;
  if(load?.interpretable&&load.ratio>1.5)out.push("Теннисная нагрузка выше собственной 28-дневной базы: следующая сессия должна быть легче обычной.");
  const work=typeof workPaceData==="function"?workPaceData():null;
  if(work&&work.plan>0&&work.paceDelta<0&&typeof crmOverdue==="function"&&crmOverdue().length)out.push("Рабочий фокус: сначала просроченные CRM-шаги, затем наращивание воронки/темпа.");
  const reviews=typeof knowledgeReviewQueue==="function"?knowledgeReviewQueue().length:0;
  if(reviews>=10)out.push("Накопилась очередь повторений: объединить её с сегодняшним чтением, а не создавать отдельный большой блок.");
  if(plan.hardAll.length>=3)out.push("Критичных обязательств много: новые необязательные цели сегодня не добавлять.");
  const calendarOver=typeof calendarOverloadedDays==="function"?calendarOverloadedDays(4):[];
  if(calendarOver.length){const d=calendarOver[0];out.push(`Календарь перегружен ${d.dateKey===localDateKey()?"сегодня":fmtDate(parseLocal(d.dateKey))}: ~${d.minutes} мин плановых обязательств при лимите ${d.capacity} мин.`)}
  if(plan.overload)out.push("День перегружен по модели: выполнить верх плана, остальное сознательно перенести.");
  return out
}

function lifeOsMinimumDay(){
  const plan=lifeOsDailyPlan(),out=[];
  for(const x of plan.plan.filter(x=>x.hard))if(out.length<3)out.push(x);
  const today=localDateKey(),readTarget=Math.max(1,+S.settings.readingDailyMin||30),readToday=(S.readingLogs||[]).filter(x=>x.dateKey===today).reduce((s,x)=>s+(+x.minutes||0),0);
  if(out.length<3&&!dailyQuestState("focus",today)){
    out.push({area:"Работа",title:"1 фокус-блок",meta:"Без переключений на самое важное рабочее действие.",minutes:45})
  }
  if(out.length<3&&readToday<readTarget){
    out.push({area:"Знания",title:"Дневной минимум чтения",meta:"Осталось "+(readTarget-readToday)+" мин.",minutes:readTarget-readToday})
  }
  if(!out.length&&plan.plan[0])out.push(plan.plan[0]);
  return out.slice(0,3)
}

function lifeOsOpen(area,route=""){
  if(route==="projects"||route==="reviews"){ux7Go("more","overview");return}
  if(route==="calendar"){ux7Go("more","overview");setTimeout(()=>projectEl("calendarOsCommand")?.scrollIntoView?.({behavior:"smooth",block:"start"}),180);return}
  if(area==="Финансы"){switchTab("finance");return}
  if(area==="Работа"){ux7Go("work","crm");return}
  if(area==="Теннис"){ux7Go("tennis","analytics");return}
  if(area==="Знания"){ux7Go("more","knowledge");return}
  ux7Go("more","settings")
}


/* Projects OS — outcome -> deadline -> next action.
   Stored under settings.projects for backward-compatible persistence without a schema migration. */

function projectStore(){
  if(!Array.isArray(S.settings.projects))S.settings.projects=[];
  return S.settings.projects
}
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
      <div class="section-title">Цели и проекты</div>
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
        <div class="field"><label>Проект / цель</label><input id="projectTitle" placeholder="Например: выйти на 4,5 млн продаж"></div>
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
  const score=lifeScore(),projects=projectSummary(),life=lifeOsDailyPlan(),finance=typeof decisionEngineData==="function"?decisionEngineData():null;
  if(kind==="month"){
    const r=currentMonthReport(),month=localMonthKey(),readDays=new Set((S.readingLogs||[]).filter(x=>String(x.dateKey||"").startsWith(month)).map(x=>x.dateKey)).size;
    return {
      at:new Date().toISOString(),kind,periodKey:month,lifeScore:Math.round(score.total),
      finance:{income:r.income,expenses:r.expenses,payments:r.payments,cash:r.cash,debt:totalDebt(),cashGap:finance?.p?.cashGapDate||""},
      work:{sales:r.work.sales,contacts:r.work.contacts,proposals:r.work.proposals,plan:+S.settings.workMonthlyPlan||0,crmOverdue:crmOverdue().length},
      tennis:{sessions:r.tennis,tournaments:r.tournaments,target:Math.round(lifeOsSettingNumber("tennisMonthlyTarget",12,1,60))},
      knowledge:{minutes:r.readMinutes,books:r.books,days:readDays,reviewDue:typeof knowledgeReviewQueue==="function"?knowledgeReviewQueue().length:0},
      projects:{...projects,completed:r?projectCompletedThisMonth():0},
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
  projectEl("reviewOsCommand").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Life Score</div><b>${week.lifeScore}</b></div><div class="report-item"><div class="smallcaps">Жёстких действий</div><b>${week.system.hard}</b></div><div class="report-item"><div class="smallcaps">Активных проектов</div><b>${week.projects.active}/${reviewWipLimit()}</b></div><div class="report-item"><div class="smallcaps">Просрочено проектов</div><b class="${week.projects.overdue?"income-bad":""}">${week.projects.overdue}</b></div><div class="report-item"><div class="smallcaps">Обзор недели</div><b>${currentWeek?"✓":"—"}</b></div><div class="report-item"><div class="smallcaps">Обзор месяца</div><b>${currentMonth?"✓":"—"}</b></div></div>`;
  projectEl("reviewWeekCard").innerHTML=`<div class="goal"><div class="goal-top"><span>Продажи</span><b>${compactRub(week.work.sales)}</b></div><div class="goal-top" style="margin-top:6px"><span>CRM просрочено</span><b>${week.work.crmOverdue}</b></div><div class="goal-top" style="margin-top:6px"><span>Теннис</span><b>${week.tennis.sessions}/${week.tennis.target}</b></div><div class="goal-top" style="margin-top:6px"><span>Чтение</span><b>${week.knowledge.days}/${week.knowledge.target} дн.</b></div><div class="goal-top" style="margin-top:6px"><span>Проекты завершены</span><b>${week.projects.completed}</b></div></div><div style="margin-top:10px">${reviewTrendHtml("week")}</div>`;
  projectEl("reviewMonthCard").innerHTML=`<div class="goal"><div class="goal-top"><span>Доход / расходы</span><b>${compactRub(month.finance.income)} / ${compactRub(month.finance.expenses)}</b></div><div class="goal-top" style="margin-top:6px"><span>В долги</span><b>${compactRub(month.finance.payments)}</b></div><div class="goal-top" style="margin-top:6px"><span>Продажи</span><b>${compactRub(month.work.sales)}${month.work.plan?` / ${compactRub(month.work.plan)}`:""}</b></div><div class="goal-top" style="margin-top:6px"><span>Теннис</span><b>${month.tennis.sessions}/${month.tennis.target}</b></div><div class="goal-top" style="margin-top:6px"><span>Чтение</span><b>${month.knowledge.minutes} мин</b></div></div><div style="margin-top:10px">${reviewTrendHtml("month")}</div>`;
  const focus=(plan.focusAreas||[]).map(x=>`<div class="status" style="margin-top:7px"><b>${escapeHtml(x)}</b> — ${escapeHtml(reviewFocusReason(x))}</div>`).join("");
  const projects=(plan.focusProjectIds||[]).map(id=>projectStore().find(p=>p.id===id)).filter(Boolean).map(p=>`<div class="log-item"><div class="qtitle">${escapeHtml(p.title)}</div><div class="qmeta">${escapeHtml(p.area)} • ${p.progress||0}%${p.nextStep?` • ${escapeHtml(p.nextStep)}`:""}</div></div>`).join("");
  const pauseHtml=pause.length?`<div class="title" style="margin-top:12px">Кандидаты на паузу из-за WIP</div>${pause.map(p=>`<div class="log-item"><div class="qtitle">${escapeHtml(p.title)}</div><div class="qmeta">${escapeHtml(p.area)} • ${p.progress||0}% • ${projectPriorityLabel(p.priority)}</div><button class="btn ghost small" style="margin-top:7px" onclick="setProjectStatus('${p.id}','paused')">Поставить на паузу</button></div>`).join("")}`:"";
  projectEl("reviewPlanCard").innerHTML=(focus||'<div class="empty">Фокус появится после накопления данных.</div>')+(projects?`<div class="title" style="margin-top:12px">Фокус-проекты</div>${projects}`:"")+pauseHtml;
  const history=reviewStore().slice().sort((a,b)=>Date.parse(b.savedAt||0)-Date.parse(a.savedAt||0)).slice(0,6);
  projectEl("reviewHistory").innerHTML=history.length?history.map(r=>`<div class="log-item"><div class="qtitle">${r.kind==="week"?"Неделя":"Месяц"} • ${escapeHtml(r.periodKey)}</div><div class="qmeta">Life Score ${r.snapshot?.lifeScore??"—"} • фокусы ${(r.plan?.focusAreas||[]).map(escapeHtml).join(", ")||"—"}</div>${r.wins?`<div class="qmeta">Результат: ${escapeHtml(r.wins)}</div>`:""}</div>`).join(""):'<div class="empty">Сохранённых обзоров пока нет.</div>';
  const wip=projectEl("reviewWipLimit");if(wip&&document.activeElement!==wip)wip.value=String(reviewWipLimit());
  for(const [id,val] of [["reviewWeekWins",currentWeek?.wins||""],["reviewWeekChange",currentWeek?.change||""],["reviewMonthWins",currentMonth?.wins||""],["reviewMonthChange",currentMonth?.change||""]]){const el=projectEl(id);if(el&&!el.dataset.ready){el.value=val;el.dataset.ready="1"}}
}


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

function ensureLifeOsUi(){
  if(document.getElementById("lifeOsCommand"))return;
  const grid=document.querySelector?.("#today .grid");if(!grid)return;
  const anchor=grid.querySelector?.(".quick-card");if(!anchor||typeof anchor.insertAdjacentHTML!=="function")return;
  anchor.insertAdjacentHTML("afterend",
    '<div data-ux7-view="focus" class="card ux7-card span-12">'+
      '<div class="eyebrow">Life OS</div><div class="section-title">Единый центр решений</div>'+
      '<div class="muted" style="margin-top:6px">Жёсткие обязательства имеют приоритет над мягкими целями. После них Life OS ограничивает день несколькими действиями, чтобы список задач не рос бесконечно.</div>'+
      '<div id="lifeOsCommand" style="margin-top:12px"></div>'+
      '<details class="settings-group" style="margin-top:12px"><summary>Правила и настройки Life OS</summary>'+
        '<div id="lifeOsGuardrails" style="margin-top:10px"></div>'+
        '<div class="formgrid" style="margin-top:12px"><div class="field"><label>Максимум приоритетов на день</label><input id="lifeOsPriorityLimit" type="number" min="2" max="6"></div></div>'+
        '<button class="btn secondary" style="margin-top:10px" onclick="saveLifeOsSettings()">Сохранить</button>'+
      '</details>'+
    '</div>'
  )
}

function renderLifeOsCommand(){
  const box=document.getElementById("lifeOsCommand");if(!box)return;
  const p=lifeOsDailyPlan(),domains=lifeOsDomainState(),minimum=lifeOsMinimumDay(),critical=p.hardAll.length;
  const actions=p.plan.map((x,i)=>
    '<div class="quest">'+
      '<span class="tag '+(x.hard?"bad":x.score>=90?"warn":"")+'">#'+(i+1)+' • '+escapeHtml(x.area)+'</span>'+
      '<div class="qbody"><div class="qtitle">'+escapeHtml(x.title)+'</div><div class="qmeta">'+escapeHtml(x.meta)+(x.minutes?' • ~'+x.minutes+' мин':'')+'</div></div>'+
      '<button class="btn ghost small" onclick="lifeOsOpen(\''+escapeHtml(x.area)+'\',\''+escapeHtml(x.route||"")+'\')">Открыть</button>'+
    '</div>'
  ).join("");
  const bars=domains.map(x=>
    '<div><span>'+escapeHtml(x.area)+(x.hard?' • !':'')+'</span><div class="progress"><i style="width:'+clamp(x.score,0,100)+'%"></i></div></div>'
  ).join("");
  const minHtml=minimum.map(x=>'<span class="tag">'+escapeHtml(x.area)+': '+escapeHtml(x.title)+'</span>').join(" ");
  box.innerHTML=
    '<div class="report-grid">'+
      '<div class="report-item"><div class="smallcaps">Приоритетов сегодня</div><b>'+p.plan.length+'/'+p.limit+'</b></div>'+
      '<div class="report-item"><div class="smallcaps">Критичных</div><b class="'+(critical?'income-bad':'income-good')+'">'+critical+'</b></div>'+
      '<div class="report-item"><div class="smallcaps">Оценка активного времени</div><b>~'+p.minutes+' мин</b></div>'+
      '<div class="report-item"><div class="smallcaps">Осознанно отложено</div><b>'+p.deferred.length+'</b></div>'+
    '</div>'+
    '<div class="life-score-bars" style="margin-top:12px">'+bars+'</div>'+
    '<div class="title" style="margin-top:14px">План дня</div>'+
    (actions||'<div class="empty">Критичных или значимых действий модель сейчас не нашла.</div>')+
    '<div class="status" style="margin-top:12px"><b>Минимально достаточный день:</b> '+(minHtml||"сохранить текущий ритм")+'</div>'+
    (p.overload?'<div class="notice" style="margin-top:10px"><b>Перегрузка.</b> Не расширяй план после выполнения верхних приоритетов.</div>':"")
}

function renderLifeOsGuardrails(){
  const box=document.getElementById("lifeOsGuardrails");if(!box)return;
  const g=lifeOsGuardrails();
  box.innerHTML=g.length?g.map(x=>'<div class="notice" style="margin-top:7px">'+escapeHtml(x)+'</div>').join(""):'<div class="status">Специальных ограничений на сегодня модель не обнаружила.</div>'
}

function renderLifeOsSettings(){
  const el=document.getElementById("lifeOsPriorityLimit");if(el&&!el.dataset.ready){el.value=String(Math.round(lifeOsSettingNumber("lifeDailyPriorityLimit",4,2,6)));el.dataset.ready="1"}
}

async function saveLifeOsSettings(){
  const el=document.getElementById("lifeOsPriorityLimit"),n=clamp(Math.round(Number(el?.value)||4),2,6);
  S.settings.lifeDailyPriorityLimit=n;
  audit("Настройки Life OS","system","Приоритетов в день: "+n);
  await save("Настройки Life OS сохранены")
}

function renderLifeOsPanels(){
  if(!document.getElementById("lifeOsCommand"))return;
  renderLifeOsCommand();renderLifeOsGuardrails();renderLifeOsSettings()
}

dailyEngineItems=function(){
  return lifeOsDailyPlan().plan.map(x=>({p:x.score,title:x.title,meta:x.meta+(x.minutes?" • ~"+x.minutes+" мин":""),area:x.area}))
};

renderPriorities=function(){
  const box=$("todayPriorities");if(!box)return;
  const p=lifeOsDailyPlan();
  box.innerHTML=p.plan.slice(0,5).map((x,i)=>
    '<div class="quest"><div class="qbody">'+
      '<span class="tag '+(x.hard?"bad":x.score>=90?"warn":"")+'">#'+(i+1)+' • '+escapeHtml(x.area)+'</span>'+
      '<div class="qtitle" style="margin-top:5px">'+escapeHtml(x.title)+'</div>'+
      '<div class="qmeta">'+escapeHtml(x.meta)+(x.minutes?' • ~'+x.minutes+' мин':'')+'</div>'+
    '</div></div>'
  ).join("")||'<div class="empty">На сегодня критичных задач нет.</div>'
};

const renderTodayLifeOsBase=renderToday;
renderToday=function(){
  renderTodayLifeOsBase();
  ensureLifeOsUi();
  renderLifeOsPanels()
};


ux7InstallShell();

initUi();

loadState();
