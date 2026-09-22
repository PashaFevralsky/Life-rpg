"use strict";

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
  const taskActions=typeof taskDecisionEngine==="function"?taskDecisionEngine():[];
  for(const x of taskActions.slice(0,8))lifeOsAddCandidate(out,x);
  const inboxActions=typeof inboxDecisionEngine==="function"?inboxDecisionEngine():[];
  for(const x of inboxActions.slice(0,2))lifeOsAddCandidate(out,x);
  const ruleActions=typeof ruleEngineActions==="function"?ruleEngineActions():[];
  for(const x of ruleActions.slice(0,4))lifeOsAddCandidate(out,x);
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
  if(route==="projects"||route==="reviews"||route==="rules"||route==="insights"){ux7Go("more","overview");return}
  if(route==="calendar"){ux7Go("more","overview");setTimeout(()=>document.getElementById("calendarOsCommand")?.scrollIntoView?.({behavior:"smooth",block:"start"}),180);return}
  if(route==="tasks"||route==="inbox"){ux7Go("today","focus");setTimeout(()=>document.getElementById(route==="tasks"?"tasksOsCommand":"inboxOsCommand")?.scrollIntoView?.({behavior:"smooth",block:"center"}),180);return}
  if(area==="Финансы"){switchTab("finance");return}
  if(area==="Работа"){ux7Go("work","crm");return}
  if(area==="Теннис"){ux7Go("tennis","analytics");return}
  if(area==="Знания"){ux7Go("more","knowledge");return}
  ux7Go("more","settings")
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
