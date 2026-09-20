"use strict";

/* Life RPG 8.0.1 — Quests, XP, rewards and life analytics */

const DAILY_QUESTS=[
  {id:"expenses",title:"Записать расходы",stat:"Дисциплина",xp:10},
  {id:"no_credit",title:"Без новых покупок в кредит",stat:"Финансы",xp:20},
  {id:"focus",title:"1 фокус-блок по работе",stat:"Карьера",xp:20},
  {id:"read",title:"Выполнить дневную норму чтения",stat:"Разум",xp:20},
  {id:"walk",title:"Прогулка 30+ минут",stat:"Тело",xp:20},
  {id:"family",title:"1 час семье / себе",stat:"Отношения",xp:20}
];

const GENERAL_WEEKLY=[
  {id:"review",title:"Подвести итоги недели",stat:"Дисциплина",xp:80},
  {id:"read5",title:"5 дней чтения за неделю",stat:"Разум",xp:100,condition:()=>readingDaysThisWeek()>=5},
  {id:"clean_fin",title:"Неделя без новых кредитных покупок",stat:"Финансы",xp:120,condition:()=>dailyQuestCountThisWeek("no_credit")>=7}
];

const REWARDS=[
  {id:"evening",name:"Вечер без обязательных дел",cost:300,paid:false},
  {id:"movie",name:"Фильм / сериал без чувства вины",cost:400,paid:false},
  {id:"food",name:"Любимое блюдо",cost:500,paid:true,rub:1000,gate:true},
  {id:"smallbuy",name:"Покупка до 1 000 ₽",cost:1200,paid:true,rub:1000,gate:true},
  {id:"halfday",name:"Полдня полностью себе",cost:1500,paid:false},
  {id:"hobby",name:"Хобби / развлечение до 2 000 ₽",cost:2200,paid:true,rub:2000,gate:true},
  {id:"bossreward",name:"Большая награда после босса",cost:5000,paid:true,rub:5000,gate:true,requiresClosedDebt:true}
];

const SKILL_NODES={
  "Финансы":[[250,"Контроль","Ведение платежей и бюджета"],[1000,"Долговой охотник","Стабильная досрочка"],[3000,"Свобода","Системное управление деньгами"]],
  "Карьера":[[250,"Поиск","Регулярный новый поток клиентов"],[1000,"ЛПР","Работа с принимающими решения"],[3000,"Закрытие","Системные продажи и переговоры"]],
  "Разум":[[250,"Читатель","Регулярное чтение"],[1000,"Аналитик","Конспекты и применение"],[3000,"Исследователь","Глубокое обучение"]],
  "Теннис":[[250,"Стабильность","Регулярные тренировки"],[1000,"Матчевик","Перенос техники в игру"],[3000,"Турнирный игрок","Системная соревновательная практика"]],
  "Тело":[[250,"Движение","Регулярные прогулки"],[1000,"Выносливость","Стабильная нагрузка"],[3000,"Атлетизм","Системное физическое развитие"]],
  "Отношения":[[250,"Присутствие","Качественное время без отвлечений"],[1000,"Опора","Регулярные совместные дела"],[3000,"Баланс","Стабильное внимание отношениям"]],
  "Дисциплина":[[250,"Ритм","Регулярность без идеальности"],[1000,"Система","Стабильные процессы"],[3000,"Автопилот","Привычки работают без усилий"]]
};

const ACHIEVEMENTS=[
  ["first_debt","Первый босс","Закрыть первый долг","⚔"],
  ["debt100","Минус 100k","Погасить 100 000 ₽ основного долга","💥"],
  ["debt25","Четверть пути","Погасить 25% стартового долга","◔"],
  ["debt50","Экватор","Погасить 50% стартового долга","◐"],
  ["debt75","Последняя четверть","Погасить 75% стартового долга","◕"],
  ["debtfree","Debt Free","Закрыть все долги","🏆"],
  ["stable7","Стабильная неделя","7 активных дней за последние 7","🔥"],
  ["stable20","Системный месяц","20 активных дней из 30","🧱"],
  ["tennis12","Регулярный игрок","12 теннисных сессий","🏓"],
  ["tourney4","Турнирный режим","4 турнира","🥇"],
  ["book1","Первая книга","Закончить книгу","📚"],
  ["books3","Книжный червь","Закончить 3 книги","📖"],
  ["career500","Охотник за сделками","500 XP карьеры","🎯"],
  ["salesplan","План закрыт","Выполнить месячный план продаж","📈"],
  ["debtgoal","Финансовый удар","Выполнить месячную цель по долгам","💳"]
];

function currentMonthReport(){const w=workMonth(),tt=S.tennis.filter(x=>x.dateKey?.startsWith(localMonthKey())),read=S.readingLogs.filter(x=>x.dateKey?.startsWith(localMonthKey())),income=monthIncome(),expenses=monthExpenses(),payments=monthPayments();return {income,expenses,payments,cash:income-expenses-payments,work:w,tennis:tt.length,tournaments:tt.filter(x=>x.type==="Турнир").length,readMinutes:read.reduce((a,x)=>a+(+x.minutes||0),0),books:S.books.filter(b=>b.status==="done"&&String(b.completed||"").startsWith(localMonthKey())).length}}

function availableXp(){return Math.max(0,S.xpEarned-S.xpSpent)}

function level(){return Math.min(100,1+Math.floor(S.xpEarned/XP_PER_LEVEL))}

function rank(l){return l<5?"Новичок":l<10?"Искатель":l<20?"Ветеран":l<35?"Эксперт":l<50?"Мастер":l<75?"Грандмастер":"Легенда"}

function xpEventDate(dateKey=""){return /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey||""))?`${dateKey}T12:00:00`:new Date().toISOString()}

function addXp(xp,stat,label="",sourceId="",kind="",dateKey=""){xp=Math.max(0,Math.round(xp));if(!xp)return;S.xpEarned+=xp;if(stat&&S.stats[stat]!=null)S.stats[stat]+=xp;const inferred=kind||(/закрыт|выполнен.*план|книга закончена|побед|результат/i.test(label)?"result":"process");S.xpEvents.push({id:uid(),date:xpEventDate(dateKey),xp,stat,label,sourceId,kind:inferred})}

function removeXp(xp,stat,label="Откат",sourceId="",dateKey=""){xp=Math.max(0,Math.round(xp));S.xpEarned=Math.max(0,S.xpEarned-xp);if(stat&&S.stats[stat]!=null)S.stats[stat]=Math.max(0,S.stats[stat]-xp);S.xpEvents.push({id:uid(),date:xpEventDate(dateKey),xp:-xp,stat,label,sourceId,kind:"rollback"})}

function activeDay(dateKey){const checks=Object.values(S.checks[dateKey]||{}).some(v=>v===true||v?.done);const w=S.workLogs.some(x=>x.date===dateKey),t=S.tennis.some(x=>x.dateKey===dateKey),r=S.readingLogs.some(x=>x.dateKey===dateKey),p=S.payments.some(x=>(x.localDate||String(x.date||"").slice(0,10))===dateKey);return checks||w||t||r||p}

function stability(days){let n=0,d=new Date();for(let i=0;i<days;i++){if(activeDay(localDateKey(d)))n++;d.setDate(d.getDate()-1)}return n}

function calcStreak(){let n=0,d=new Date();for(let i=0;i<365;i++){if(activeDay(localDateKey(d)))n++;else if(i>0)break;d.setDate(d.getDate()-1)}return n}

function dailyQuestState(qid,date=localDateKey()){return !!S.checks[date]?.[qid]}

async function toggleDaily(qid){const q=DAILY_QUESTS.find(x=>x.id===qid);if(!q)return;const k=localDateKey();S.checks[k]=S.checks[k]||{};const was=!!S.checks[k][qid];S.checks[k][qid]=!was;if(was)removeXp(q.xp,q.stat,`Отмена: ${q.title}`,`daily:${k}:${qid}`);else addXp(q.xp,q.stat,q.title,`daily:${k}:${qid}`);await save(was?"Квест отменён":"Квест выполнен")}

function dailyQuestCountThisWeek(qid){let n=0,d=new Date();const wk=isoWeekKey(d);for(let i=0;i<7;i++){if(isoWeekKey(d)===wk&&dailyQuestState(qid,localDateKey(d)))n++;d.setDate(d.getDate()-1)}return n}

function questKey(group,id,period="weekly"){return `${group}:${period==="monthly"?localMonthKey():isoWeekKey()}:${id}`}

function questTitle(q){return typeof q?.title==="function"?q.title():String(q?.title||"")}

async function claimQuest(group,id){let list=group==="general"?GENERAL_WEEKLY:group==="work"?WORK_WEEKLY:TENNIS_WEEKLY;const q=list.find(x=>x.id===id);if(!q)return;const key=questKey(group,id);if(S.questDone[key])return;if(q.condition&&!q.condition()){toast("Условие ещё не выполнено");return}S.questDone[key]=true;const title=questTitle(q);addXp(q.xp,q.stat,title,key);await save(`+${q.xp} XP`)}

function renderQuestGroup(list,group){return list.map(q=>{const key=questKey(group,q.id),done=!!S.questDone[key],ready=!q.condition||q.condition(),title=questTitle(q);return `<div class="quest"><button class="check ${done?"done":""} ${!ready&&!done?"locked":""}" onclick="claimQuest('${group}','${q.id}')">${done?"✓":ready?"":"·"}</button><div class="qbody"><div class="qtitle">${escapeHtml(title)}</div><div class="qmeta">${escapeHtml(q.stat)}${ready&&!done?" • готово к получению":""}</div></div><div class="xp">+${q.xp} XP</div></div>`}).join("")}

function monthMetrics(mk){const wl=S.workLogs.filter(x=>x.date?.startsWith(mk)),tt=S.tennis.filter(x=>x.dateKey?.startsWith(mk)),rr=S.readingLogs.filter(x=>x.dateKey?.startsWith(mk));return {income:monthIncome(mk),expenses:monthExpenses(mk),payments:monthPayments(mk),sales:wl.reduce((a,x)=>a+(+x.sales||0),0),tennis:tt.length,read:rr.reduce((a,x)=>a+(+x.minutes||0),0)}}

function deltaText(cur,prev,money=false){const d=cur-prev;if(Math.abs(d)<.001)return "без изменения";const p=prev?Math.abs(d/prev*100):0;return `${d>0?"+":"−"}${money?rub(Math.abs(d)):Math.round(Math.abs(d))}${prev?` • ${p.toFixed(0)}%`:""}`}

function renderPersonalAnalytics(){const box=$("personalAnalytics");if(!box)return;const now=localMonthKey(),prev=localMonthKey(new Date(new Date().getFullYear(),new Date().getMonth()-1,1,12)),a=monthMetrics(now),b=monthMetrics(prev);box.innerHTML=`<div class="analytics-grid">${[["Доход",a.income,b.income,true],["Расходы",a.expenses,b.expenses,true],["В долги",a.payments,b.payments,true],["Продажи",a.sales,b.sales,true],["Теннис",a.tennis,b.tennis,false],["Чтение, мин",a.read,b.read,false]].map(x=>`<div class="report-item"><div class="smallcaps">${x[0]}</div><b>${x[3]?rub(x[1]):x[1]}</b><div class="sub">к прошлому месяцу: ${deltaText(x[1],x[2],x[3])}</div></div>`).join("")}</div>`}

function renderDailyEngine(){const box=$("dailyEngine");if(!box)return;const s=lifeScore(),items=dailyEngineItems();box.innerHTML=`<div class="life-score"><div><div class="smallcaps">Life Score</div><div class="metric">${Math.round(s.total)}%</div></div><div class="life-score-bars">${[["Финансы",s.finance],["Карьера",s.career],["Теннис",s.tennis],["Чтение",s.reading],["Ритм",s.discipline]].map(x=>`<div><span>${x[0]}</span><div class="progress"><i style="width:${x[1]}%"></i></div></div>`).join("")}</div></div>${items.map(x=>`<div class="quest"><span class="tag">${x.area}</span><div class="qbody"><div class="qtitle">${escapeHtml(x.title)}</div><div class="qmeta">${escapeHtml(x.meta)}</div></div></div>`).join("")}`}

function renderLifeBosses(){const box=$("lifeBosses");if(!box)return;const debt=debtPct(),plan=+S.settings.workMonthlyPlan||0,sales=plan>0?clamp(workMonth().sales/plan*100,0,100):0,tt=clamp(S.tennis.filter(x=>x.dateKey?.startsWith(localMonthKey())).length/Math.max(1,S.settings.tennisMonthlyTarget||12)*100,0,100),b=currentBook(),book=b?clamp(b.currentPage/b.totalPages*100,0,100):0;box.innerHTML=[["Долги",debt,`${rub(totalDebt())} осталось`],["Продажи",sales,plan>0?`${rub(workMonth().sales)} / ${rub(plan)}`:"план не задан"],["Теннис",tt,`${S.tennis.filter(x=>x.dateKey?.startsWith(localMonthKey())).length}/${S.settings.tennisMonthlyTarget||12} сесс.`],["Книга",book,b?`${b.currentPage}/${b.totalPages} стр.`:"нет активной книги"]].map(x=>`<div class="boss-mini"><div class="goal-top"><b>${x[0]}</b><span>${Math.round(x[1])}%</span></div><div class="progress"><i style="width:${x[1]}%"></i></div><div class="sub">${x[2]}</div></div>`).join("")}

function weeklyReviewData(){const [a,b]=weekBounds(),work=workWeek(),ten=tennisWeek(),reads=S.readingLogs.filter(x=>inRange(x.dateKey,a,b)),readDays=new Set(reads.map(x=>x.dateKey)).size,expenses=S.expenses.filter(x=>inRange(x.dateKey,a,b)).reduce((s,x)=>s+(+x.amount||0),0),payments=S.payments.filter(x=>inRange(x.localDate||String(x.date).slice(0,10),a,b)).reduce((s,x)=>s+(+x.amount||0),0),tips=[],ct=workTarget("contacts",20);if(work.contacts<ct)tips.push(`добавить ${ct-work.contacts} новых контактов`);if(ten.sessions<3)tips.push(`добрать ${3-ten.sessions} трен.`);if(readDays<5)tips.push(`читать ещё ${5-readDays} дн.`);if(crmOverdue().length)tips.push(`разобрать ${crmOverdue().length} просроч. CRM`);return {work,ten,reads,readDays,expenses,payments,tips}}

function renderWeeklyReview(){const box=$("weeklyReview");if(!box)return;const r=weeklyReviewData();box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Новые контакты</div><b>${r.work.contacts}</b></div><div class="report-item"><div class="smallcaps">Продажи</div><b>${rub(r.work.sales)}</b></div><div class="report-item"><div class="smallcaps">Тренировки</div><b>${r.ten.sessions}</b></div><div class="report-item"><div class="smallcaps">Дни чтения</div><b>${r.readDays}</b></div><div class="report-item"><div class="smallcaps">Расходы</div><b>${rub(r.expenses)}</b></div><div class="report-item"><div class="smallcaps">В долги</div><b>${rub(r.payments)}</b></div></div><div class="status" style="margin-top:10px"><b>Фокус:</b> ${r.tips.length?r.tips.join("; "):"сохранить текущий ритм"}</div>`}

function renderXpBreakdown(){const box=$("xpBreakdown");if(!box)return;const m=localMonthKey(),e=S.xpEvents.filter(x=>String(x.date||"").startsWith(m)),process=e.filter(x=>(x.kind||"process")==="process").reduce((a,x)=>a+(+x.xp||0),0),result=e.filter(x=>x.kind==="result").reduce((a,x)=>a+(+x.xp||0),0);box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Process XP</div><b>${process}</b><div class="sub">за действия и регулярность</div></div><div class="report-item"><div class="smallcaps">Result XP</div><b>${result}</b><div class="sub">за достигнутые результаты</div></div></div>`}

function renderToday(){
  const l=level(),r=rank(l),xp=S.xpEarned%XP_PER_LEVEL,xpp=xp/XP_PER_LEVEL*100;$("lvl").textContent=l;$("rankText").textContent=r;$("headerRank").textContent=`Уровень ${l} • ${r}`;$("xpTotal").textContent=S.xpEarned.toLocaleString("ru-RU");$("xpText").textContent=`${xp} / ${XP_PER_LEVEL} XP • доступно ${availableXp()}`;$("xpPct").textContent=Math.round(xpp)+"%";$("xpProgress").style.width=xpp+"%";
  const st7=stability(7),st30=stability(30);$("stabilityText").textContent=`${st7}/7`;$("stability30").textContent=`${st30} из 30 активных дней • серия ${calcStreak()}`;
  const mp=monthPayments(),dp=debtPct(),debtGoal=Math.max(0,+S.settings.monthlyDebtGoal||0);$("monthPaidText").textContent=rub(mp);$("monthProgress").style.width=(debtGoal>0?clamp(mp/debtGoal*100,0,100):0)+"%";$("monthGoalSub").textContent=debtGoal>0?`Цель: ${rub(debtGoal)}`:"Цель не задана";$("debtTotalToday").textContent=rub(totalDebt());$("debtProgressToday").style.width=dp+"%";$("debtPctTextToday").textContent=`Погашено ${dp.toFixed(1)}%`;
  $("statsListToday").innerHTML=statsHtml();$("todayQuestList").innerHTML=DAILY_QUESTS.map(q=>{const done=dailyQuestState(q.id);return `<div class="quest"><button class="check ${done?"done":""}" onclick="toggleDaily('${q.id}')">${done?"✓":""}</button><div class="qbody"><div class="qtitle">${escapeHtml(q.title)}</div><div class="qmeta">${q.stat}</div></div><div class="xp">+${q.xp} XP</div></div>`}).join("");renderPriorities();renderDailyEngine();renderLifeBosses();renderWeeklyReport();renderSeason();renderCalendar();renderAchievements()
}

function statProgress(stat,v){const nodes=SKILL_NODES[stat]||[],thresholds=nodes.map(x=>x[0]).sort((a,b)=>a-b),prev=Math.max(0,...thresholds.filter(x=>x<=v)),next=thresholds.find(x=>x>v);if(!next)return {pct:100,label:`${v} • MAX`};return {pct:clamp((v-prev)/Math.max(1,next-prev)*100,0,100),label:`${v} / ${next}`}}

function statsHtml(){return Object.entries(S.stats).map(([k,v])=>{const p=statProgress(k,+v||0);return `<div class="stat-row"><div class="stat-name">${k}</div><div class="statbar"><i style="width:${p.pct}%"></i></div><div class="stat-xp">${p.label}</div></div>`}).join("")}

function renderPriorities(){const items=[],next=nextDebtEvent();if(next){const days=daysBetween(new Date(),next.date),overdue=!!next.overdue;items.push({p:overdue?"Просрочено":days<=1?"Обязательно":"Важно",t:`${next.label}: ${rub(next.amount)}`,m:overdue?`срок был ${fmtDate(next.date)}`:`срок ${fmtDate(next.date)} • ${days===0?"сегодня":days===1?"завтра":`через ${days} дн.`}`})}const remain=Math.max(0,S.settings.monthlyDebtGoal-monthPayments());if(S.settings.monthlyDebtGoal>0&&remain>0)items.push({p:"Важно",t:`До цели по долгам осталось ${rub(remain)}`,m:"месячный квест"});const ct=workTarget("contacts",20);if(new Date().getDay()!==0&&new Date().getDay()!==6&&workWeek().contacts<ct)items.push({p:"Работа",t:"Добавить новые целевые контакты",m:`на неделе ${workWeek().contacts}/${ct}`});if(tennisWeek().sessions<3)items.push({p:"Теннис",t:"Запланировать тренировку",m:`на неделе ${tennisWeek().sessions}/3`});const readMin=+S.settings.readingDailyMin||30,readToday=S.readingLogs.filter(x=>x.dateKey===localDateKey()).reduce((s,x)=>s+(+x.minutes||0),0);if(readToday<readMin)items.push({p:"Разум",t:`Чтение: ещё ${Math.max(0,readMin-readToday)} мин`,m:`цель ${readMin} мин/день`});$("todayPriorities").innerHTML=items.slice(0,5).map(x=>`<div class="quest"><div class="qbody"><span class="tag ${x.p==="Просрочено"||x.p==="Обязательно"?"bad":x.p==="Важно"?"warn":""}">${x.p}</span><div class="qtitle" style="margin-top:5px">${escapeHtml(x.t)}</div><div class="qmeta">${escapeHtml(x.m)}</div></div></div>`).join("")||`<div class="empty">На сегодня критичных задач нет.</div>`}

function renderCalendar(){let d=new Date();d.setDate(d.getDate()-34);const a=[];for(let i=0;i<35;i++){const k=localDateKey(d),n=[...DAILY_QUESTS].filter(q=>dailyQuestState(q.id,k)).length+(S.workLogs.some(x=>x.date===k)?1:0)+(S.tennis.some(x=>x.dateKey===k)?1:0)+(S.readingLogs.some(x=>x.dateKey===k)?1:0),c=n>=6?"l4":n>=4?"l3":n>=2?"l2":n>=1?"l1":"";a.push(`<div class="day ${c}" title="${k}: ${n} активностей"></div>`);d.setDate(d.getDate()+1)}$("activityCalendar").innerHTML=a.join("")}

function renderWeeklyReport(){const [a,b]=lastNDaysRange(7),p=S.payments.filter(x=>inRange(x.localDate||String(x.date).slice(0,10),a,b)).reduce((n,x)=>n+x.amount,0),t=S.tennis.filter(x=>inRange(x.dateKey,a,b)).length,r=S.readingLogs.filter(x=>inRange(x.dateKey,a,b)).reduce((n,x)=>n+x.minutes,0),w=aggregateWork(S.workLogs.filter(x=>inRange(x.date,a,b))),active=[...Array(7)].filter((_,i)=>activeDay(localDateKey(addDays(new Date(),-i)))).length;$("weeklyReport").innerHTML=[["Долги",rub(p)],["Теннис",`${t} сесс.`],["Чтение",`${r} мин`],["Новые контакты",w.contacts],["Продажи",compactRub(w.sales)],["Активные дни",`${active}/7`]].map(x=>`<div class="report-item"><div class="smallcaps">${x[0]}</div><div style="font-weight:900;margin-top:4px">${x[1]}</div></div>`).join("")}

function currentSeason(){const start=parseLocal(S.settings.campaignStart),now=new Date(),idx=Math.max(0,Math.floor(daysBetween(start,now)/30)),a=addDays(start,idx*30),b=addDays(a,29);return {num:idx+1,start:a,end:b}}

function renderSeason(){const s=currentSeason(),a=localDateKey(s.start),b=localDateKey(s.end),xp=S.xpEvents.filter(x=>inRange(localDateKey(new Date(x.date)),a,b)).reduce((n,x)=>n+x.xp,0),pay=S.payments.filter(x=>inRange(x.localDate||String(x.date).slice(0,10),a,b)).reduce((n,x)=>n+x.amount,0),tt=S.tennis.filter(x=>inRange(x.dateKey,a,b)).length,read=S.readingLogs.filter(x=>inRange(x.dateKey,a,b)).reduce((n,x)=>n+x.minutes,0);$("seasonCard").innerHTML=`<div class="season"><div class="smallcaps">Сезон ${s.num} • ${fmtDate(s.start)} — ${fmtDate(s.end)}</div><div class="report-grid" style="margin-top:10px"><div class="report-item"><b>${xp}</b><div class="sub">XP</div></div><div class="report-item"><b>${rub(pay)}</b><div class="sub">в долги</div></div><div class="report-item"><b>${tt}</b><div class="sub">теннис</div></div><div class="report-item"><b>${read}</b><div class="sub">мин чтения</div></div></div></div>`}

function renderMonthlyLifeReport(){const r=currentMonthReport(),active=stability(Math.min(new Date().getDate(),30));$("monthlyLifeReport").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Доход</div><b>${rub(r.income)}</b></div><div class="report-item"><div class="smallcaps">В долги</div><b>${rub(r.payments)}</b></div><div class="report-item"><div class="smallcaps">Продажи</div><b>${compactRub(r.work.sales)}</b></div><div class="report-item"><div class="smallcaps">Теннис</div><b>${r.tennis} сесс.</b></div><div class="report-item"><div class="smallcaps">Чтение</div><b>${r.readMinutes} мин</b></div><div class="report-item"><div class="smallcaps">Активность</div><b>${active} дн.</b></div></div>`}

function renderSkillTree(){$("skillTree").innerHTML=Object.entries(SKILL_NODES).map(([stat,nodes])=>`<div><div class="qtitle" style="margin-bottom:7px">${stat} • ${S.stats[stat]} XP</div>${nodes.map(([need,title,desc])=>`<div class="skill-node ${S.stats[stat]>=need?"unlocked":""}"><div class="node-title">${S.stats[stat]>=need?"✓ ":"🔒 "}${title}</div><div class="qmeta">${desc} • ${need} XP</div></div>`).join("")}</div>`).join("")}

function renderRewards(){const safe=safeSpendCapacity();$("rewardList").innerHTML=REWARDS.map(r=>{const debtGate=r.gate&&S.settings.monthlyDebtGoal>0&&monthPayments()<S.settings.monthlyDebtGoal,closed=r.requiresClosedDebt&&S.debts.every(d=>d.balance>0),cashGate=r.paid&&(safe==null||safe<(+r.rub||0)),afford=availableXp()>=r.cost,locked=debtGate||closed||cashGate||!afford,reason=debtGate?" • сначала выполни финансовую цель":cashGate?` • безопасно сейчас ${safe==null?"не рассчитано":rub(safe)}`:"";return `<div class="reward"><div><b>${escapeHtml(r.name)}</b><div class="qmeta">${r.cost} XP${r.paid?` • до ${rub(r.rub||0)}`:""}${reason}</div></div><button class="btn ${locked?"ghost":"secondary"} small" onclick="buyReward('${r.id}')" ${locked?"disabled":""}>Взять</button></div>`}).join("")+`<div class="status">Доступно XP: <b>${availableXp()}</b>. Платные награды дополнительно проверяются по безопасной сумме расходов.</div>${S.rewardPurchases?.length?`<div class="title" style="margin-top:14px">Последние награды</div>${S.rewardPurchases.slice().reverse().slice(0,5).map(x=>`<div class="log-item"><div class="qtitle">${new Date(x.date).toLocaleDateString("ru-RU")} • ${escapeHtml(x.name||REWARDS.find(r=>r.id===x.rewardId)?.name||"Награда")}</div><div class="qmeta">${x.cost} XP${x.rub?` • до ${rub(x.rub)}`:""}</div></div>`).join("")}`:""}` }

async function buyReward(id){const r=REWARDS.find(x=>x.id===id);if(!r)return;if(availableXp()<r.cost){toast("Недостаточно XP");return}if(r.gate&&S.settings.monthlyDebtGoal>0&&monthPayments()<S.settings.monthlyDebtGoal){toast("Сначала выполни месячную финансовую цель");return}if(r.requiresClosedDebt&&S.debts.every(d=>d.balance>0)){toast("Сначала закрой хотя бы одного босса");return}if(r.paid){const safe=safeSpendCapacity();if(safe==null){toast("Сначала задай бюджет повседневных расходов");return}if(safe<(+r.rub||0)){toast(`Безопасно потратить сейчас только ${rub(safe)}`);return}}S.xpSpent+=r.cost;S.rewardPurchases.push({id:uid(),rewardId:id,name:r.name,rub:r.rub||0,date:new Date().toISOString(),cost:r.cost});await save("Награда получена")}

function achievementConditions(){const completedBooks=S.books.filter(b=>b.status==="done").length,m=workMonth(),start=startingDebt(),workPlan=+S.settings.workMonthlyPlan||0,debtGoal=+S.settings.monthlyDebtGoal||0,hasDebtHistory=start>0||S.debts.some(d=>(+d.initial||0)>0);return {first_debt:hasDebtHistory&&S.debts.some(d=>(+d.initial||0)>0&&d.balance<=0),debt100:hasDebtHistory&&debtPaid()>=100000,debt25:hasDebtHistory&&debtPct()>=25,debt50:hasDebtHistory&&debtPct()>=50,debt75:hasDebtHistory&&debtPct()>=75,debtfree:hasDebtHistory&&totalDebt()<=0,stable7:stability(7)>=7,stable20:stability(30)>=20,tennis12:S.tennis.length>=12,tourney4:S.tennis.filter(x=>x.type==="Турнир").length>=4,book1:completedBooks>=1,books3:completedBooks>=3,career500:S.stats.Карьера>=500,salesplan:workPlan>0&&m.sales>=workPlan,debtgoal:debtGoal>0&&monthPayments()>=debtGoal}}

function checkAchievements(){const c=achievementConditions();let changed=false;for(const [id,yes] of Object.entries(c))if(yes&&!S.achievements[id]){S.achievements[id]=new Date().toISOString();changed=true}return changed}

function achHtml(limit){const arr=[...ACHIEVEMENTS].sort((a,b)=>(S.achievements[b[0]]?1:0)-(S.achievements[a[0]]?1:0)).slice(0,limit||999);return arr.map(a=>{const open=!!S.achievements[a[0]];return `<div class="ach ${open?"":"locked"}"><div class="ach-ico">${a[3]}</div><div class="ach-title">${a[1]}</div><div class="ach-sub">${a[2]}</div>${open?`<div class="xp" style="display:inline-block;margin-top:8px">${fmtDate(new Date(S.achievements[a[0]]))}</div>`:""}</div>`}).join("")}

function renderAchievements(){$("homeAchievements").innerHTML=achHtml(4);$("allAchievements").innerHTML=achHtml()}

function renderSeasonHistory(){const start=parseLocal(S.settings.campaignStart),now=new Date(),count=Math.max(1,Math.floor(daysBetween(start,now)/30)+1),cards=[];for(let idx=Math.max(0,count-6);idx<count;idx++){const a=addDays(start,idx*30),b=addDays(a,29),ak=localDateKey(a),bk=localDateKey(b),xp=S.xpEvents.filter(x=>inRange(localDateKey(new Date(x.date)),ak,bk)).reduce((n,x)=>n+x.xp,0),pay=S.payments.filter(x=>inRange(x.localDate||String(x.date).slice(0,10),ak,bk)).reduce((n,x)=>n+x.amount,0),tt=S.tennis.filter(x=>inRange(x.dateKey,ak,bk)).length,read=S.readingLogs.filter(x=>inRange(x.dateKey,ak,bk)).reduce((n,x)=>n+x.minutes,0);cards.push(`<div class="season" style="margin-bottom:8px"><div class="smallcaps">Сезон ${idx+1} • ${fmtDate(a)} — ${fmtDate(b)}</div><div class="split" style="margin-top:8px"><span class="tag">${xp} XP</span><span class="tag">${rub(pay)} в долги</span><span class="tag">${tt} теннис</span><span class="tag">${read} мин чтения</span></div></div>`)}$("seasonHistory").innerHTML=cards.reverse().join("")}

function dailyEngineItems(){const a=[],fd=decisionEngineData();for(const x of fd.actions.slice(0,2))a.push({p:x.level==="bad"?110:95,title:x.title,meta:x.meta,area:"Финансы"});const cd=crmOverdue();if(cd.length)a.push({p:90,title:`CRM: ${cd[0].name}`,meta:cd[0].nextStep||"Просрочен следующий шаг",area:"Работа"});const wp=workMonth(),plan=S.settings.workMonthlyPlan||0;if(plan>0&&wp.sales<plan){const dayNeed=Math.max(0,plan-wp.sales)/Math.max(1,workingDaysLeft());a.push({p:70,title:`Продажи: цель дня ${rub(dayNeed)}`,meta:`месяц ${pct(wp.sales/plan*100,0)}`,area:"Работа"})}if(tennisWeek().sessions<3)a.push({p:50,title:"Теннис: запланировать тренировку",meta:`неделя ${tennisWeek().sessions}/3`,area:"Теннис"});const readTarget=Math.max(1,+S.settings.readingDailyMin||30),readToday=S.readingLogs.filter(x=>x.dateKey===localDateKey()).reduce((s,x)=>s+(+x.minutes||0),0);if(readToday<readTarget)a.push({p:40,title:`Чтение: ещё ${readTarget-readToday} мин`,meta:`сегодня ${readToday}/${readTarget} мин`,area:"Разум"});return a.sort((x,y)=>y.p-x.p).slice(0,5)}

function lifeScore(){const health=financialHealthData(),finance=health.p.cashGapDate?20:health.fresh==null?35:health.fresh>7?55:80,career=S.settings.workMonthlyPlan>0?clamp(workMonth().sales/S.settings.workMonthlyPlan*100,0,100):50,tennis=clamp(S.tennis.filter(x=>x.dateKey?.startsWith(localMonthKey())).length/Math.max(1,S.settings.tennisMonthlyTarget||12)*100,0,100),reading=clamp(readingDaysThisWeek()/5*100,0,100),discipline=clamp(stability(7)/7*100,0,100);return {finance,career,tennis,reading,discipline,total:(finance+career+tennis+reading+discipline)/5}}
