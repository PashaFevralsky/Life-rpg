"use strict";

/* Life RPG 12.9 — Training & Physical Capacity OS.
   Adaptive outdoor conditioning around Tennis OS, Body/Recovery, Calendar and Life OS.
   Descriptive training logic, not a medical assessment. No state migration. */

const TRAINING129_TRACKER_ID="tracker-training-outdoor";
const TRAINING129_MARKER="Training OS 12.9";

function training129EnsureTracker(){
  if(typeof growthData!=="function")return null;const g=growthData();let t=g.trackers.find(x=>x.id===TRAINING129_TRACKER_ID);
  if(!t){t={id:TRAINING129_TRACKER_ID,name:"ОФП / выносливость",area:"Тело",type:"timer",unit:"мин",active:true,createdAt:new Date().toISOString()};g.trackers.push(t)}
  else{t.name="ОФП / выносливость";t.area="Тело";t.active=true}
  return t
}
function training129Num(v){if(v==null||String(v).trim()==="")return null;const n=Number(String(v).replace(",",".").trim());return Number.isFinite(n)?n:null}
function training129Encode(meta,note=""){
  const safe=v=>String(v??"").replace(/[|\n\r]/g," ").trim();
  return `${TRAINING129_MARKER}|type=${safe(meta.type)}|distance=${safe(meta.distanceKm)}|avgHr=${safe(meta.avgHr)}|maxHr=${safe(meta.maxHr)}|aerobicEffect=${safe(meta.aerobicEffect)}|recoveryHours=${safe(meta.recoveryHours)}|source=${safe(meta.source||"manual")}\n${String(note||"").trim()}`.trim()
}
function training129Decode(note=""){
  const lines=String(note||"").split(/\n/),head=lines[0]||"";if(!head.startsWith(TRAINING129_MARKER))return null;
  const out={note:lines.slice(1).join("\n").trim()};for(const part of head.split("|").slice(1)){const i=part.indexOf("=");if(i<0)continue;out[part.slice(0,i)]=part.slice(i+1)}
  for(const k of ["distance","avgHr","maxHr","aerobicEffect","recoveryHours"]){const n=training129Num(out[k]);out[k]=n}
  out.distanceKm=out.distance;delete out.distance;return out
}
function training129OutdoorSessions(days=365){
  training129EnsureTracker();const start=localDateKey(addDays(new Date(),-(Math.max(1,days)-1)));
  return (typeof growthExplicitEvents==="function"?growthExplicitEvents():[]).filter(x=>x.trackerId===TRAINING129_TRACKER_ID&&growthEventDate(x)>=start).map(x=>{
    const m=training129Decode(x.note)||{},rpe=clamp(+x.value||0,1,10),minutes=Math.max(0,+x.durationMin||0);
    return {id:x.id,dateKey:growthEventDate(x),minutes,rpe,load:minutes*rpe,type:m.type||"easy",distanceKm:+m.distanceKm||0,avgHr:+m.avgHr||0,maxHr:+m.maxHr||0,aerobicEffect:m.aerobicEffect,recoveryHours:m.recoveryHours,source:m.source||"manual",note:m.note||"",raw:x,domain:"outdoor",hard:(m.type==="interval"&&rpe>=6)||rpe>=8}
  }).sort((a,b)=>String(b.dateKey).localeCompare(String(a.dateKey)))
}
function training129TennisSessions(days=365){
  const start=localDateKey(addDays(new Date(),-(Math.max(1,days)-1)));
  return (S.tennis||[]).filter(x=>String(x.dateKey||"")>=start).map(x=>{
    const w=typeof tennisHuaweiDetail==="function"?tennisHuaweiDetail(x.id):null,minutes=Math.max(0,+x.min||0),rpe=clamp(+x.load||0,1,10);
    return {id:x.id,dateKey:x.dateKey,minutes,rpe,load:minutes*rpe,type:"tennis",distanceKm:0,avgHr:+w?.avgHr||0,maxHr:+w?.maxHr||0,aerobicEffect:w?.aerobicEffect??null,recoveryHours:w?.recoveryHours??null,source:w?"Huawei Health":"tennis",note:x.note||"",raw:x,wearable:w,domain:"tennis",hard:x.type==="Турнир"||rpe>=8}
  }).sort((a,b)=>String(b.dateKey).localeCompare(String(a.dateKey)))
}
function training129AllSessions(days=365){return [...training129OutdoorSessions(days),...training129TennisSessions(days)].sort((a,b)=>String(b.dateKey).localeCompare(String(a.dateKey)))}
function training129Range(days=7,offset=0){
  const end=addDays(new Date(),-offset),start=addDays(end,-(days-1)),a=localDateKey(start),b=localDateKey(end),rows=training129AllSessions(days+offset+2).filter(x=>x.dateKey>=a&&x.dateKey<=b);
  return {a,b,rows,minutes:rows.reduce((s,x)=>s+x.minutes,0),load:rows.reduce((s,x)=>s+x.load,0),tennis:rows.filter(x=>x.domain==="tennis").length,outdoor:rows.filter(x=>x.domain==="outdoor").length,hard:rows.filter(x=>x.hard).length}
}
function training129LoadProfile(){
  const acute=training129Range(7,0),baseRows=training129AllSessions(42).filter(x=>{const age=Math.round((parseLocal(localDateKey())-parseLocal(x.dateKey))/86400000);return age>=7&&age<35}),weeklyBase=baseRows.reduce((s,x)=>s+x.load,0)/4,ratio=baseRows.length>=4&&weeklyBase>=250?acute.load/weeklyBase:null;
  return {acute,weeklyBase,ratio,interpretable:ratio!=null,baseSessions:baseRows.length}
}
function training129Readiness(){
  const body=typeof bodyReadiness==="function"?bodyReadiness():null,latest=training129AllSessions(14)[0]||null;
  return {body,latestRecovery:latest?.recoveryHours??null,latestDate:latest?.dateKey||""}
}
function training129WeightTrend(){
  if(typeof bodyDailySeries!=="function")return null;const rows=bodyDailySeries("tracker-weight",30);if(rows.length<2)return null;const first=rows[0],last=rows.at(-1);return {n:rows.length,first:first.value,last:last.value,delta:last.value-first.value,days:Math.max(1,Math.round((parseLocal(last.dateKey)-parseLocal(first.dateKey))/86400000))}
}
function training129AerobicTrend(){
  const rows=training129OutdoorSessions(90).filter(x=>x.type==="easy"&&x.distanceKm>0&&x.avgHr>0&&x.minutes>0).sort((a,b)=>String(a.dateKey).localeCompare(String(b.dateKey)));
  if(rows.length<6)return {interpretable:false,n:rows.length,need:6};
  const recent=rows.slice(-3),prior=rows.slice(-6,-3),avg=(a,f)=>a.reduce((s,x)=>s+f(x),0)/a.length,pace=a=>avg(a,x=>x.minutes/x.distanceKm),hr=a=>avg(a,x=>x.avgHr),p0=pace(prior),p1=pace(recent),h0=hr(prior),h1=hr(recent),hrComparable=Math.abs(h1-h0)<=8,paceDelta=(p1-p0)/p0*100;
  return {interpretable:hrComparable,n:rows.length,priorPace:p0,recentPace:p1,priorHr:h0,recentHr:h1,paceDelta,hrDelta:h1-h0,reason:hrComparable?"":"Средний пульс групп отличается >8 уд/мин"}
}
function training129PlanFact(){
  const [a,b]=typeof weekBounds==="function"?weekBounds():[localDateKey(addDays(new Date(),-6)),localDateKey()],planned=(typeof calendarManualEvents==="function"?calendarManualEvents():[]).filter(x=>x.dateKey>=a&&x.dateKey<=b&&String(x.note||"").includes(TRAINING129_MARKER)&&x.status!=="cancelled"),facts=training129OutdoorSessions(14).filter(x=>x.dateKey>=a&&x.dateKey<=b),doneDays=new Set(facts.map(x=>x.dateKey)),matched=planned.filter(x=>x.status==="done"||doneDays.has(x.dateKey)).length;
  return {planned:planned.length,fact:facts.length,matched,rate:planned.length?matched/planned.length:null}
}
function training129Quality(){
  const outdoor=training129OutdoorSessions(42),all=training129AllSessions(42),withHr=all.filter(x=>x.avgHr>0).length,withDistance=outdoor.filter(x=>x.distanceKm>0).length,body=training129Readiness().body;
  return {sessions:all.length,outdoor:outdoor.length,withHr,withDistance,bodyReady:body!=null,aerobicComparable:training129AerobicTrend().interpretable}
}
function training129Prescription(kind){
  if(kind==="recovery")return {kind,title:"Восстановительная прогулка",minutes:25,rpe:2,detail:"5 мин спокойно → 15 мин лёгкая ходьба → 5 мин спокойно."};
  if(kind==="strength")return {kind,title:"ОФП без зала",minutes:25,rpe:5,detail:"3 круга: присед 8–12, отжимания от опоры 6–12, выпады/шаги 6–8 на ногу, подъёмы на носки 15, планка 20–30 с. Без отказа."};
  if(kind==="interval")return {kind,title:"Интервалы выносливости",minutes:32,rpe:7,detail:"10 мин легко → 6×(1 мин быстро + 2 мин легко) → 4 мин спокойно. Быстрая ходьба или лёгкий бег по самочувствию."};
  return {kind:"easy",title:"Лёгкая аэробная",minutes:35,rpe:4,detail:"5 мин ходьба → 25 мин лёгкая ходьба/бег в разговорном темпе → 5 мин спокойно."}
}
function training129Decision(){
  const load=training129LoadProfile(),ready=training129Readiness(),recent=training129Range(7),out28=training129OutdoorSessions(28),easy28=out28.filter(x=>x.type==="easy").length,tennisTarget=Math.max(0,+S.settings.tennisWeeklyTarget||3),tennisDone=recent.tennis;
  if((ready.body!=null&&ready.body<=50)||(load.interpretable&&load.ratio>1.4))return {...training129Prescription("recovery"),reason:ready.body!=null&&ready.body<=50?`Готовность ${ready.body}%`:`7-дневная нагрузка ${load.ratio.toFixed(2)}× собственной базы`,score:58};
  const outdoorDone=recent.outdoor;
  if(outdoorDone===0)return {...training129Prescription("easy"),reason:`На неделе ${tennisDone}/${tennisTarget} теннисных и 0 ОФП-сессий`,score:52};
  if(easy28>=6&&outdoorDone<2&&(!load.interpretable||load.ratio<=1.2)&&(ready.body==null||ready.body>=60))return {...training129Prescription("interval"),reason:"База лёгких сессий уже накоплена; интенсивность добавляется дозированно",score:48};
  if(outdoorDone<2)return {...training129Prescription("strength"),reason:"Добрать общую подготовку без второй тяжёлой аэробной работы",score:46};
  return {kind:"hold",title:"Не добавлять тренировку автоматически",minutes:0,rpe:0,detail:"Текущий объём уже достаточен для этой недели.",reason:`Факт: ${recent.tennis} теннисных + ${recent.outdoor} ОФП`,score:20}
}
function training129SuggestedWeek(){
  const load=training129LoadProfile(),ready=training129Readiness(),out28=training129OutdoorSessions(28),easy28=out28.filter(x=>x.type==="easy").length,low=(ready.body!=null&&ready.body<=50)||(load.interpretable&&load.ratio>1.4),newBase=out28.length<4;
  let kinds=low?["recovery"]:newBase?["easy","strength"]:["easy","strength","easy"];
  if(!low&&!newBase&&easy28>=6&&(!load.interpretable||load.ratio<=1.2)&&(ready.body==null||ready.body>=60))kinds=["easy","strength","interval"];
  const start=new Date(),dates=[];for(let i=0;i<7;i++)dates.push(localDateKey(addDays(start,i)));
  const planned=(typeof calendarEvents==="function"?calendarEvents(7,0):[]),sports=new Set(planned.filter(x=>x&&x.dateKey>=dates[0]&&x.dateKey<=dates.at(-1)&&(/тренир|теннис|турнир|спорт/i.test(`${x.title||""} ${x.type||""} ${x.area||""}`))).map(x=>x.dateKey));for(const x of training129AllSessions(7))if(x.dateKey>=dates[0]&&x.dateKey<=dates.at(-1))sports.add(x.dateKey);
  const used=new Set(),rows=[];for(const kind of kinds){let candidates=dates.filter(d=>!sports.has(d)&&!used.has(d));if(rows.length)candidates=candidates.filter(d=>Math.abs((parseLocal(d)-parseLocal(rows.at(-1).dateKey))/86400000)>=2);if(!candidates.length)candidates=dates.filter(d=>!used.has(d));candidates.sort((a,b)=>{const la=typeof calendarDayLoad==="function"?calendarDayLoad(a).minutes:0,lb=typeof calendarDayLoad==="function"?calendarDayLoad(b).minutes:0;return la-lb||a.localeCompare(b)});const dateKey=candidates[0];if(!dateKey)break;used.add(dateKey);const p=training129Prescription(kind);rows.push({...p,dateKey})}
  return rows.sort((a,b)=>a.dateKey.localeCompare(b.dateKey))
}
async function training129PlanWeek(){
  const rows=training129SuggestedWeek();if(!rows.length){toast("Нет свободных дней для плана");return}const existing=(typeof calendarManualEvents==="function"?calendarManualEvents():[]).filter(x=>String(x.note||"").includes(TRAINING129_MARKER)&&x.status!=="cancelled"&&x.dateKey>=localDateKey());if(existing.length&&!confirm(`Уже есть ${existing.length} будущих Training OS событий. Добавить ещё ${rows.length}?`))return;
  if(!existing.length&&!confirm(`Добавить ${rows.length} тренировочных событий на ближайшие 7 дней? Время суток приложение не назначает.`))return;
  await createPreActionSnapshot("Перед планированием Training OS 12.9");for(const x of rows)addCalendarPlan({title:x.title,dateKey:x.dateKey,type:"Тренировка",minutes:x.minutes,priority:2,note:`${TRAINING129_MARKER} | kind=${x.kind} | RPE ${x.rpe} | ${x.detail}`,repeatWeeks:1});
  audit("Training OS: план 7 дней","sport",rows.map(x=>`${x.dateKey} ${x.kind}`).join("; "));await save(`Training OS: запланировано ${rows.length} сессий`)
}
function training129CompletePlanned(dateKey){
  const rows=(typeof calendarManualEvents==="function"?calendarManualEvents():[]).filter(x=>x.dateKey===dateKey&&x.status==="planned"&&String(x.note||"").includes(TRAINING129_MARKER));if(rows[0]){rows[0].status="done";rows[0].updatedAt=new Date().toISOString()}
}
function training129Fill(data={}){
  const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null)el.value=v};
  set("training129Date",data.dateKey||localDateKey());set("training129Minutes",data.minutes||"");set("training129Rpe",data.rpe||"");set("training129Distance",data.distanceKm||"");set("training129AvgHr",data.avgHr||"");set("training129MaxHr",data.maxHr||"");set("training129AerobicEffect",data.aerobicEffect??"");set("training129Recovery",data.recoveryHours??"");set("training129Note",data.note||"");if(data.type)set("training129Type",data.type)
}
async function training129Save(){
  training129EnsureTracker();const get=id=>document.getElementById(id)?.value,dateKey=String(get("training129Date")||localDateKey()),type=String(get("training129Type")||"easy"),minutes=Math.max(0,Math.round(+get("training129Minutes")||0)),rpe=clamp(+get("training129Rpe")||0,1,10);
  if(!validDateKey(dateKey)||dateKey>localDateKey()){toast("Дата тренировки должна быть сегодня или в прошлом");return}if(minutes<=0){toast("Укажи длительность");return}if(!Number.isFinite(+get("training129Rpe"))||+get("training129Rpe")<1||+get("training129Rpe")>10){toast("Укажи RPE 1–10");return}
  const meta={type,distanceKm:Math.max(0,training129Num(get("training129Distance"))||0),avgHr:Math.max(0,training129Num(get("training129AvgHr"))||0),maxHr:Math.max(0,training129Num(get("training129MaxHr"))||0),aerobicEffect:training129Num(get("training129AerobicEffect")),recoveryHours:training129Num(get("training129Recovery")),source:String(document.getElementById("training129Source")?.dataset.source||"manual")};
  if(meta.avgHr&&meta.maxHr&&meta.avgHr>meta.maxHr){toast("Средний пульс не может быть выше максимального");return}
  const note=String(get("training129Note")||"").trim(),event=growthLogEvent(TRAINING129_TRACKER_ID,{dateKey,value:rpe,durationMin:minutes,note:training129Encode(meta,note)});training129CompletePlanned(dateKey);audit("Training OS: тренировка","sport",`${dateKey} • ${type} • ${minutes} мин × RPE ${rpe}`);training129Fill({dateKey:localDateKey(),type:"easy",rpe:4});const source=document.getElementById("training129Source");if(source)source.dataset.source="manual";await save(`Тренировка сохранена • нагрузка ${minutes*rpe}`);return event
}
async function training129Delete(id){
  const g=typeof growthData==="function"?growthData():null;if(!g)return;const i=g.events.findIndex(x=>x.id===id&&x.trackerId===TRAINING129_TRACKER_ID);if(i<0)return;if(!confirm("Удалить эту ОФП-сессию?"))return;await createPreActionSnapshot("Перед удалением Training OS сессии");g.events.splice(i,1);audit("Training OS: удалено","sport",id);await save("Тренировка удалена")
}
function training129ParseDistance(text){
  const flat=String(text||"").replace(",",".");let m=flat.match(/(?:расстояние|distance)[^\d]{0,30}(\d+(?:\.\d+)?)\s*км/i);if(m)return +m[1]||0;m=flat.match(/(\d+(?:\.\d+)?)\s*км/i);return m?+m[1]||0:0
}
async function training129ReadHuaweiFile(file){
  if(!file)return;const status=document.getElementById("training129HuaweiStatus");try{if(status)status.textContent="Huawei OCR: подготовка…";const T=await tennisHuaweiLoadTesseract(),result=await T.recognize(file,"rus+eng",{logger:m=>{if(status&&m.status==="recognizing text")status.textContent=`Huawei OCR: ${Math.round((m.progress||0)*100)}%`}}),text=String(result?.data?.text||""),p=tennisHuaweiParseText(text),distanceKm=training129ParseDistance(text);
    training129Fill({dateKey:p.dateKey||localDateKey(),minutes:p.durationSec?Math.max(1,Math.round(p.durationSec/60)):"",distanceKm,avgHr:p.avgHr||"",maxHr:p.maxHr||"",aerobicEffect:p.aerobicEffect,recoveryHours:p.recoveryHours});
    const source=document.getElementById("training129Source");if(source)source.dataset.source="Huawei Health";if(status)status.textContent=`Huawei: распознано. Проверь тип тренировки, RPE и цифры перед сохранением. OCR ${Math.round(+result?.data?.confidence||0)}%.`;ux7Go("more","overview");setTimeout(()=>document.getElementById("training129Editor")?.scrollIntoView({behavior:"smooth",block:"start"}),120)
  }catch(e){if(status)status.textContent=`Huawei OCR не сработал: ${e.message}. Поля можно заполнить вручную.`}
}
async function training129ReadHuaweiInput(input){const f=input?.files?.[0];if(f)await training129ReadHuaweiFile(f);if(input)input.value=""}
function training129ImportHubHuawei(){
  if(typeof IMPORT127_PREVIEW==="undefined"||IMPORT127_PREVIEW?.kind!=="image-route"||!IMPORT127_PREVIEW.file){toast("Сначала выбери скрин Huawei в Import Hub");return}
  training129ReadHuaweiFile(IMPORT127_PREVIEW.file)
}
function training129PatchImportHub(){
  const route=document.getElementById("import127Route");if(!route)return;let b=document.getElementById("training129HubHuawei");if(!b){b=document.createElement("button");b.id="training129HubHuawei";b.className="btn secondary";b.type="button";b.textContent="Huawei / тренировка";b.onclick=training129ImportHubHuawei;route.after(b)}
  const image=typeof IMPORT127_PREVIEW!=="undefined"&&IMPORT127_PREVIEW?.kind==="image-route";b.hidden=!image
}
function training129PatchQuick(){
  const grid=document.querySelector("#ux7QuickSheet .ux7-action-grid");if(!grid||grid.querySelector('[data-training129-action="1"]'))return;const b=document.createElement("button");b.type="button";b.dataset.training129Action="1";b.innerHTML=`${typeof ui82Icon==="function"?ui82Icon("activity"):""}<span>ОФП / кардио</span>`;b.onclick=()=>{closeModal("ux7QuickSheet");ux7Go("more","overview");setTimeout(()=>document.getElementById("training129Editor")?.scrollIntoView({behavior:"smooth",block:"start"}),120)};grid.appendChild(b);window.LifePlatform?.refreshIcons?.(grid)
}
let TRAINING129_INTEGRATED=false;
function training129InstallIntegration(){
  if(TRAINING129_INTEGRATED)return;TRAINING129_INTEGRATED=true;
  if(typeof lifeOsRawCandidates==="function"){const base=lifeOsRawCandidates;lifeOsRawCandidates=function(){const out=base(),d=training129Decision();if(d&&d.score>=42&&d.minutes>0)lifeOsAddCandidate(out,{id:`training129:${d.kind}`,area:"Тело",kind:`training-${d.kind}`,title:d.title,meta:`${d.reason} • ${d.detail}`,score:d.score,hard:false,route:"training129",source:"Training OS 12.9",confidence:training129Quality().sessions>=6?"medium":"low",evidence:[`${training129Range(7).tennis} tennis`,`${training129Range(7).outdoor} outdoor`],minutes:d.minutes});return out}}
  if(typeof lifeOsOpen==="function"){const base=lifeOsOpen;lifeOsOpen=function(area,route=""){if(route==="training129"){ux7Go("more","overview");setTimeout(()=>document.getElementById("training129Command")?.scrollIntoView({behavior:"smooth",block:"start"}),120);return}return base(area,route)}}
}
function training129FmtPace(v){if(!Number.isFinite(v)||v<=0)return"—";const m=Math.floor(v),s=Math.round((v-m)*60);return `${m}:${String(s).padStart(2,"0")} мин/км`}
function training129TypeLabel(t){return ({easy:"Лёгкая аэробная",interval:"Интервалы",strength:"ОФП",recovery:"Восстановление"})[t]||t}
function ensureTraining129Ui(){
  training129EnsureTracker();training129InstallIntegration();if(document.getElementById("training129Command"))return;const grid=document.querySelector("#more .grid");if(!grid)return;const anchor=document.getElementById("bodyOsCommand")?.closest(".card")||grid.firstElementChild;
  anchor?.insertAdjacentHTML("afterend",`<div data-ux7-view="overview" data-personal-widget="training129" class="card ux7-card span-12"><div class="eyebrow">Training & Physical Capacity OS 12.9</div><div class="section-title">Теннис + ОФП как одна нагрузка</div><div class="sub">План строится по фактическим минутам × RPE, календарю и введённому восстановлению. Это тренировочная логика, не медицинская оценка.</div><div id="training129Command" style="margin-top:12px"></div><div class="split" style="margin-top:10px"><button class="btn secondary" onclick="training129PlanWeek()">Запланировать 7 дней</button><label class="btn ghost">Huawei скрин<input type="file" accept="image/*" style="display:none" onchange="training129ReadHuaweiInput(this)"></label></div><div id="training129HuaweiStatus" class="status" style="margin-top:8px">Huawei можно загрузить здесь или через Import Hub 12.7.</div></div>
  <div data-ux7-view="overview" data-personal-widget="training129-editor" class="card ux7-card span-6" id="training129Editor"><div class="title">Факт ОФП / выносливости</div><input id="training129Source" type="hidden"><div class="formgrid" style="margin-top:10px"><div class="field"><label>Дата</label><input id="training129Date" type="date"></div><div class="field"><label>Тип</label><select id="training129Type"><option value="easy">Лёгкая аэробная</option><option value="interval">Интервалы</option><option value="strength">ОФП</option><option value="recovery">Восстановление</option></select></div><div class="field"><label>Длительность, мин</label><input id="training129Minutes" type="number" min="1" max="360"></div><div class="field"><label>RPE 1–10</label><input id="training129Rpe" type="number" min="1" max="10" value="4"></div><div class="field"><label>Дистанция, км</label><input id="training129Distance" type="number" min="0" step="0.01"></div><div class="field"><label>Средний пульс</label><input id="training129AvgHr" type="number" min="30" max="260"></div><div class="field"><label>Макс. пульс</label><input id="training129MaxHr" type="number" min="30" max="280"></div><div class="field"><label>Аэробный эффект Huawei</label><input id="training129AerobicEffect" type="number" min="0" max="5.5" step="0.1"></div><div class="field"><label>Восстановление Huawei, ч</label><input id="training129Recovery" type="number" min="0" max="240" step="0.5"></div></div><div class="field" style="margin-top:8px"><label>Комментарий</label><input id="training129Note" placeholder="Поверхность, самочувствие, что получилось"></div><div class="split training129-save" style="margin-top:10px"><button class="btn" onclick="training129Save()">Сохранить тренировку</button></div><div class="notice" style="margin-top:10px">Если во время нагрузки появляются боль в груди, обморок/предобморочное состояние или необычная выраженная одышка — прекращай тренировку и обращайся за медицинской помощью.</div></div>
  <div data-ux7-view="overview" data-personal-widget="training129-history" class="card ux7-card span-6"><div class="title">Прогресс и история</div><div id="training129Progress"></div><div class="title" style="margin-top:14px">Последние ОФП-сессии</div><div id="training129History"></div></div>`);
  if(typeof personalRegisterWidget==="function"){personalRegisterWidget("training129","Training OS","more");personalRegisterWidget("training129-editor","Факт ОФП","more");personalRegisterWidget("training129-history","Прогресс тренировок","more")}
  training129Fill({dateKey:localDateKey(),type:"easy",rpe:4})
}
function renderTraining129(){
  const box=document.getElementById("training129Command"),progress=document.getElementById("training129Progress"),hist=document.getElementById("training129History");if(!box||!progress||!hist)return;const load=training129LoadProfile(),r=training129Range(7),ready=training129Readiness(),d=training129Decision(),pf=training129PlanFact(),aero=training129AerobicTrend(),weight=training129WeightTrend(),quality=training129Quality(),ratio=load.ratio==null?"—":load.ratio.toFixed(2)+"×";
  box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Сессий 7д</div><b>${r.rows.length}</b><div class="sub">теннис ${r.tennis} • ОФП ${r.outdoor}</div></div><div class="report-item"><div class="smallcaps">Минут 7д</div><b>${r.minutes}</b></div><div class="report-item"><div class="smallcaps">Нагрузка 7д</div><b>${Math.round(r.load)}</b><div class="sub">мин × RPE</div></div><div class="report-item"><div class="smallcaps">К своей базе</div><b>${ratio}</b><div class="sub">${load.interpretable?`база ~${Math.round(load.weeklyBase)}`:"нужно больше истории"}</div></div><div class="report-item"><div class="smallcaps">Готовность</div><b>${ready.body==null?"—":ready.body+"%"}</b></div><div class="report-item"><div class="smallcaps">План → факт</div><b>${pf.rate==null?"—":Math.round(pf.rate*100)+"%"}</b><div class="sub">${pf.matched}/${pf.planned} Training OS событий</div></div></div><div class="notice" style="margin-top:10px"><b>Следующее действие:</b> ${escapeHtml(d.title)}${d.minutes?` • ~${d.minutes} мин • RPE ${d.rpe}`:""}<div class="qmeta">${escapeHtml(d.reason)} • ${escapeHtml(d.detail)}</div></div><div class="status" style="margin-top:8px">Качество данных: ${quality.sessions} сессий / 42д • пульс ${quality.withHr} • дистанция ${quality.withDistance} • восстановление ${quality.bodyReady?"есть":"нет"}.</div>`;
  const aeroHtml=aero.interpretable?`<div class="log-item"><div class="qtitle">Лёгкая аэробная: сопоставимые 3+3 сессии</div><div class="qmeta">Темп ${training129FmtPace(aero.priorPace)} → ${training129FmtPace(aero.recentPace)} • пульс ${Math.round(aero.priorHr)} → ${Math.round(aero.recentHr)}. Это описательный тренд, не VO₂max.</div></div>`:`<div class="status">Аэробный тренд: ${aero.n}/${aero.need||6} лёгких сессий с дистанцией и средним пульсом${aero.reason?` • ${escapeHtml(aero.reason)}`:""}.</div>`;
  const weightHtml=weight?`<div class="log-item"><div class="qtitle">Вес: ${Math.round(weight.first*10)/10} → ${Math.round(weight.last*10)/10} кг</div><div class="qmeta">${weight.delta>=0?"+":""}${Math.round(weight.delta*10)/10} кг за ${weight.days} дн. • тренд без оценки «хорошо/плохо».</div></div>`:'<div class="status">Для тренда веса нужны минимум две записи.</div>';
  progress.innerHTML=aeroHtml+weightHtml;
  const rows=training129OutdoorSessions(60).slice(0,12);hist.innerHTML=rows.length?rows.map(x=>`<div class="log-item"><div class="split"><div><div class="qtitle">${escapeHtml(x.dateKey)} • ${escapeHtml(training129TypeLabel(x.type))}</div><div class="qmeta">${x.minutes} мин • RPE ${x.rpe} • нагрузка ${Math.round(x.load)}${x.distanceKm?` • ${x.distanceKm} км`:""}${x.avgHr?` • ср. пульс ${x.avgHr}`:""}${x.source!=="manual"?` • ${escapeHtml(x.source)}`:""}</div></div><button class="btn ghost small" onclick="training129Delete('${x.id}')">×</button></div></div>`).join(""):'<div class="empty">ОФП-сессий пока нет. Теннис уже учитывается в общей нагрузке.</div>';
  training129PatchImportHub();training129PatchQuick()
}
