"use strict";

/* Life RPG 13.2 / 13.2.1 — Decision Intelligence Kernel.
   Local-first decision support: evidence, confidence, cross-domain arbitration,
   outcome learning, anomalies, counterfactuals, scenarios and a compact journal.
   It does not call external AI services and does not change STATE_VERSION. */

const INTEL132_VERSION=1;
const INTEL132_MAX_JOURNAL=300;
const INTEL132_MAX_STATE=500;
let INTEL132_INTEGRATED=false;

function intelligence132Store(){
  S.settings=S.settings||{};
  let x=S.settings.intelligence132;
  if(!x||typeof x!=="object"||Array.isArray(x))x={};
  if(!Array.isArray(x.journal))x.journal=[];
  if(!x.candidateState||typeof x.candidateState!=="object"||Array.isArray(x.candidateState))x.candidateState={};
  if(!x.scenario||typeof x.scenario!=="object"||Array.isArray(x.scenario))x.scenario={spend:0,incomeFactor:100,trainingMinutes:0,trainingRpe:4,extraWorkMinutes:0,extraKnowledgeMinutes:0};
  x.version=INTEL132_VERSION;S.settings.intelligence132=x;return x
}
function intelligence132Now(){return new Date().toISOString()}
function intelligence132Finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function intelligence132Clamp(v,a=0,b=100){return clamp(intelligence132Finite(v,0),a,b)}
function intelligence132DateOf(x){return String(x?.dateKey||x?.date||x?.updatedAt||x?.createdAt||x?.at||x?.ts||"")}
function intelligence132DaysSince(v){if(!v)return null;let d;if(validDateKey(String(v).slice(0,10)))d=parseLocal(String(v).slice(0,10));else d=new Date(v);if(!Number.isFinite(d?.getTime?.()))return null;return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000))}
function intelligence132Median(a){const x=(a||[]).map(Number).filter(Number.isFinite).sort((m,n)=>m-n);if(!x.length)return null;const i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2}
function intelligence132Sum(a,fn=x=>+x||0){return (a||[]).reduce((s,x)=>s+intelligence132Finite(fn(x),0),0)}
function intelligence132ConfidenceLabel(n){n=intelligence132Clamp(n);return n>=85?"high":n>=65?"medium":"low"}
function intelligence132ConfidenceRu(n){return n>=85?"высокая":n>=65?"средняя":"низкая"}
function intelligence132PriorityTier(n){return n>=90?"critical":n>=60?"high":n>=42?"active":"low"}
function intelligence132TierThreshold(t){return t==="critical"?90:t==="high"?60:t==="active"?42:0}
function intelligence132AreaKey(area){return ({"Финансы":"finance","Работа":"work","Теннис":"tennis","Тело":"training","Знания":"knowledge","Система":"system"})[area]||"other"}
function intelligence132Signature(x){return `${intelligence132AreaKey(x.area)}|${String(x.kind||"action").replace(/\d+/g,"#")}`}

function intelligence132CandidateDate(x){
  if(x.taskId&&typeof taskAll==="function"){const t=taskAll().find(t=>String(t.id)===String(x.taskId));return t?.updatedAt||t?.dueDate||t?.createdAt||""}
  if(String(x.id||"").startsWith("work:")&&Array.isArray(S.crmDeals)){const id=String(x.id).slice(5),d=S.crmDeals.find(z=>String(z.id)===id);return d?.updatedAt||d?.lastContactAt||d?.nextDate||d?.createdAt||""}
  if(x.area==="Финансы"){
    const rows=[...(S.accounts||[]),...(S.expenses||[]),...(S.incomeLogs||[]),...(S.payments||[])];let best="";
    for(const r of rows){const d=intelligence132DateOf(r);if(d&&String(d)>String(best))best=d}return best
  }
  if(x.area==="Теннис"||x.area==="Тело"){const rows=[...(S.tennis||[]),...(S.entities?.trackingEvents||[])];let best="";for(const r of rows){const d=intelligence132DateOf(r);if(d&&String(d)>String(best))best=d}return best}
  if(x.area==="Знания"){let best="";for(const r of S.readingLogs||[]){const d=intelligence132DateOf(r);if(d&&String(d)>String(best))best=d}return best}
  return x.updatedAt||x.dateKey||""
}
function intelligence132Freshness(x){
  const days=intelligence132DaysSince(intelligence132CandidateDate(x));
  if(days==null)return {score:x.hard?80:60,days:null,label:"дата источника не указана"};
  const score=days<=1?100:days<=3?92:days<=7?82:days<=14?68:days<=30?52:days<=60?35:20;
  return {score,days,label:days===0?"сегодня":days===1?"1 день назад":`${days} дн. назад`}
}
function intelligence132Observations(x){
  if(x.area==="Работа")return (S.workLogs||[]).filter(r=>validDateKey(r.date)&&r.date>=localDateKey(addDays(new Date(),-42))).length;
  if(x.area==="Финансы")return (S.expenses||[]).filter(r=>validDateKey(String(r.dateKey||r.date||"").slice(0,10))&&String(r.dateKey||r.date).slice(0,10)>=localDateKey(addDays(new Date(),-30))).length+(S.incomeLogs||[]).filter(r=>validDateKey(String(r.dateKey||r.date||"").slice(0,10))).length;
  if(x.area==="Теннис"||x.area==="Тело")return typeof training129Quality==="function"?training129Quality().sessions:(S.tennis||[]).length;
  if(x.area==="Знания")return (S.readingLogs||[]).filter(r=>r.dateKey>=localDateKey(addDays(new Date(),-42))).length;
  if(x.taskId&&typeof taskAll==="function")return taskAll().length;
  return 1
}
function intelligence132Evidence(x){
  const rows=[];
  for(const v of Array.isArray(x.evidence)?x.evidence:[])if(String(v||"").trim())rows.push(String(v).trim());
  if(String(x.meta||"").trim())rows.push(String(x.meta).trim());
  const fresh=intelligence132Freshness(x);rows.push(`Свежесть данных: ${fresh.label}`);
  const n=intelligence132Observations(x);if(n>1)rows.push(`Наблюдений по домену: ${n}`);
  return [...new Set(rows)].slice(0,6)
}
function intelligence132Unknowns(x){
  const out=[],fresh=intelligence132Freshness(x),n=intelligence132Observations(x);
  if(fresh.days==null)out.push("неизвестна дата обновления основного источника");
  else if(fresh.days>30)out.push("основные данные старше 30 дней");
  if(n<3&&!x.hard)out.push("мало наблюдений для персональной калибровки");
  if(x.area==="Финансы"&&typeof accountsModeActive==="function"&&!accountsModeActive())out.push("нет подтверждённой точки банковского остатка");
  if((x.area==="Теннис"||x.area==="Тело")&&typeof training129LoadProfile==="function"&&!training129LoadProfile().interpretable)out.push("нагрузка ещё не сравнима с устойчивой 28-дневной базой");
  return out.slice(0,4)
}
function intelligence132ConfidenceScore(x){
  const label=String(x.confidence||"").toLowerCase(),base=label==="high"?88:label==="low"?48:label==="medium"?70:(x.hard?90:68),fresh=intelligence132Freshness(x),e=intelligence132Evidence(x),unknown=intelligence132Unknowns(x),n=intelligence132Observations(x);
  let q=base+Math.min(8,e.length*2)+(fresh.score-60)*.18+(n>=12?6:n>=6?3:n<3?-5:0)-unknown.length*6;
  return Math.round(intelligence132Clamp(q,25,99))
}
function intelligence132Urgency(x){
  const k=String(x.kind||"").toLowerCase(),s=+x.score||0;
  if(x.hard)return 100;if(/overdue|cash-gap|просроч/.test(k+" "+x.title))return 98;if(/deadline|today|payment|task-planned/.test(k))return 90;if(/tomorrow/.test(k))return 78;if(/pace|pipeline|integrity|execution/.test(k))return 68;if(/load|recovery/.test(k))return 62;if(/review|read|knowledge/.test(k))return 42;return intelligence132Clamp(s*.65,35,82)
}
function intelligence132Impact(x){
  const k=String(x.kind||"").toLowerCase(),base=intelligence132Clamp((+x.score||0)*.62,30,92);
  let add=0;if(x.area==="Финансы")add+=10;if(x.area==="Работа"&&/overdue|pipeline|pace|next|close/.test(k))add+=10;if(x.taskId)add+=5;if(/integrity|goal/.test(k))add+=5;if(/capture|data/.test(k))add-=10;return Math.round(intelligence132Clamp(base+add,20,98))
}
function intelligence132Risk(x){
  const k=(String(x.kind||"")+" "+String(x.title||"")).toLowerCase();if(x.hard)return 100;if(/cash-gap|кассов|overdue|просроч/.test(k))return 96;if(/deadline|payment|плат[её]ж/.test(k))return 88;if(/integrity|late|blocked/.test(k))return 78;if(/load|recovery/.test(k))return 70;if(/pace|pipeline|goal/.test(k))return 65;return 45
}
function intelligence132Effort(x){const m=Math.max(0,+x.minutes||0);return Math.round(intelligence132Clamp(m/120*100,4,100))}

function intelligence132LatestOutcome(id){return intelligence132Store().journal.find(j=>j.candidateId===String(id)&&j.outcome)||null}
function intelligence132LearnedAdjustment(x){
  const sig=intelligence132Signature(x);let rows=intelligence132Store().journal.filter(j=>j.signature===sig&&j.outcome);if(typeof intelligence1321FilterLearningRows==="function")rows=intelligence1321FilterLearningRows(rows);const policy=typeof intelligence1321LearningPolicy==="function"?intelligence1321LearningPolicy():{minOutcomeSamples:3,learningCap:8};if(rows.length<policy.minOutcomeSamples)return {adjustment:0,n:rows.length,rate:null,overrideAdjustment:0};
  const vals=rows.slice(0,30).map(j=>j.outcome==="helped"?1:j.outcome==="done"?.35:j.outcome==="no-effect"?-1:j.outcome==="missed"?-.5:0),avg=vals.reduce((a,b)=>a+b,0)/vals.length,base=Math.round(clamp(avg*10,-policy.learningCap,policy.learningCap)),override=typeof intelligence1321OverrideAdjustment==="function"?intelligence1321OverrideAdjustment(x):0,adj=Math.round(clamp(base+override,-policy.learningCap,policy.learningCap));return {adjustment:adj,n:vals.length,rate:avg,overrideAdjustment:override}
}
function intelligence132Context(rows=[]){
  const hard=rows.filter(x=>x.hard).length,finance=typeof decisionEngineData==="function"?decisionEngineData():null,load=typeof training129LoadProfile==="function"?training129LoadProfile():null,over=typeof calendarOverloadedDays==="function"?calendarOverloadedDays(3):[];
  return {hard,cashGap:!!finance?.p?.cashGapDate,cashGapDate:finance?.p?.cashGapDate||"",trainingRatio:load?.interpretable?load.ratio:null,calendarOver:over,calendarOverToday:over.some(x=>x.dateKey===localDateKey())}
}
function intelligence132ConflictAdjustment(x,ctx){
  let adjustment=0;const notes=[],k=String(x.kind||"").toLowerCase();
  if(ctx.hard>=3&&!x.hard){adjustment-=12;notes.push("много жёстких обязательств — мягкие действия понижены")}
  if(ctx.calendarOverToday&&!x.hard&&(+x.minutes||0)>=45){adjustment-=10;notes.push("сегодняшняя календарная ёмкость перегружена")}
  if(ctx.trainingRatio!=null&&ctx.trainingRatio>1.5&&(x.area==="Теннис"||x.area==="Тело")&&!/load|recovery/.test(k)){adjustment-=18;notes.push(`нагрузка ${ctx.trainingRatio.toFixed(2)}× базы — интенсивные спортивные действия понижены`)}
  if(ctx.cashGap&&!x.hard&&/spend|purchase|buy|покуп|расход/.test(k+" "+x.title)){adjustment-=30;notes.push("есть риск кассового разрыва — необязательные траты блокируются мягким правилом")}
  if(ctx.calendarOverToday&&x.area==="Работа"&&/overdue|deadline/.test(k)){adjustment+=5;notes.push("срочный рабочий дедлайн удержан несмотря на перегрузку дня")}
  return {adjustment,notes}
}
function intelligence132Hysteresis(x,score){
  const store=intelligence132Store(),st=store.candidateState[String(x.id)]||{},prevTier=st.tier||"low",newTier=intelligence132PriorityTier(score),order={low:0,active:1,high:2,critical:3};let out=score;
  if(order[newTier]<order[prevTier]){const th=intelligence132TierThreshold(prevTier);if(th-score<=6)out=th+1}
  store.candidateState[String(x.id)]={score:Math.round(out),tier:intelligence132PriorityTier(out),lastSeen:intelligence132Now()};
  const keys=Object.keys(store.candidateState);if(keys.length>INTEL132_MAX_STATE)for(const k of keys.sort((a,b)=>String(store.candidateState[a]?.lastSeen||"").localeCompare(String(store.candidateState[b]?.lastSeen||""))).slice(0,keys.length-INTEL132_MAX_STATE))delete store.candidateState[k];
  return out
}
function intelligence132Counterfactual(x,m){
  if(x.hard)return "Рекомендация перестанет быть жёсткой после закрытия обязательства или переноса подтверждённого срока.";
  const parts=[];if(m.urgency>=80)parts.push("снизится срочность/будет отодвинут срок");if(m.risk>=80)parts.push("исчезнет риск невыполнения");if(m.confidence<65)parts.push("появятся более свежие или полные данные");if(m.effort>=65)parts.push("действие станет короче либо появится свободная ёмкость");if(m.conflictNotes.length)parts.push("исчезнет междоменный конфликт");return parts.length?`Приоритет заметно изменится, если ${parts.slice(0,3).join("; ")}.`:"Приоритет изменится, если появится более срочное действие или изменятся факты домена."
}
function intelligence132EnrichCandidate(x,ctx){
  const base=Math.max(0,+x.score||0),urgency=intelligence132Urgency(x),impact=intelligence132Impact(x),risk=intelligence132Risk(x),confidence=intelligence132ConfidenceScore(x),effort=intelligence132Effort(x),fresh=intelligence132Freshness(x),learn=intelligence132LearnedAdjustment(x),conflict=intelligence132ConflictAdjustment(x,ctx),latest=intelligence132LatestOutcome(x.id);
  let score=base*.5+urgency*.22+impact*.16+risk*.18+confidence*.07-effort*.06+learn.adjustment+conflict.adjustment;
  if(x.hard)score=Math.max(score,120);
  if(latest&&!x.hard&&["done","helped"].includes(latest.outcome)&&Date.now()-Date.parse(latest.outcomeAt||latest.at||0)<86400000)score=Math.min(score,28);
  score=intelligence132Hysteresis(x,Math.round(intelligence132Clamp(score,0,160)));
  const result={...x,baseScore:base,score:Math.round(score),priorityScore:Math.round(score),urgency,impact,risk,confidenceScore:confidence,confidence:intelligence132ConfidenceLabel(confidence),freshness:fresh.score,freshnessLabel:fresh.label,effortCost:effort,learningAdjustment:learn.adjustment,learningSamples:learn.n,conflictAdjustment:conflict.adjustment,conflictNotes:conflict.notes,ruleType:x.hard?"hard":"soft",evidence:intelligence132Evidence(x),unknowns:intelligence132Unknowns(x)};
  result.counterfactual=intelligence132Counterfactual(result,{urgency,impact,risk,confidence,effort,conflictNotes:conflict.notes});return result
}
function intelligence132RankCandidates(rows){const ctx=intelligence132Context(rows);return (rows||[]).map(x=>intelligence132EnrichCandidate(x,ctx)).sort((a,b)=>(b.hard-a.hard)||b.score-a.score||b.confidenceScore-a.confidenceScore)}

function intelligence132JournalExposure(x,rank){
  if(!x?.id)return;const st=intelligence132Store(),today=localDateKey(),id=String(x.id),existing=st.journal.find(j=>j.type==="exposure"&&j.dateKey===today&&j.candidateId===id);if(existing){existing.rank=Math.min(existing.rank||rank,rank);existing.lastSeenAt=intelligence132Now();return existing}
  const row={id:uid(),type:"exposure",at:intelligence132Now(),dateKey:today,candidateId:id,signature:intelligence132Signature(x),area:x.area,kind:x.kind,title:x.title,source:x.source||x.area||"",rank,score:+x.score||0,confidenceScore:+x.confidenceScore||intelligence132ConfidenceScore(x),freshness:+x.freshness||intelligence132Freshness(x).score,hard:!!x.hard,minutes:+x.minutes||0,taskId:x.taskId||"",projectId:x.projectId||"",evidence:(x.evidence||[]).slice(0,5),outcome:"",outcomeAt:""};st.journal.unshift(row);st.journal=st.journal.slice(0,INTEL132_MAX_JOURNAL);return row
}
function intelligence132RecordExposure(rows){for(const [i,x] of (rows||[]).slice(0,5).entries())intelligence132JournalExposure(x,i+1)}
async function intelligence132RecordOutcome(token,outcome){
  const id=decodeURIComponent(String(token||"")),allowed=["done","helped","no-effect","missed"];if(!allowed.includes(outcome))return;const st=intelligence132Store(),x=(typeof lifeOsCandidates==="function"?lifeOsCandidates():[]).find(z=>String(z.id)===id)||null;let row=st.journal.find(j=>j.candidateId===id&&!j.outcome);if(!row&&x)row=intelligence132JournalExposure(x,0);if(!row){row={id:uid(),type:"outcome",at:intelligence132Now(),dateKey:localDateKey(),candidateId:id,signature:x?intelligence132Signature(x):id,area:x?.area||"",kind:x?.kind||"",title:x?.title||id,outcome:"",outcomeAt:""};st.journal.unshift(row)}row.outcome=outcome;row.outcomeAt=intelligence132Now();audit("Decision Intelligence outcome","system",`${outcome} • ${id}`);await save("Результат решения сохранён");renderIntelligence132()
}
function intelligence132ResolveObjectiveOutcomes(){
  if(typeof taskAll!=="function")return 0;const tasks=new Map(taskAll().map(t=>[String(t.id),t]));let changed=0;for(const j of intelligence132Store().journal){if(j.outcome||!j.taskId)continue;const t=tasks.get(String(j.taskId));if(t?.status==="done"){j.outcome="done";j.outcomeAt=t.completedAt||intelligence132Now();j.outcomeAuto=true;changed++}}return changed
}
function intelligence132LearningSummary(){
  const m=new Map();for(const j of intelligence132Store().journal.filter(j=>j.outcome)){const k=j.signature||`${j.area}|${j.kind}`,z=m.get(k)||{signature:k,n:0,value:0,helped:0,negative:0};const v=j.outcome==="helped"?1:j.outcome==="done"?.35:j.outcome==="no-effect"?-1:j.outcome==="missed"?-.5:0;z.n++;z.value+=v;if(v>0)z.helped++;if(v<0)z.negative++;m.set(k,z)}return [...m.values()].map(z=>({...z,adjustment:z.n>=3?Math.round(clamp(z.value/z.n*10,-8,8)):0})).sort((a,b)=>b.n-a.n)
}

function intelligence132DateValue(r){const k=String(r?.dateKey||r?.date||r?.createdAt||"").slice(0,10);return validDateKey(k)?k:""}
function intelligence132Window(rows,valueFn,days,offset=0){const b=addDays(new Date(),-offset),a=addDays(b,-(days-1)),ka=localDateKey(a),kb=localDateKey(b),x=(rows||[]).filter(r=>{const k=intelligence132DateValue(r);return k&&k>=ka&&k<=kb});return {rows:x,value:intelligence132Sum(x,valueFn),a:ka,b:kb}}
function intelligence132Anomalies(){
  const out=[];
  const exp=(S.expenses||[]).filter(x=>intelligence132DateValue(x));if(exp.length>=8){const cur=intelligence132Window(exp,x=>Math.max(0,+x.amount||0),7,0),prev=intelligence132Window(exp,x=>Math.max(0,+x.amount||0),21,7),base=prev.value/3,ratio=base>0?cur.value/base:null;if(ratio!=null&&ratio>=1.6)out.push({id:"finance-spend-surge",area:"Финансы",severity:ratio>=2.2?"high":"medium",title:"Расходы за 7 дней выше своей базы",detail:`${rub(cur.value)} против ~${rub(base)} за сопоставимую неделю • ${ratio.toFixed(2)}×`,confidenceScore:prev.rows.length>=15?88:72,action:"Проверить крупные и повторяющиеся расходы"})}
  const work=(S.workLogs||[]).filter(x=>validDateKey(x.date));if(work.length>=6){const val=x=>(+x.contacts||0)+(+x.followups||0)+(+x.lpr||0)*2+(+x.meetings||0)*3+(+x.proposals||0)*4,cur=intelligence132Window(work,val,7,0),prev=intelligence132Window(work,val,21,7),base=prev.value/3,ratio=base>0?cur.value/base:null;if(ratio!=null&&ratio<=.55)out.push({id:"work-activity-drop",area:"Работа",severity:ratio<=.35?"high":"medium",title:"Рабочая активность просела относительно базы",detail:`индекс ${Math.round(cur.value)} против ~${Math.round(base)} • ${ratio.toFixed(2)}×`,confidenceScore:prev.rows.length>=12?85:70,action:"Проверить CRM и восстановить следующий конкретный шаг"})}
  if(typeof training129LoadProfile==="function"){const p=training129LoadProfile();if(p.interpretable&&p.ratio>1.5)out.push({id:"training-load-high",area:"Тело",severity:p.ratio>1.8?"high":"medium",title:"Тренировочная нагрузка выше собственной базы",detail:`7 дней = ${p.ratio.toFixed(2)}× 28-дневной базы`,confidenceScore:p.baseSessions>=8?90:76,action:"Снизить следующую дополнительную нагрузку"})}
  const read=(S.readingLogs||[]).filter(x=>validDateKey(x.dateKey));if(read.length>=8){const cur=intelligence132Window(read,x=>+x.minutes||0,7,0),prev=intelligence132Window(read,x=>+x.minutes||0,21,7),base=prev.value/3,ratio=base>0?cur.value/base:null;if(ratio!=null&&ratio<=.45)out.push({id:"knowledge-reading-drop",area:"Знания",severity:"medium",title:"Чтение ниже собственной базы",detail:`${Math.round(cur.value)} мин против ~${Math.round(base)} мин • ${ratio.toFixed(2)}×`,confidenceScore:prev.rows.length>=9?82:68,action:"Вернуть минимальный короткий блок чтения"})}
  return out
}
function intelligence132AnomalyCandidates(){return intelligence132Anomalies().filter(a=>a.severity==="high").map(a=>({id:`intel132:${a.id}`,area:a.area,kind:"anomaly",title:a.action,meta:a.detail,score:78,hard:false,route:"intelligence132",source:"Decision Intelligence 13.2",confidence:intelligence132ConfidenceLabel(a.confidenceScore),evidence:[a.title,a.detail],minutes:15}))}

function intelligence132Scenario(input={}){
  const spend=Math.max(0,+input.spend||0),incomeFactor=clamp(+input.incomeFactor||100,0,200),trainingMinutes=Math.max(0,+input.trainingMinutes||0),trainingRpe=clamp(+input.trainingRpe||4,1,10),extraWorkMinutes=Math.max(0,+input.extraWorkMinutes||0),extraKnowledgeMinutes=Math.max(0,+input.extraKnowledgeMinutes||0),warnings=[];
  let finance=null;if(typeof buildFinancialProjection==="function"){const base=buildFinancialProjection(30),after=buildFinancialProjection(30,{oneOffExpense:spend,incomeFactor});finance={baseMin:base.minBalance,afterMin:after.minBalance,baseGap:base.cashGapDate||"",afterGap:after.cashGapDate||"",ending:after.endingBalance};if(after.cashGapDate&&!base.cashGapDate)warnings.push(`Сценарий создаёт риск кассового разрыва ${after.cashGapDate}.`);else if(after.cashGapDate)warnings.push(`Кассовый разрыв сохраняется: ${after.cashGapDate}.`)}
  let training=null;if(typeof training129LoadProfile==="function"){const p=training129LoadProfile(),extra=trainingMinutes*trainingRpe,ratio=p.interpretable&&p.weeklyBase>0?(p.acute.load+extra)/p.weeklyBase:null;training={baseRatio:p.ratio,projectedRatio:ratio,extraLoad:extra};if(ratio!=null&&ratio>1.5)warnings.push(`Дополнительная тренировка поднимет 7-дневную нагрузку до ${ratio.toFixed(2)}× базы.`)}
  let calendar=null;if(typeof calendarDayLoad==="function"){const d=calendarDayLoad(localDateKey()),added=trainingMinutes+extraWorkMinutes+extraKnowledgeMinutes,total=(+d.minutes||0)+added,capacity=+d.capacity||180;calendar={base:+d.minutes||0,added,total,capacity};if(total>capacity)warnings.push(`План на сегодня станет ~${Math.round(total)} мин при ёмкости ${Math.round(capacity)} мин.`)}
  return {input:{spend,incomeFactor,trainingMinutes,trainingRpe,extraWorkMinutes,extraKnowledgeMinutes},finance,training,calendar,warnings}
}
function intelligence132ReadScenarioForm(){return {spend:+document.getElementById("intel132Spend")?.value||0,incomeFactor:+document.getElementById("intel132Income")?.value||100,trainingMinutes:+document.getElementById("intel132TrainingMin")?.value||0,trainingRpe:+document.getElementById("intel132TrainingRpe")?.value||4,extraWorkMinutes:+document.getElementById("intel132WorkMin")?.value||0,extraKnowledgeMinutes:+document.getElementById("intel132KnowledgeMin")?.value||0}}
function intelligence132RunScenario(){const st=intelligence132Store();st.scenario=intelligence132ReadScenarioForm();renderIntelligence132Scenario()}
function intelligence132ResetScenario(){intelligence132Store().scenario={spend:0,incomeFactor:100,trainingMinutes:0,trainingRpe:4,extraWorkMinutes:0,extraKnowledgeMinutes:0};renderIntelligence132()}

function intelligence132DecisionCard(x,i){
  const token=decisionToken(x.id),learn=x.learningSamples>=3?` • обучение ${x.learningAdjustment>=0?"+":""}${x.learningAdjustment}`:"",conflict=x.conflictNotes?.length?`<div class="qmeta" style="margin-top:5px"><b>Конфликт:</b> ${x.conflictNotes.map(escapeHtml).join(" • ")}</div>`:"",unknown=x.unknowns?.length?`<div class="qmeta" style="margin-top:5px"><b>Неизвестно:</b> ${x.unknowns.map(escapeHtml).join(" • ")}</div>`:"";
  return `<div class="log-item"><div class="split"><div><span class="tag ${x.hard?"bad":x.score>=90?"warn":""}">#${i+1} • ${x.ruleType==="hard"?"HARD":"SOFT"}</span><div class="qtitle" style="margin-top:5px">${escapeHtml(x.title)}</div></div><div class="right"><b>${Math.round(x.score)}</b><div class="qmeta">confidence ${x.confidenceScore}%</div></div></div><div class="qmeta" style="margin-top:5px">срочность ${x.urgency} • эффект ${x.impact} • риск ${x.risk} • усилие ${x.effortCost}${learn}</div><div class="qmeta" style="margin-top:5px"><b>Факты:</b> ${(x.evidence||[]).map(escapeHtml).join(" • ")}</div>${unknown}${conflict}<div class="qmeta" style="margin-top:5px"><b>Что изменит решение:</b> ${escapeHtml(x.counterfactual||"")}</div><div class="split" style="margin-top:8px"><button class="btn secondary small" onclick="decisionExecuteToken('${token}')">Открыть</button><button class="btn ghost small" onclick="intelligence132RecordOutcome('${token}','done')">Сделано</button><button class="btn ghost small" onclick="intelligence132RecordOutcome('${token}','helped')">Помогло</button><button class="btn ghost small" onclick="intelligence132RecordOutcome('${token}','no-effect')">Не помогло</button><button class="btn ghost small" onclick="intelligence132RecordOutcome('${token}','missed')">Не сделал</button>${typeof intelligence1321ManualOverride==="function"&&!x.hard?`<button class="btn ghost small" onclick="intelligence1321ManualOverride('${token}')">Не приоритет</button>`:""}</div></div>`
}
function intelligence132AnomalyHtml(a){return `<div class="log-item"><div class="split"><div class="qtitle">${escapeHtml(a.title)}</div><span class="tag ${a.severity==="high"?"bad":"warn"}">${escapeHtml(a.severity)}</span></div><div class="qmeta">${escapeHtml(a.detail)} • confidence ${a.confidenceScore}%</div><div class="qmeta"><b>Действие:</b> ${escapeHtml(a.action)}</div></div>`}
function intelligence132JournalHtml(){const rows=intelligence132Store().journal.slice(0,20);return rows.length?rows.map(j=>`<div class="log-item"><div class="qtitle">${escapeHtml(j.title||j.candidateId)}</div><div class="qmeta">${escapeHtml(j.dateKey||"")} • ${escapeHtml(j.area||"")} • score ${Math.round(+j.score||0)} • confidence ${Math.round(+j.confidenceScore||0)}%${j.outcome?` • outcome: ${escapeHtml(j.outcome)}`:" • outcome: —"}</div></div>`).join(""):'<div class="empty">Журнал начнёт заполняться после показа решений.</div>'}
function intelligence132LearningHtml(){const rows=intelligence132LearningSummary().filter(x=>x.n>=3).slice(0,8);return rows.length?rows.map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.signature)}</div><div class="qmeta">${x.n} исходов • поправка к приоритету ${x.adjustment>=0?"+":""}${x.adjustment}</div></div>`).join(""):'<div class="status">Персональная поправка включится только после ≥3 исходов одного типа. Нажатия и просмотры сами по себе не считаются успехом.</div>'}

function ensureIntelligence132Ui(){
  intelligence132InstallIntegration();if(document.getElementById("intelligence132Command"))return;const grid=document.querySelector?.("#today .grid"),anchor=document.getElementById("decisionOsCommand")?.closest?.(".card")||document.getElementById("lifeOsCommand")?.closest?.(".card");if(!grid||!anchor)return;
  anchor.insertAdjacentHTML("afterend",`<div data-ux7-view="focus" class="card ux7-card span-12"><div class="eyebrow">Decision Intelligence 13.2</div><div class="section-title">Факт → сигнал → решение → исход</div><div class="muted" style="margin-top:6px">Локальный слой ранжирует существующие решения по срочности, эффекту, риску, свежести и качеству данных. Жёсткие обязательства не проигрывают мягким целям. Обучение использует исходы, а не клики.</div><div id="intelligence132Command" style="margin-top:12px"></div><details style="margin-top:12px"><summary>Аномалии и конфликты</summary><div id="intelligence132Anomalies" style="margin-top:8px"></div></details><details style="margin-top:12px"><summary>Что если?</summary><div class="formgrid" style="margin-top:10px"><div class="field"><label>Разовая трата, ₽</label><input id="intel132Spend" type="number" min="0"></div><div class="field"><label>Доходы, % плана</label><input id="intel132Income" type="number" min="0" max="200"></div><div class="field"><label>Доп. тренировка, мин</label><input id="intel132TrainingMin" type="number" min="0" max="360"></div><div class="field"><label>RPE тренировки</label><input id="intel132TrainingRpe" type="number" min="1" max="10"></div><div class="field"><label>Доп. рабочий фокус, мин</label><input id="intel132WorkMin" type="number" min="0" max="480"></div><div class="field"><label>Доп. чтение, мин</label><input id="intel132KnowledgeMin" type="number" min="0" max="240"></div></div><div class="split" style="margin-top:8px"><button class="btn secondary small" onclick="intelligence132RunScenario()">Пересчитать</button><button class="btn ghost small" onclick="intelligence132ResetScenario()">Сбросить</button></div><div id="intelligence132Scenario" style="margin-top:8px"></div></details><details style="margin-top:12px"><summary>Decision Journal и обучение</summary><div class="title" style="margin-top:10px">Выученные поправки</div><div id="intelligence132Learning"></div><div class="title" style="margin-top:10px">Последние решения</div><div id="intelligence132Journal"></div></details></div>`)
}
function renderIntelligence132Scenario(){const box=document.getElementById("intelligence132Scenario");if(!box)return;const s=intelligence132Store().scenario||{},r=intelligence132Scenario(s),finance=r.finance?`<div class="report-item"><div class="smallcaps">Финансы 30д</div><b>${r.finance.afterGap?`разрыв ${escapeHtml(r.finance.afterGap)}`:"без нового разрыва"}</b><div class="sub">минимум ${rub(r.finance.afterMin)}</div></div>`:"",training=r.training?`<div class="report-item"><div class="smallcaps">Нагрузка</div><b>${r.training.projectedRatio==null?"—":r.training.projectedRatio.toFixed(2)+"×"}</b><div class="sub">+${Math.round(r.training.extraLoad)} мин×RPE</div></div>`:"",cal=r.calendar?`<div class="report-item"><div class="smallcaps">Ёмкость сегодня</div><b>${Math.round(r.calendar.total)}/${Math.round(r.calendar.capacity)} мин</b><div class="sub">+${Math.round(r.calendar.added)} мин</div></div>`:"";box.innerHTML=`<div class="report-grid">${finance}${training}${cal}</div>${r.warnings.length?`<div class="notice" style="margin-top:8px">${r.warnings.map(escapeHtml).join("<br>")}</div>`:'<div class="status" style="margin-top:8px">По заданному сценарию новые критические ограничения не обнаружены.</div>'}`}
function renderIntelligence132(){
  const box=document.getElementById("intelligence132Command"),anom=document.getElementById("intelligence132Anomalies"),journal=document.getElementById("intelligence132Journal"),learning=document.getElementById("intelligence132Learning");if(!box||!anom||!journal||!learning)return;intelligence132ResolveObjectiveOutcomes();const plan=typeof lifeOsDailyPlan==="function"?lifeOsDailyPlan():{plan:[]},rows=plan.plan.slice(0,3);intelligence132RecordExposure(rows);box.innerHTML=rows.length?rows.map(intelligence132DecisionCard).join(""):'<div class="empty">Нет активных кандидатов для ранжирования.</div>';const a=intelligence132Anomalies();anom.innerHTML=a.length?a.map(intelligence132AnomalyHtml).join(""):'<div class="status">Аномалий с достаточной выборкой сейчас не найдено.</div>';journal.innerHTML=intelligence132JournalHtml();learning.innerHTML=intelligence132LearningHtml();const s=intelligence132Store().scenario||{};for(const [id,k,f] of [["intel132Spend","spend",0],["intel132Income","incomeFactor",100],["intel132TrainingMin","trainingMinutes",0],["intel132TrainingRpe","trainingRpe",4],["intel132WorkMin","extraWorkMinutes",0],["intel132KnowledgeMin","extraKnowledgeMinutes",0]]){const el=document.getElementById(id);if(el&&document.activeElement!==el)el.value=s[k]??f}renderIntelligence132Scenario()
}
function intelligence132OpenRoute(){ux7Go("today","focus");setTimeout(()=>document.getElementById("intelligence132Command")?.scrollIntoView?.({behavior:"smooth",block:"start"}),120);return true}
function intelligence132InstallIntegration(){if(INTEL132_INTEGRATED)return;INTEL132_INTEGRATED=true;if(typeof lifeOsRegisterCandidateProvider==="function")lifeOsRegisterCandidateProvider("intelligence132-anomalies",intelligence132AnomalyCandidates);if(typeof lifeOsRegisterRouteHandler==="function")lifeOsRegisterRouteHandler("intelligence132",intelligence132OpenRoute)}

intelligence132InstallIntegration();
