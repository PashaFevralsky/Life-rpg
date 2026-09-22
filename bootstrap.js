"use strict";

/* Life RPG 10.0.2 — Runtime bootstrap + Life OS Command Center */

const ux7BaseRender=render;

render=function(){ux7BaseRender();ensureProjectsOsUi();renderProjectsOs();requestAnimationFrame(()=>{renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();for(const id of Object.keys(UX7_META))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false);window.LifePlatform?.refreshIcons?.()})};

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
      id:`project:${x.projectId}:${x.kind}`,area:x.area||"Проекты",kind:x.kind,
      title:x.title,meta:x.meta,score:x.score,hard:!!x.hard,route:"projects",
      minutes:x.minutes||25
    })
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
  const seenIds=new Set(),seenTitles=new Set(),out=[];
  for(const x of rows.slice().sort((a,b)=>b.score-a.score)){
    const id=String(x.id||""),key=(x.area+"|"+x.title).toLocaleLowerCase("ru-RU").replace(/[^a-zа-яё0-9]+/g," ").trim();
    if((id&&seenIds.has(id))||seenTitles.has(key))continue;
    if(id)seenIds.add(id);seenTitles.add(key);out.push(x)
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
  if(route==="projects"){ux7Go("more","overview");return}
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
