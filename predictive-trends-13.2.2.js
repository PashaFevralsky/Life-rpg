"use strict";

/* Life RPG 13.2.2 — Predictive Trends & Early Warning.
   Local-first, deterministic forecasting layer. It distinguishes risk severity
   from data confidence, stores compact forecast snapshots for later verification,
   and never treats a forecast score as a probability. No external AI/API calls. */

const PREDICTIVE1322_VERSION=1;
const PREDICTIVE1322_HORIZONS=[3,7,14,30];
const PREDICTIVE1322_MAX_SNAPSHOTS=1200;
let PREDICTIVE1322_INTEGRATED=false;
let PREDICTIVE1322_PERSIST_DAY="";

function predictive1322Store(){
  S.settings=S.settings||{};
  let x=S.settings.predictive1322;
  if(!x||typeof x!=="object"||Array.isArray(x))x={};
  if(!Array.isArray(x.snapshots))x.snapshots=[];
  if(!x.ui||typeof x.ui!=="object"||Array.isArray(x.ui))x.ui={horizon:7};
  x.ui.horizon=PREDICTIVE1322_HORIZONS.includes(+x.ui.horizon)?+x.ui.horizon:7;
  x.version=PREDICTIVE1322_VERSION;S.settings.predictive1322=x;return x
}
function predictive1322Num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function predictive1322DateDiff(a,b){try{return Math.max(0,Math.round((parseLocal(b)-parseLocal(a))/86400000))}catch{return null}}
function predictive1322RiskLevel(score){score=clamp(Math.round(predictive1322Num(score)),0,100);return score>=80?"critical":score>=60?"high":score>=40?"watch":"stable"}
function predictive1322RiskRu(level){return level==="critical"?"критично":level==="high"?"высокий":level==="watch"?"наблюдать":"стабильно"}
function predictive1322Trajectory(delta,band=0.08){if(!Number.isFinite(delta))return"неясно";return delta>band?"улучшается":delta<-band?"ухудшается":"стабильно"}
function predictive1322ConfidenceLabel(n){n=clamp(Math.round(predictive1322Num(n)),0,100);return n>=85?"high":n>=65?"medium":"low"}
function predictive1322Area(domain){return ({finance:"Финансы",work:"Работа",system:"Система",training:"Тело",knowledge:"Знания"})[domain]||"Система"}
function predictive1322Route(domain){return domain==="finance"?"finance":domain==="work"?"work":domain==="training"?"training129":domain==="knowledge"?"knowledge":"tasks"}
function predictive1322RangeText(a,b,fmt=x=>String(Math.round(x))){if(!Number.isFinite(a)||!Number.isFinite(b))return"";const lo=Math.min(a,b),hi=Math.max(a,b);return `${fmt(lo)}…${fmt(hi)}`}
function predictive1322Workdays(start,horizon){let n=0;for(let i=0;i<horizon;i++){const d=addDays(start,i),wd=d.getDay();if(wd!==0&&wd!==6)n++}return n}
function predictive1322LatestDate(rows,fields=["dateKey","date","updatedAt","createdAt"]){let best="";for(const x of rows||[])for(const f of fields){const v=String(x?.[f]||"");if(v&&v>best)best=v}return best}
function predictive1322DaysOld(v){if(!v)return null;const d=validDateKey(String(v).slice(0,10))?parseLocal(String(v).slice(0,10)):new Date(v);if(!Number.isFinite(d.getTime()))return null;return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000))}
function predictive1322FreshnessScore(v){const d=predictive1322DaysOld(v);if(d==null)return 45;if(d<=1)return 100;if(d<=3)return 92;if(d<=7)return 82;if(d<=14)return 68;if(d<=30)return 50;return 30}
function predictive1322Reliability(domain,horizon){
  const rows=predictive1322Store().snapshots.filter(x=>x.domain===domain&&+x.horizon===+horizon&&x.verificationStatus==="verified"&&typeof x.directionHit==="boolean").slice(0,40);
  if(rows.length<5)return {n:rows.length,hitRate:null,adjustment:0};
  const hitRate=rows.filter(x=>x.directionHit).length/rows.length,adjustment=Math.round(clamp((hitRate-.65)*20,-12,6));
  return {n:rows.length,hitRate,adjustment}
}
function predictive1322Make(input){
  const horizon=PREDICTIVE1322_HORIZONS.includes(+input.horizon)?+input.horizon:7,rel=predictive1322Reliability(String(input.domain||"system"),horizon),confidence=clamp(Math.round(predictive1322Num(input.confidence,50)+rel.adjustment),20,99),riskScore=clamp(Math.round(predictive1322Num(input.riskScore,0)),0,100);
  return {id:String(input.id||`${input.key}:${horizon}`),key:String(input.key||"risk"),domain:String(input.domain||"system"),horizon,title:String(input.title||"Прогноз"),summary:String(input.summary||""),riskScore,riskLevel:predictive1322RiskLevel(riskScore),confidence,confidenceLabel:predictive1322ConfidenceLabel(confidence),trajectory:String(input.trajectory||"неясно"),timeToRisk:input.timeToRisk==null?null:Math.max(0,Math.round(+input.timeToRisk||0)),requiredPace:String(input.requiredPace||""),range:String(input.range||""),evidence:(input.evidence||[]).filter(Boolean).map(String).slice(0,6),limits:(input.limits||[]).filter(Boolean).map(String).slice(0,4),route:String(input.route||predictive1322Route(input.domain)),observedKey:String(input.observedKey||input.key||""),metric:Number.isFinite(+input.metric)?+input.metric:null,target:Number.isFinite(+input.target)?+input.target:null,reliabilityN:rel.n,reliabilityHitRate:rel.hitRate,reliabilityAdjustment:rel.adjustment}
}

function predictive1322Finance(horizon){
  if(typeof buildFinancialProjection!=="function")return predictive1322Make({key:"finance-buffer",domain:"finance",horizon,title:"Финансовый прогноз недоступен",riskScore:0,confidence:20,limits:["финансовая модель не загружена"]});
  const floor=Math.max(0,+S.settings.minimumCashFloor||0),base=buildFinancialProjection(horizon),low=buildFinancialProjection(horizon,{incomeFactor:90}),high=buildFinancialProjection(horizon,{incomeFactor:110}),verified=typeof accountsModeActive==="function"&&accountsModeActive(),latest=predictive1322LatestDate(S.accounts||[],["verifiedAt","updatedAt","createdAt"]),fresh=predictive1322FreshnessScore(latest),warnings=base.warnings||[];
  let score=15,time=null;
  if(base.cashGapDate){score=96;time=predictive1322DateDiff(localDateKey(),base.cashGapDate)}
  else if(low.cashGapDate){score=72;time=predictive1322DateDiff(localDateKey(),low.cashGapDate)}
  else{const denom=Math.max(1,Math.abs(base.balanceStart)||1),buffer=(base.minBalance-floor)/denom;if(buffer<0)score=88;else if(buffer<.10)score=62;else if(buffer<.25)score=44}
  const conf=clamp(Math.round((verified?82:55)+(fresh-60)*.2-warnings.length*5),30,96),delta=(base.endingBalance-base.balanceStart)/Math.max(1,Math.abs(base.balanceStart));
  const need=Math.max(0,floor-low.minBalance),range=predictive1322RangeText(low.minBalance,high.minBalance,rub);
  return predictive1322Make({key:"finance-buffer",domain:"finance",horizon,title:"Запас до финансового риска",riskScore:score,confidence:conf,trajectory:predictive1322Trajectory(delta),timeToRisk:time,requiredPace:need>0?`консервативному сценарию не хватает ${rub(need)} до защитного остатка`:"текущий буфер выше защитного остатка",range,metric:base.minBalance,target:floor,evidence:[`Минимум базового прогноза: ${rub(base.minBalance)}`,`Остаток на конец: ${rub(base.endingBalance)}`,`Защитный остаток: ${rub(floor)}`,verified?"банковский остаток подтверждён":"банковский остаток не подтверждён"],limits:[...warnings,"Диапазон построен только изменением ожидаемых доходов ±10%; это не вероятностный интервал."]})
}

function predictive1322Work(horizon){
  if(typeof workPaceData!=="function")return predictive1322Make({key:"work-pace",domain:"work",horizon,title:"Прогноз темпа продаж недоступен",riskScore:0,confidence:20,limits:["Work OS не загружен"]});
  const p=typeof work121PaceForecast==="function"?work121PaceForecast():workPaceData(),plan=Math.max(0,+p.plan||0),sales=Math.max(0,+p.sales||0),daily=Math.max(0,+p.daily||0),futureWorkdays=predictive1322Workdays(new Date(),horizon),elapsed=Math.min(+p.total||0,(+p.elapsed||+p.elapsedBefore||0)+futureWorkdays),futureSales=sales+daily*futureWorkdays,expected=plan>0&&p.total>0?plan*elapsed/p.total:0,gap=Math.max(0,expected-futureSales),monthGap=Math.max(0,plan-(+p.paceForecast||futureSales)),coverage=+p.probabilityForecast||0;
  const logs=(S.workLogs||[]).filter(x=>String(x.date||"").startsWith(localMonthKey())),deals=(S.crmDeals||[]).filter(d=>!["Выиграно","Проиграно"].includes(d.stage)),latest=predictive1322LatestDate([...logs,...deals],["date","updatedAt","createdAt"]),fresh=predictive1322FreshnessScore(latest),sample=logs.length+Math.min(10,deals.length),conf=clamp(Math.round(48+Math.min(28,sample*3)+(fresh-60)*.18+(plan>0?8:-15)),25,95);
  let score=plan<=0?5:monthGap<=0?18:gap>0?clamp(50+gap/Math.max(1,plan)*180,50,92):coverage>=plan?38:55;
  const ratio=plan>0?(+p.paceForecast||futureSales)/plan:1,required=Number.isFinite(+p.requiredDaily)?+p.requiredDaily:0,monthEnd=new Date(new Date().getFullYear(),new Date().getMonth()+1,0,12),calendarToMonthEnd=Math.max(0,Math.round((monthEnd-new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),12))/86400000)),time=gap>0?0:(monthGap>0&&calendarToMonthEnd<=horizon?calendarToMonthEnd:null);
  return predictive1322Make({key:"work-pace",domain:"work",horizon,title:"Темп к плану продаж",riskScore:score,confidence:conf,trajectory:ratio>=1?"улучшается":ratio>=.9?"стабильно":"ухудшается",timeToRisk:time,requiredPace:plan>0?`нужно в среднем ${rub(required)}/рабочий день до конца месяца`:"месячный план не задан",range:plan>0?`${rub(futureSales)} к горизонту • ${rub(+p.paceForecast||futureSales)} к концу месяца`:"",metric:+p.paceForecast||futureSales,target:plan,evidence:[`Факт месяца: ${rub(sales)}`,`Текущий средний темп: ${rub(daily)}/рабочий день`,plan>0?`План: ${rub(plan)}`:"План не задан",`Открытых CRM-сделок: ${deals.length}`,coverage?`Взвешенный/CRM-прогноз: ${rub(coverage)}`:""],limits:[sample<3?"мало рабочих наблюдений":"", "Продажи экстраполируются линейно; выполнение Top-3 не конвертируется автоматически в выручку."]})
}

function predictive1322System(horizon){
  const today=localDateKey(),end=localDateKey(addDays(new Date(),horizon)),tasks=typeof taskActive==="function"?taskActive():[],overdue=tasks.filter(t=>typeof taskHealth==="function"&&taskHealth(t).overdue),due=tasks.filter(t=>validDateKey(t.dueDate)&&t.dueDate>=today&&t.dueDate<=end),high=due.filter(t=>+t.priority===1),blocked=due.filter(t=>typeof taskUnresolvedDependencies==="function"&&taskUnresolvedDependencies(t).length),overload=typeof calendarOverloadedDays==="function"?calendarOverloadedDays(horizon):[],firstDates=[...due.map(x=>x.dueDate),...overload.map(x=>x.dateKey)].filter(Boolean).sort(),pressure=overdue.length*20+high.length*13+Math.max(0,due.length-3)*5+overload.length*18+blocked.length*5,score=clamp(10+pressure,5,96),latest=predictive1322LatestDate(tasks,["updatedAt","createdAt"]),conf=clamp(Math.round((tasks.length?72:52)+(predictive1322FreshnessScore(latest)-60)*.15+(tasks.length?8:0)),35,96),near3=tasks.filter(t=>validDateKey(t.dueDate)&&t.dueDate>=today&&t.dueDate<=localDateKey(addDays(new Date(),3))).length;
  return predictive1322Make({key:"system-pressure",domain:"system",horizon,title:"Дедлайны и календарная ёмкость",riskScore:score,confidence:conf,trajectory:due.length>near3+2?"ухудшается":overdue.length||overload.length?"напряжённо":"стабильно",timeToRisk:firstDates.length?predictive1322DateDiff(today,firstDates[0]):null,requiredPace:due.length?`закрывать ~${(due.length/Math.max(1,horizon)).toFixed(1)} задачи/день до горизонта`:"критичных сроков в окне нет",range:`${due.length} задач • ${overload.length} перегруженных дней`,metric:due.length,target:0,evidence:[`Просрочено сейчас: ${overdue.length}`,`Срок в ближайшие ${horizon} дн.: ${due.length}`,`Из них приоритет 1: ${high.length}`,`Перегруженных календарных дней: ${overload.length}`],limits:["Риск отражает давление сроков и ёмкости, а не вероятность невыполнения каждой задачи."]})
}

function predictive1322Training(horizon){
  if(typeof training129Range!=="function")return predictive1322Make({key:"training-balance",domain:"training",horizon,title:"Прогноз нагрузки недоступен",riskScore:0,confidence:20,limits:["Training OS не загружен"]});
  const r7=training129Range(7,0),prev=training129Range(7,7),profile=typeof training129LoadProfile==="function"?training129LoadProfile():{ratio:null,interpretable:false,baseSessions:0},sessions=r7.rows.length,prevSessions=prev.rows.length,loadRatio=profile.interpretable?profile.ratio:null,trend=prev.load>0?(r7.load-prev.load)/prev.load:null;
  let score=18,key="training-balance",title="Баланс тренировочной нагрузки";
  if(loadRatio!=null&&loadRatio>1.5){score=88;key="training-overload";title="Скачок тренировочной нагрузки"}
  else if(loadRatio!=null&&loadRatio>1.3){score=66;key="training-overload";title="Повышенная тренировочная нагрузка"}
  else if(sessions===0&&prevSessions>=2){score=68;key="training-inactivity";title="Риск выпадения из тренировочного ритма"}
  else if(sessions<=1&&prevSessions>=3){score=52;key="training-inactivity";title="Снижение тренировочной регулярности"}
  else if(trend!=null&&trend>.5){score=55;key="training-overload";title="Резкий рост нагрузки"}
  const latest=r7.rows[0]?.dateKey||"",fresh=predictive1322FreshnessScore(latest),quality=typeof training129Quality==="function"?training129Quality():{sessions:typeof training129AllSessions==="function"?training129AllSessions(42).length:0},conf=clamp(Math.round(42+Math.min(28,(quality.sessions||0)*3)+(fresh-60)*.18+(profile.interpretable?15:0)),25,94),traj=trend==null?"неясно":trend>.2?"нагрузка растёт":trend<-.2?"нагрузка снижается":"стабильно";
  const weeklyTarget=Math.max(1,+S.settings.tennisWeeklyTarget||3),need=Math.max(0,weeklyTarget-sessions),range=profile.interpretable?`7д/база ${(loadRatio||0).toFixed(2)}×`:`${sessions} сесс. за 7 дней`;
  return predictive1322Make({key,domain:"training",horizon,title,riskScore:score,confidence:conf,trajectory:traj,timeToRisk:score>=60?0:null,requiredPace:key==="training-inactivity"?`для базовой регулярности не хватает ~${need} сесс. в неделю`:profile.interpretable?`держать 7-дневную нагрузку ближе к устойчивой базе ${Math.round(profile.weeklyBase||0)}`:"сначала накопить ≥4 базовые сессии",range,metric:loadRatio??sessions,target:key==="training-inactivity"?weeklyTarget:1,evidence:[`Сессий 7д: ${sessions}`,`Сессий предыдущие 7д: ${prevSessions}`,`Нагрузка 7д: ${Math.round(r7.load)}`,profile.interpretable?`Отношение к базе: ${(loadRatio||0).toFixed(2)}×`:"28-дневная база пока недостаточна"],limits:["Сигнал нагрузки уже наблюдается сейчас; приложение не прогнозирует медицинский риск травмы."]})
}

function predictive1322Knowledge(horizon){
  if(typeof readingConsistencyData!=="function")return predictive1322Make({key:"knowledge-consistency",domain:"knowledge",horizon,title:"Прогноз чтения недоступен",riskScore:0,confidence:20,limits:["Knowledge OS не загружен"]});
  const cons=readingConsistencyData(28),velocity=typeof readingVelocityData==="function"?readingVelocityData(28):null,targetDays=Math.max(1,+S.settings.readingWeeklyDaysTarget||7),weekly=+cons.weeklyDays||0,ratio=weekly/targetDays,predictedActive=weekly*horizon/7,targetActive=targetDays*horizon/7,logs=(S.readingLogs||[]).filter(x=>x.dateKey>=localDateKey(addDays(new Date(),-28))),latest=predictive1322LatestDate(logs,["dateKey"]),conf=clamp(Math.round(45+Math.min(30,logs.length*3)+(predictive1322FreshnessScore(latest)-60)*.16+(logs.length>=5?10:0)),25,94);
  let score=ratio>=1?18:ratio>=.8?40:ratio>=.5?58:72;if(!logs.length)score=45;
  const recent7=new Set(logs.filter(x=>x.dateKey>=localDateKey(addDays(new Date(),-6))).map(x=>x.dateKey)).size,prior7=new Set(logs.filter(x=>x.dateKey>=localDateKey(addDays(new Date(),-13))&&x.dateKey<localDateKey(addDays(new Date(),-6))).map(x=>x.dateKey)).size,traj=recent7>prior7?"улучшается":recent7<prior7?"ухудшается":"стабильно",need=Math.max(0,targetActive-predictedActive),finish=velocity?.calendarDays!=null?velocity.calendarDays:null;
  return predictive1322Make({key:"knowledge-consistency",domain:"knowledge",horizon,title:"Регулярность чтения",riskScore:score,confidence:conf,trajectory:traj,timeToRisk:score>=60?0:null,requiredPace:`цель ${targetDays} дн./нед${need>0?` • не хватает ~${need.toFixed(1)} активных дней в окне`:""}`,range:finish!=null?`текущая книга ~${finish} календ. дн. при текущем темпе`:`${weekly.toFixed(1)} активных дн./нед`,metric:weekly,target:targetDays,evidence:[`Активных дней/нед.: ${weekly.toFixed(1)}`,`Цель: ${targetDays}`,`Серия: ${cons.streak||0} дн.`,finish!=null?`Оценка завершения текущей книги: ~${finish} дн.`:"недостаточно данных для срока книги"],limits:[logs.length<5?"мало сессий для устойчивой оценки":"","Сигнал регулярности уже наблюдается сейчас; срок книги — линейная экстраполяция текущего темпа, а не обещанная дата."]})
}

function predictive1322Forecasts(horizon=7){
  horizon=PREDICTIVE1322_HORIZONS.includes(+horizon)?+horizon:7;
  return [predictive1322Finance(horizon),predictive1322Work(horizon),predictive1322System(horizon),predictive1322Training(horizon),predictive1322Knowledge(horizon)]
}
function predictive1322AllForecasts(){return PREDICTIVE1322_HORIZONS.flatMap(h=>predictive1322Forecasts(h))}
function predictive1322EarlyWarnings(horizon=7){return predictive1322Forecasts(horizon).filter(x=>x.riskScore>=40&&x.confidence>=55).sort((a,b)=>b.riskScore-a.riskScore||b.confidence-a.confidence)}
function predictive1322ObservedSignal(key){
  if(key==="finance-buffer"){const floor=Math.max(0,+S.settings.minimumCashFloor||0),cash=typeof operatingCashBalance==="function"?operatingCashBalance():Infinity;return cash<floor}
  if(key==="work-pace"){if(typeof work121PaceForecast!=="function")return null;const p=work121PaceForecast();return +p.plan>0&&+p.paceForecast<+p.plan}
  if(key==="system-pressure"){const q=typeof taskSummary==="function"?taskSummary():{overdue:0},d=typeof calendarDayLoad==="function"?calendarDayLoad(localDateKey()):{level:"ok"};return q.overdue>0||d.level==="bad"}
  if(key==="training-overload"){const p=typeof training129LoadProfile==="function"?training129LoadProfile():null;return p?.interpretable?+p.ratio>1.3:null}
  if(key==="training-inactivity"){const r=typeof training129Range==="function"?training129Range(7,0):null;return r?r.rows.length<=1:null}
  if(key==="training-balance")return false;
  if(key==="knowledge-consistency"){if(typeof readingConsistencyData!=="function")return null;const c=readingConsistencyData(28),t=Math.max(1,+S.settings.readingWeeklyDaysTarget||7);return +c.weeklyDays<t*.8}
  return null
}
function predictive1322EvaluateSnapshots(){
  const st=predictive1322Store(),today=localDateKey();let changed=false;
  for(const x of st.snapshots){
    if(x.evaluatedAt||!validDateKey(x.targetDate)||x.targetDate>today)continue;
    if(x.targetDate<today){x.evaluatedAt=new Date().toISOString();x.verificationStatus="expired";x.observed=null;x.directionHit=null;changed=true;continue}
    const observed=predictive1322ObservedSignal(x.key);if(observed==null)continue;x.evaluatedAt=new Date().toISOString();x.verificationStatus="verified";x.observed=!!observed;x.predictedRisk=+x.riskScore>=60;x.directionHit=x.predictedRisk===x.observed;changed=true
  }
  return changed
}
function predictive1322CaptureDaily(){
  const st=predictive1322Store(),today=localDateKey(),exists=st.snapshots.some(x=>x.capturedDate===today);let changed=predictive1322EvaluateSnapshots();
  if(!exists){for(const f of predictive1322AllForecasts())st.snapshots.unshift({id:uid(),capturedAt:new Date().toISOString(),capturedDate:today,targetDate:localDateKey(addDays(new Date(),f.horizon)),key:f.key,domain:f.domain,horizon:f.horizon,riskScore:f.riskScore,confidence:f.confidence,metric:f.metric,target:f.target,trajectory:f.trajectory,evaluatedAt:"",verificationStatus:"pending",observed:null,predictedRisk:f.riskScore>=60,directionHit:null});changed=true}
  st.snapshots=st.snapshots.slice(0,PREDICTIVE1322_MAX_SNAPSHOTS);
  if(changed&&PREDICTIVE1322_PERSIST_DAY!==today&&typeof persist==="function"){PREDICTIVE1322_PERSIST_DAY=today;setTimeout(()=>persist().catch(()=>{}),0)}
  return changed
}
function predictive1322Verification(){
  const all=predictive1322Store().snapshots,rows=all.filter(x=>x.verificationStatus==="verified"&&typeof x.directionHit==="boolean"),expired=all.filter(x=>x.verificationStatus==="expired"),risk=rows.filter(x=>x.predictedRisk),stable=rows.filter(x=>!x.predictedRisk),hit=a=>a.length?a.filter(x=>x.directionHit).length/a.length:null;
  const group=field=>Object.fromEntries([...new Set(rows.map(x=>String(x[field])))].map(k=>{const a=rows.filter(x=>String(x[field])===k);return [k,{n:a.length,hitRate:hit(a)}]}));
  return {n:rows.length,expired:expired.length,directionalAccuracy:hit(rows),riskHitRate:hit(risk),stableHitRate:hit(stable),riskN:risk.length,stableN:stable.length,byDomain:group("domain"),byHorizon:group("horizon"),sufficient:rows.length>=8}
}
function predictive1322RiskMap(){return PREDICTIVE1322_HORIZONS.map(h=>({horizon:h,rows:predictive1322Forecasts(h),maxRisk:Math.max(...predictive1322Forecasts(h).map(x=>x.riskScore),0)}))}
function predictive1322Top3Coverage(){
  const plan=typeof lifeOsDailyPlan==="function"?lifeOsDailyPlan():{plan:[]},top=(plan.plan||[]).slice(0,Math.max(3,(plan.plan||[]).filter(x=>x.hard).length)),areas=new Set(top.map(x=>String(x.area||""))),warnings=predictive1322EarlyWarnings(predictive1322Store().ui.horizon),rows=warnings.map(w=>({...w,covered:areas.has(predictive1322Area(w.domain))||w.domain==="system"&&top.some(x=>x.taskId||String(x.kind||"").includes("calendar"))}));
  return {top,rows,covered:rows.filter(x=>x.covered).length,total:rows.length}
}
function predictive1322Top3Scenario(){
  const c=predictive1322Top3Coverage();
  return {baseline:c.rows.map(x=>({key:x.key,domain:x.domain,riskScore:x.riskScore,riskLevel:x.riskLevel})),afterTop3:c.rows.map(x=>({key:x.key,domain:x.domain,mitigation:x.covered?"covered":"uncovered",note:x.covered?"Top-3 содержит действие этого домена; направление риска может измениться после фактического выполнения.":"В Top-3 нет действия этого домена; базовый риск остаётся без адресного шага."})),quantified:false,reason:"Выполнение действия не переводится в выручку, деньги, нагрузку или чтение без фактического результата."}
}
function predictive1322Candidates(){
  const by=new Map();for(const h of PREDICTIVE1322_HORIZONS)for(const f of predictive1322EarlyWarnings(h)){const old=by.get(f.key);if(!old||f.riskScore>old.riskScore||f.riskScore===old.riskScore&&f.horizon<old.horizon)by.set(f.key,f)}
  return [...by.values()].filter(f=>f.riskScore>=60).slice(0,5).map(f=>({id:`predictive:${f.key}`,area:predictive1322Area(f.domain),kind:"early-warning",title:`Раннее предупреждение: ${f.title}`,meta:`${f.horizon} дн. • риск ${predictive1322RiskRu(f.riskLevel)} • confidence ${f.confidence}%${f.timeToRisk!=null?` • до сигнала ~${f.timeToRisk} дн.`:""}`,score:Math.round(48+f.riskScore*.55),hard:false,route:"predictive1322",source:"Predictive Trends 13.2.2",confidence:f.confidenceLabel,evidence:[...f.evidence,`Прогнозный горизонт: ${f.horizon} дн.`,`Confidence данных: ${f.confidence}%`],consequence:f.summary||f.requiredPace,minutes:10}))
}
function predictive1322OpenRoute(){if(typeof ux7Go==="function")ux7Go("today","focus");setTimeout(()=>document.getElementById("predictive1322Command")?.scrollIntoView?.({behavior:"smooth",block:"start"}),120);return true}
function predictive1322InstallIntegration(){if(PREDICTIVE1322_INTEGRATED)return;PREDICTIVE1322_INTEGRATED=true;if(typeof lifeOsRegisterCandidateProvider==="function")lifeOsRegisterCandidateProvider("predictive1322-early-warning",predictive1322Candidates);if(typeof lifeOsRegisterRouteHandler==="function")lifeOsRegisterRouteHandler("predictive1322",predictive1322OpenRoute)}

function predictive1322SetHorizon(v){const h=+v;if(!PREDICTIVE1322_HORIZONS.includes(h))return;predictive1322Store().ui.horizon=h;if(typeof persist==="function")persist().catch(()=>{});if(typeof render==="function")render()}
function predictive1322RiskClass(x){return x.riskLevel==="critical"?"bad":x.riskLevel==="high"?"warn":""}
function predictive1322RadarHtml(rows){return `<div class="report-grid">${rows.map(x=>`<div class="report-item"><div class="smallcaps">${escapeHtml(predictive1322Area(x.domain))}</div><b class="${predictive1322RiskClass(x)}">${x.riskScore}/100</b><div class="sub">${escapeHtml(predictive1322RiskRu(x.riskLevel))} • ${escapeHtml(x.trajectory)} • conf ${x.confidence}%</div></div>`).join("")}</div>`}
function predictive1322ForecastHtml(x){return `<div class="decision-row ${predictive1322RiskClass(x)}"><div class="split"><b>${escapeHtml(x.title)}</b><span class="tag">${x.horizon}д</span></div><div class="sub">Риск ${x.riskScore}/100 (${escapeHtml(predictive1322RiskRu(x.riskLevel))}) • confidence данных ${x.confidence}% • траектория: ${escapeHtml(x.trajectory)}${x.timeToRisk!=null?` • time-to-risk ~${x.timeToRisk} дн.`:""}</div>${x.range?`<div class="qmeta">Диапазон: ${escapeHtml(x.range)}</div>`:""}${x.requiredPace?`<div class="qmeta"><b>Нужный темп:</b> ${escapeHtml(x.requiredPace)}</div>`:""}<details style="margin-top:6px"><summary>Основания и ограничения</summary>${x.evidence.map(e=>`<div class="sub">• ${escapeHtml(e)}</div>`).join("")}${x.limits.map(e=>`<div class="sub">⚠ ${escapeHtml(e)}</div>`).join("")}</details></div>`}
function predictive1322VerificationHtml(){const v=predictive1322Verification(),pctv=n=>n==null?"—":pct(n*100,0);return `<div class="report-grid"><div class="report-item"><div class="smallcaps">Проверено</div><b>${v.n}</b></div><div class="report-item"><div class="smallcaps">Пропущено</div><b>${v.expired}</b></div><div class="report-item"><div class="smallcaps">Directional hit</div><b>${pctv(v.directionalAccuracy)}</b></div><div class="report-item"><div class="smallcaps">Risk signal</div><b>${pctv(v.riskHitRate)}</b></div><div class="report-item"><div class="smallcaps">Stable signal</div><b>${pctv(v.stableHitRate)}</b></div></div><div class="status" style="margin-top:8px">${v.sufficient?"История используется только для ограниченной корректировки confidence (−12…+6), не для изменения risk score.":"Истории пока мало: метрики проверки не используются для калибровки confidence."} Пропущенная дата проверки не сверяется задним числом с текущим состоянием.</div>`}
function predictive1322RiskMapHtml(){return `<div class="report-grid">${predictive1322RiskMap().map(x=>`<div class="report-item"><div class="smallcaps">${x.horizon} дней</div><b>${x.maxRisk}/100</b><div class="sub">максимальный риск окна</div></div>`).join("")}</div>`}
function predictive1322CoverageHtml(){const c=predictive1322Top3Coverage(),scenario=predictive1322Top3Scenario();if(!c.rows.length)return '<div class="status">Высоких ранних предупреждений в выбранном окне нет.</div>';return `<div class="status"><b>Если ничего не менять:</b> активных предупреждений ${c.total}. <b>Если выполнить Top-3:</b> адресное действие есть для ${c.covered}/${c.total} доменных рисков.</div>${c.rows.map(x=>`<div class="qmeta">${x.covered?"✓":"○"} ${escapeHtml(predictive1322Area(x.domain))}: ${escapeHtml(x.title)} • ${x.covered?"потенциально смягчается":"не покрыт Top-3"}</div>`).join("")}<div class="sub" style="margin-top:8px">${escapeHtml(scenario.reason)} Поэтому альтернативный сценарий показывает покрытие, а не выдуманное новое число риска.</div>`}
function predictive1322Export(){const st=predictive1322Store(),report={format:"life-rpg-predictive-trends-13.2.2",generatedAt:new Date().toISOString(),appVersion:typeof APP_VERSION!=="undefined"?APP_VERSION:"",horizons:PREDICTIVE1322_HORIZONS,forecasts:Object.fromEntries(PREDICTIVE1322_HORIZONS.map(h=>[h,predictive1322Forecasts(h)])),verification:predictive1322Verification(),snapshotCount:st.snapshots.length};const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});if(typeof share131DownloadBlob==="function")share131DownloadBlob(blob,`life-rpg-predictive-${localDateKey()}.json`);else{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`life-rpg-predictive-${localDateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}return report}

function ensurePredictive1322Ui(){
  predictive1322InstallIntegration();if(document.getElementById("predictive1322Command"))return;const anchor=document.getElementById("intelligence1321Control")?.closest?.(".card")||document.getElementById("intelligence132Command")?.closest?.(".card");if(!anchor)return;
  anchor.insertAdjacentHTML("afterend",`<div data-ux7-view="focus" class="card ux7-card span-12"><div class="split"><div><div class="eyebrow">Predictive Trends & Early Warning 13.2.2</div><div class="section-title">Ранние сигналы на 3 / 7 / 14 / 30 дней</div></div><select id="predictive1322Horizon" onchange="predictive1322SetHorizon(this.value)" style="max-width:110px"><option value="3">3 дня</option><option value="7">7 дней</option><option value="14">14 дней</option><option value="30">30 дней</option></select></div><div class="muted" style="margin-top:6px">Risk score показывает серьёзность траектории, confidence — качество данных. Это разные величины. Прогнозы локальные и детерминированные; точные вероятности не выдумываются.</div><div id="predictive1322Command" style="margin-top:12px"></div><details style="margin-top:12px" open><summary>Early Warning Radar</summary><div id="predictive1322Radar" style="margin-top:8px"></div></details><details style="margin-top:12px"><summary>Карта рисков 3/7/14/30</summary><div id="predictive1322RiskMap" style="margin-top:8px"></div></details><details style="margin-top:12px"><summary>Если ничего не менять / покрытие Top-3</summary><div id="predictive1322Coverage" style="margin-top:8px"></div></details><details style="margin-top:12px"><summary>Проверка прогнозов по факту</summary><div id="predictive1322Verification" style="margin-top:8px"></div></details><div class="split" style="margin-top:12px"><button class="btn ghost small" onclick="predictive1322Export()">Отчёт JSON</button></div></div>`)
}
function renderPredictive1322(){
  const box=document.getElementById("predictive1322Command");if(!box)return;predictive1322CaptureDaily();const st=predictive1322Store(),h=st.ui.horizon,select=document.getElementById("predictive1322Horizon");if(select&&document.activeElement!==select)select.value=String(h);const rows=predictive1322Forecasts(h),warnings=rows.filter(x=>x.riskScore>=40&&x.confidence>=55).sort((a,b)=>b.riskScore-a.riskScore);box.innerHTML=warnings.length?warnings.map(predictive1322ForecastHtml).join(""):'<div class="status">На выбранном горизонте нет ранних предупреждений с достаточной confidence.</div>';const set=(id,html)=>{const el=document.getElementById(id);if(el)el.innerHTML=html};set("predictive1322Radar",predictive1322RadarHtml(rows));set("predictive1322RiskMap",predictive1322RiskMapHtml());set("predictive1322Coverage",predictive1322CoverageHtml());set("predictive1322Verification",predictive1322VerificationHtml())
}

predictive1322InstallIntegration();
