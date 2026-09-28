"use strict";

/* Life RPG 12.6 — Review / Feedback OS
   Closes the loop: plan -> observed fact -> diagnosis -> next-week adjustment.
   Uses existing Calibration / Execution / Review evidence. No state migration. */

function feedback126WeekBounds(offset=0){
  const d=addDays(new Date(),offset*7),day=(d.getDay()+6)%7,start=addDays(d,-day),end=addDays(start,6);
  return [localDateKey(start),localDateKey(end)]
}
function feedback126EventDateKey(x){
  if(validDateKey(x?.dateKey))return x.dateKey;
  const d=new Date(x?.ts||x?.at||0);return Number.isFinite(d.getTime())?localDateKey(d):""
}
function feedback126RangeEvents(rows,a,b){return (rows||[]).filter(x=>{const k=feedback126EventDateKey(x);return k&&k>=a&&k<=b})}
function feedback126WeekFact(offset=0){
  const [a,b]=feedback126WeekBounds(offset),c=typeof calibrationState==="function"?calibrationState():{days:{},taskEvents:[],decisionEvents:[]};
  const dayKeys=Object.keys(c.days||{}).filter(k=>validDateKey(k)&&k>=a&&k<=b).sort(),days=dayKeys.map(k=>calibrationDayFact(k));
  const plannedMinutes=days.reduce((n,x)=>n+(+x.plannedMinutes||0),0),completedMinutes=days.reduce((n,x)=>n+(+x.completedMinutes||0),0),plannedTasks=days.reduce((n,x)=>n+(+x.plannedTasks||0),0),completedTasks=days.reduce((n,x)=>n+(+x.completedTasks||0),0),actualTimedMinutes=days.reduce((n,x)=>n+(+x.actualMinutes||0),0);
  const taskEvents=feedback126RangeEvents(c.taskEvents,a,b),rescheduleRows=taskEvents.filter(x=>x.type==="reschedule"||x.type==="reschedule-auto"),manual=rescheduleRows.filter(x=>x.type==="reschedule").length,auto=rescheduleRows.length-manual;
  const repeated=new Map();for(const x of rescheduleRows){const id=String(x.taskId||"");if(id)repeated.set(id,(repeated.get(id)||0)+1)}
  const topRepeated=[...repeated.entries()].sort((x,y)=>y[1]-x[1])[0]||null;
  const decisionEvents=feedback126RangeEvents(c.decisionEvents,a,b),key=x=>`${feedback126EventDateKey(x)}|${String(x.id||"")}`;
  const shown=new Set(decisionEvents.filter(x=>x.type==="shown").map(key)),actions=new Set(decisionEvents.filter(x=>["execute","execute-observed","boost","snooze","hide","never"].includes(x.type)).map(key)),accepted=new Set(decisionEvents.filter(x=>["execute","execute-observed","boost"].includes(x.type)).map(key)),observed=new Set(decisionEvents.filter(x=>x.type==="execute-observed").map(key));
  const execution=typeof executionPlan==="function"?executionPlan():{unscheduled:[],late:[],blocked:[],critical:0};
  return {a,b,days,plannedMinutes,completedMinutes,plannedTasks,completedTasks,actualTimedMinutes,adherence:plannedMinutes?clamp(completedMinutes/plannedMinutes,0,1.5):null,reschedules:rescheduleRows.length,manualReschedules:manual,autoReschedules:auto,topRepeated,shown:shown.size,actions:actions.size,accepted:accepted.size,observed:observed.size,ignored:Math.max(0,shown.size-actions.size),execution:{unscheduled:execution.unscheduled?.length||0,late:execution.late?.length||0,blocked:execution.blocked?.length||0,critical:+execution.critical||0}}
}
function feedback126TaskName(id){const t=typeof taskAll==="function"?taskAll().find(x=>String(x.id)===String(id)):null;return t?.title||"задача"}
function feedback126DataQuality(){
  const tasks=typeof taskAll==="function"?taskAll().filter(x=>x.status==="active"):[],cal=typeof calibrationSummary==="function"?calibrationSummary():{plan:{n:0,ready:false},estimate:{n:0,ready:false},decision:{shown:0}},missingEstimate=tasks.filter(x=>!(+x.minutes>0)).length,missingDates=tasks.filter(x=>!x.plannedDate&&!x.dueDate).length;
  const issues=[];
  if(!cal.plan?.ready)issues.push(`План/факт: ${cal.plan?.n||0}/8 загруженных дней.`);
  if(!cal.estimate?.ready)issues.push(`Точность оценок: ${cal.estimate?.n||0}/5 завершённых задач с таймером.`);
  if((cal.decision?.shown||0)<5)issues.push(`Life OS: мало наблюдений по рекомендациям (${cal.decision?.shown||0}).`);
  if(missingEstimate)issues.push(`У ${missingEstimate} активных задач нет оценки длительности.`);
  if(missingDates)issues.push(`У ${missingDates} активных задач нет ни плановой даты, ни дедлайна.`);
  return {tasks:tasks.length,missingEstimate,missingDates,issues,ready:issues.length===0}
}
function feedback126Insights(){
  const w=feedback126WeekFact(),cal=typeof calibrationSummary==="function"?calibrationSummary():null,q=feedback126DataQuality(),out=[];
  if(w.plannedMinutes>=60&&w.adherence!=null){const p=Math.round(w.adherence*100);if(w.adherence<.6)out.push(`Выполнено ${p}% первоначального task-плана (${w.completedMinutes}/${w.plannedMinutes} мин). Плановая нагрузка заметно выше фактической пропускной способности.`);else if(w.adherence<.8)out.push(`Выполнено ${p}% первоначального task-плана. Есть системный запас для более консервативного планирования.`);else out.push(`Первичный task-план выполняется на ${p}% — текущая ёмкость близка к фактической.`)}
  if(w.reschedules){const top=w.topRepeated?` Чаще всего переносилась «${feedback126TaskName(w.topRepeated[0])}» — ${w.topRepeated[1]} раз.`:"";out.push(`За неделю зафиксировано ${w.reschedules} переносов (${w.manualReschedules} ручных, ${w.autoReschedules} автоматических).${top}`)}
  if(cal?.estimate?.ready){const r=cal.estimate.medianRatio;if(r>1.2)out.push(`По задачам с таймером фактическая длительность в медиане ${r.toFixed(2)}× оценки — оценки систематически занижены.`);else if(r<.8)out.push(`По задачам с таймером фактическая длительность в медиане ${r.toFixed(2)}× оценки — оценки чаще завышены.`);else out.push(`Оценка длительности задач близка к факту: медиана факт/оценка ${r.toFixed(2)}×.`)}
  if(w.shown>=5){out.push(`Life OS показал ${w.shown} приоритетов: реакция была на ${w.actions}, подтверждённое выполнением — ${w.observed}, без реакции — ${w.ignored}.`)}
  if(w.execution.unscheduled||w.execution.late||w.execution.blocked)out.push(`Execution сейчас видит конфликты: не размещено ${w.execution.unscheduled}, просрочено ${w.execution.late}, заблокировано ${w.execution.blocked}.`);
  if(typeof projectActive==="function"&&typeof reviewWipLimit==="function"&&projectActive().length>reviewWipLimit())out.push(`Активных проектов ${projectActive().length} при WIP-лимите ${reviewWipLimit()} — внимание размазано между слишком большим числом потоков.`);
  if(!out.length&&q.issues.length)out.push(`Для надёжных выводов пока не хватает фактов: ${q.issues[0]}`);
  if(!out.length)out.push("Наблюдаемых отклонений, требующих изменения правил, сейчас нет.");
  return out.slice(0,5)
}
function feedback126Recommendations(){
  const w=feedback126WeekFact(),cal=typeof calibrationSummary==="function"?calibrationSummary():null,q=feedback126DataQuality(),out=[];
  const rec=cal?.recommendation;if(rec?.ready&&rec.delta){const dir=rec.delta<0?"снизить":"поднять";out.push({kind:"capacity",title:`${dir[0].toUpperCase()+dir.slice(1)} task-бюджет до ${Math.round(rec.target*100)}%`,meta:rec.reason,action:"tune"})}
  if(cal?.estimate?.ready&&cal.estimate.medianRatio>1.2)out.push({kind:"estimate",title:`Закладывать к первичной оценке примерно ×${cal.estimate.medianRatio.toFixed(2)}`,meta:"Пока как правило оценки, без автоматического переписывания существующих задач."});
  if(w.topRepeated&&w.topRepeated[1]>=2)out.push({kind:"reschedule",title:`Разобрать повторно переносимую задачу «${feedback126TaskName(w.topRepeated[0])}»`,meta:`Переносов за неделю: ${w.topRepeated[1]}. Разбить, снять блокировку или осознанно перенести.`});
  if(typeof reviewPauseCandidates==="function"){const pause=reviewPauseCandidates();if(pause.length)out.push({kind:"wip",title:`Сократить WIP: рассмотреть паузу ${pause.length} проект${pause.length===1?"а":"ов"}`,meta:pause.slice(0,3).map(x=>x.title).join(" • ")})}
  if(!cal?.estimate?.ready)out.push({kind:"data",title:"Накопить факт времени по задачам",meta:`Нужно минимум 5 завершённых задач с таймером; сейчас ${cal?.estimate?.n||0}.`});
  else if(q.missingEstimate)out.push({kind:"data",title:"Заполнить оценки длительности",meta:`Без оценки времени: ${q.missingEstimate} активных задач.`});
  if(!out.length)out.push({kind:"hold",title:"Не менять правила на следующую неделю",meta:"Текущих наблюдений недостаточно для обоснованной коррекции либо система уже близка к факту."});
  return out.slice(0,4)
}
function feedback126RuleChanges(){
  const c=typeof calibrationState==="function"?calibrationState():{decisionEvents:[]},rows=(c.decisionEvents||[]).filter(x=>x.type==="capacity-tune").slice().sort((a,b)=>Date.parse(b.ts||0)-Date.parse(a.ts||0)).slice(0,8),seen=new Set(rows.map(x=>String(x.ts||"")));
  if(c.lastAdjustment?.at&&!seen.has(String(c.lastAdjustment.at)))rows.unshift({type:"capacity-adjustment",ts:c.lastAdjustment.at,before:c.lastAdjustment.before,after:c.lastAdjustment.after,reason:c.lastAdjustment.reason,sample:c.lastAdjustment.sample});
  return rows.slice(0,8)
}
async function feedback126TuneNow(){
  if(typeof calibrationMaybeAutoTune!=="function"){toast("Калибровка недоступна");return}
  const r=await calibrationMaybeAutoTune(true);if(r.changed)toast(`Task-бюджет: ${Math.round(r.before*100)}% → ${Math.round(r.after*100)}%`);else toast(r.reason||"Изменение task-бюджета сейчас не требуется");render()
}
function ensureFeedback126Ui(){
  if(document.getElementById("feedback126Command"))return;
  const grid=document.querySelector?.("#more .grid");if(!grid||typeof grid.insertAdjacentHTML!=="function")return;
  const anchor=document.getElementById("reviewOsCommand")?.closest?.(".card")||document.getElementById("reviewOsCommand");
  const html=`
    <div data-ux7-view="overview" class="card ux7-card span-12"><div class="eyebrow">Review / Feedback OS 12.6</div><div class="section-title">Факт → вывод → коррекция</div><div class="muted" style="margin-top:6px">Слой использует только наблюдаемые данные: первоначальный план, завершения, таймер, переносы, реакции Life OS и изменения task-бюджета.</div><div id="feedback126Command" style="margin-top:12px"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="eyebrow">Diagnosis</div><div class="title">Что реально произошло</div><div id="feedback126Insights" style="margin-top:10px"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="eyebrow">Next week</div><div class="title">Что изменить</div><div id="feedback126Next" style="margin-top:10px"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="eyebrow">Data quality</div><div class="title">Насколько выводы надёжны</div><div id="feedback126Quality" style="margin-top:10px"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="eyebrow">Rule log</div><div class="title">Почему планирование менялось</div><div id="feedback126Changes" style="margin-top:10px"></div></div>`;
  if(anchor&&typeof anchor.insertAdjacentHTML==="function")anchor.insertAdjacentHTML("afterend",html);else grid.insertAdjacentHTML("afterbegin",html)
}
function renderFeedback126(){
  const box=document.getElementById("feedback126Command");if(!box)return;
  const w=feedback126WeekFact(),cal=typeof calibrationSummary==="function"?calibrationSummary():null,q=feedback126DataQuality(),insights=feedback126Insights(),next=feedback126Recommendations(),changes=feedback126RuleChanges(),pctPlan=w.adherence==null?"—":`${Math.round(w.adherence*100)}%`,decision=w.shown?`${w.actions}/${w.shown}`:"—";
  box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Task-план</div><b>${w.completedMinutes}/${w.plannedMinutes} мин</b></div><div class="report-item"><div class="smallcaps">План → факт</div><b>${pctPlan}</b></div><div class="report-item"><div class="smallcaps">Задачи</div><b>${w.completedTasks}/${w.plannedTasks}</b></div><div class="report-item"><div class="smallcaps">Переносы</div><b>${w.reschedules}</b></div><div class="report-item"><div class="smallcaps">Реакции Life OS</div><b>${decision}</b></div><div class="report-item"><div class="smallcaps">Подтверждено выполнением</div><b>${w.observed}</b></div></div><div class="qmeta" style="margin-top:8px">Неделя ${fmtDate(parseLocal(w.a))} — ${fmtDate(parseLocal(w.b))}${w.actualTimedMinutes?` • фактически по таймеру ${w.actualTimedMinutes} мин`:""}</div>`;
  document.getElementById("feedback126Insights").innerHTML=insights.map(x=>`<div class="log-item"><div class="qmeta">${escapeHtml(x)}</div></div>`).join("");
  document.getElementById("feedback126Next").innerHTML=next.map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.title)}</div><div class="qmeta">${escapeHtml(x.meta||"")}</div>${x.action==="tune"?'<button class="btn ghost small" style="margin-top:7px" onclick="feedback126TuneNow()">Применить калибровку</button>':""}</div>`).join("");
  document.getElementById("feedback126Quality").innerHTML=q.ready?'<div class="notice"><b>Данных достаточно.</b> Основные контуры plan/fact, timer и Life OS имеют рабочую выборку.</div>':q.issues.map(x=>`<div class="log-item"><div class="qmeta">${escapeHtml(x)}</div></div>`).join("");
  document.getElementById("feedback126Changes").innerHTML=changes.length?changes.map(x=>{const before=x.before==null?"—":`${Math.round((+x.before||0)*100)}%`,after=x.after==null?"—":`${Math.round((+x.after||0)*100)}%`,date=feedback126EventDateKey(x);return `<div class="log-item"><div class="qtitle">${before} → ${after}</div><div class="qmeta">${date?fmtDate(parseLocal(date)):""}${x.sample!=null?` • выборка ${x.sample}`:""}</div><div class="qmeta">${escapeHtml(x.reason||"Изменение правила")}</div></div>`}).join(""):'<div class="empty">Task-бюджет ещё не менялся по данным калибровки.</div>';
  if(cal?.recommendation?.ready&&cal.recommendation.delta===0){const el=document.getElementById("feedback126Next");if(el&&!next.some(x=>x.action==="tune"))el.insertAdjacentHTML("beforeend",`<div class="notice" style="margin-top:10px"><b>Task-бюджет:</b> ${escapeHtml(cal.recommendation.reason)}</div>`)}
}
