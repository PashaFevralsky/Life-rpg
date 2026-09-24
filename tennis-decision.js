"use strict";

/* Tennis Decision Layer 12.2
   Additive analytics and next-session planner.
   Uses existing Tennis OS, Tennis Growth and Huawei data; no state migration. */

function tennisDecision22Sessions(days=30){
  const start=localDateKey(addDays(new Date(),-(Math.max(1,days)-1)));
  return (S.tennis||[]).filter(x=>String(x.dateKey||"")>=start)
}
function tennisDecision22Matches(){
  return typeof tennisMatchTimeline==="function"?tennisMatchTimeline():(typeof tennisAllMatches==="function"?tennisAllMatches():[])
}
function tennisDecision22Exposure(days=21){
  if(typeof tennisGrowthExposure==="function"){
    const x=tennisGrowthExposure(days);
    if(x?.sum)return {sum:x.sum,sessions:+x.sessions||0,exact:+x.exact||0,total:+x.total||0}
  }
  const sum=typeof tennisExposureDeep==="function"?tennisExposureDeep(days):(typeof tennisExposure==="function"?tennisExposure(days):{});
  return {sum,sessions:tennisDecision22Sessions(days).length,exact:0,total:Object.values(sum||{}).reduce((a,b)=>a+(+b||0),0)}
}
function tennisDecision22LeastFocus(days=21){
  const e=tennisDecision22Exposure(days),rows=Object.entries(e.sum||{}).filter(([,v])=>Number.isFinite(+v));
  if(!rows.length||e.total<=0)return {name:"Смешанная",minutes:0};
  rows.sort((a,b)=>(+a[1]||0)-(+b[1]||0)||a[0].localeCompare(b[0],"ru"));
  return {name:rows[0][0],minutes:+rows[0][1]||0}
}
function tennisDecision22Load(){
  const base=typeof tennisLoadProfile==="function"?tennisLoadProfile():{acute:0,baseline:0,ratio:null,hard3:0,interpretable:false};
  const wearable=typeof tennisHuaweiAll==="function"?tennisHuaweiAll().slice().sort((a,b)=>String(b.dateKey||"").localeCompare(String(a.dateKey||"")))[0]||null:null;
  return {...base,wearable}
}
function tennisDecision22MonthPace(d=new Date()){
  const totalDays=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(),elapsed=Math.max(1,d.getDate());
  const month=localMonthKey(d),sessions=(S.tennis||[]).filter(x=>String(x.dateKey||"").startsWith(month)).length;
  const target=Math.max(1,Math.round(typeof tennisOsNumber==="function"?tennisOsNumber("tennisMonthlyTarget",S.settings.tennisMonthlyTarget||12,1,60):(+S.settings.tennisMonthlyTarget||12)));
  const expected=target*elapsed/totalDays,projected=sessions/elapsed*totalDays;
  return {month,sessions,target,totalDays,elapsed,expected,projected,delta:sessions-expected,onPace:sessions+0.25>=expected}
}
function tennisDecision22Form(){
  const f=typeof tennisFormData==="function"?tennisFormData():{last10:[],prev10:[],lastWr:null,prevWr:null,elo30:0,strongestWin:null};
  const calc=typeof computeTennisElo==="function"?computeTennisElo():{rating:+S.settings.tennisElo||1000,ratedMatches:0};
  const last=f.lastWr,prev=f.prevWr,delta=last!=null&&prev!=null?last-prev:null;
  const rated=tennisDecision22Matches().filter(x=>x.rated||((+x.opponentRating||0)>0&&["W","L"].includes(x.result)));
  const recentRated=rated.slice(-10);
  const recentElo=recentRated.reduce((a,x)=>a+(+x.eloDelta||0),0);
  return {...f,currentElo:calc.rating,ratedMatches:calc.ratedMatches??rated.length,delta,recentElo}
}
function tennisDecision22PeerProblem(){
  if(typeof tennisMatchBands!=="function")return null;
  const x=tennisMatchBands(),b=x?.buckets?.similar;if(!b||b.n<3)return null;
  return {band:x.band,n:b.n,w:b.w,l:b.l,wr:b.n?b.w/b.n*100:0}
}
function tennisDecision22OpponentRisk(){
  if(typeof tennisOpponentDeep!=="function")return [];
  return tennisOpponentDeep().filter(x=>x.n>=2).map(x=>({...x,wr:x.n?x.w/x.n*100:0})).sort((a,b)=>a.wr-b.wr||b.n-a.n||a.name.localeCompare(b.name,"ru")).slice(0,5)
}
function tennisDecision22DataQuality(){
  const sessions=tennisDecision22Sessions(30),ids=new Set(sessions.map(x=>String(x.id))),n=sessions.length;
  const details=typeof tennisGrowthDetails==="function"?tennisGrowthDetails().filter(x=>ids.has(String(x.sessionId))).length:0;
  const wear=typeof tennisHuaweiAll==="function"?tennisHuaweiAll().filter(x=>ids.has(String(x.sessionId))).length:0;
  const notes=sessions.filter(x=>String(x.note||"").trim()).length;
  const matches=tennisDecision22Matches().filter(x=>String(x.dateKey||"")>=localDateKey(addDays(new Date(),-29))&&["W","L"].includes(x.result));
  const rated=matches.filter(x=>(+x.opponentRating||0)>0).length;
  const pct0=(a,b)=>b>0?a/b*100:null;
  const components=[pct0(details,n),pct0(wear,n),pct0(notes,n),pct0(rated,matches.length)].filter(x=>x!=null);
  const score=components.length?components.reduce((a,b)=>a+b,0)/components.length:null;
  return {sessions:n,details,wear,notes,matches:matches.length,rated,detailPct:pct0(details,n),wearPct:pct0(wear,n),notePct:pct0(notes,n),ratedPct:pct0(rated,matches.length),score}
}
function tennisDecision22Prescription(){
  const load=tennisDecision22Load(),least=tennisDecision22LeastFocus(21),peer=tennisDecision22PeerProblem(),pace=tennisDecision22MonthPace(),form=tennisDecision22Form();
  const highLoad=(load.interpretable&&load.ratio!=null&&load.ratio>1.5)||(+load.hard3||0)>=2;
  const formDrop=form.delta!=null&&form.last10?.length>=5&&form.prev10?.length>=5&&form.delta<=-15;
  let type="Тренировка",minutes=90,rpe=6,focus=least.name||"Смешанная",serve=20,foot=15,reasons=[],segments=[];
  if(highLoad){
    type="Техника";minutes=60;rpe=4;serve=10;foot=10;
    segments=[["Разминка / ноги",10],[`${focus} — качество и стабильность`,25],["Подача + приём",15],["Лёгкие игровые связки",10]];
    reasons.push("Недельная нагрузка выше собственной недавней базы или уже было несколько тяжёлых сессий подряд.")
  }else if(peer&&peer.wr<50){
    type="Спарринг";minutes=90;rpe=7;focus="Тактика";serve=15;foot=10;
    segments=[["Разминка / ноги",10],[`${least.name} — технический блок`,20],["Подача + приём / первый ход",15],["Матчи с сопоставимыми соперниками",35],["Короткий разбор повторяющихся ошибок",10]];
    reasons.push(`Против сопоставимых соперников сейчас ${peer.w}:${peer.l} (${Math.round(peer.wr)}%).`)
  }else{
    segments=[["Разминка / ноги",15],[`${focus} — основной технический блок`,30],["Подача + приём / первый ход",20],["Тактика и игровые задания",15],["Контрольные партии / фиксация вывода",10]];
    reasons.push(`Меньше всего целевого времени за 21 день: ${least.name} (${Math.round(least.minutes)} мин).`)
  }
  if(!pace.onPace)reasons.push(`Темп месяца ниже линейной цели: ${pace.sessions}/${pace.target} сессий.`);
  if(formDrop)reasons.push(`Win rate последних матчей ниже предыдущего отрезка на ${Math.abs(Math.round(form.delta))} п.п.`);
  return {type,minutes,rpe,focus,serve,foot,segments,reasons,highLoad,peer,pace,load}
}
function tennisDecision22ApplyNext(){
  const p=tennisDecision22Prescription(),set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=String(v??"")};
  set("ttDate",localDateKey());set("ttType",p.type);set("ttMinutes",p.minutes);set("ttLoad",p.rpe);set("ttFocus",p.focus);set("ttServe",p.serve);set("ttFoot",p.foot);
  set("ttNote",`План 12.2: ${p.segments.map(x=>`${x[0]} ${x[1]} мин`).join("; ")}.`);
  if(typeof ux7SetView==="function")ux7SetView("tennis","training",true);
  document.getElementById("ttDate")?.scrollIntoView({behavior:"smooth",block:"center"});
  if(typeof toast==="function")toast("План следующей тренировки перенесён в форму")
}
function tennisDecision22SetHtml(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html}
function ensureTennisDecision22Ui(){
  if(document.getElementById("tennisDecision22Next"))return;
  const grid=document.querySelector?.("#tennis .grid"),anchor=document.getElementById("tennisOsCommand")?.closest(".card")||grid?.querySelector(".tennis-hero");
  if(!grid||!anchor||typeof anchor.insertAdjacentHTML!=="function")return;
  anchor.insertAdjacentHTML("afterend",`
    <div data-ux7-view="overview analytics" class="card ux7-card span-12">
      <div class="eyebrow">Tennis OS 12.2</div><div class="section-title">Следующая тренировка</div>
      <div class="muted" style="margin-top:6px">План строится из твоего тренировочного объёма, матчей и структуры последних сессий. Метрики Huawei используются как журнал нагрузки и не являются медицинской оценкой.</div>
      <div id="tennisDecision22Next" style="margin-top:12px"></div>
    </div>
    <div data-ux7-view="analytics" class="card ux7-card span-6"><div class="eyebrow">Form Trend</div><div class="title">Игровая форма</div><div id="tennisDecision22Form"></div></div>
    <div data-ux7-view="analytics" class="card ux7-card span-6"><div class="eyebrow">Load + Huawei</div><div class="title">Нагрузка и последняя сессия с часами</div><div id="tennisDecision22Load"></div></div>
    <div data-ux7-view="analytics" class="card ux7-card span-6"><div class="eyebrow">Match Problems</div><div class="title">Где теряются матчи</div><div id="tennisDecision22Opponents"></div></div>
    <div data-ux7-view="analytics" class="card ux7-card span-6"><div class="eyebrow">Evidence Quality</div><div class="title">Насколько полны данные</div><div id="tennisDecision22Quality"></div></div>
  `)
}
function renderTennisDecision22Next(){
  const p=tennisDecision22Prescription(),pace=p.pace;
  const segments=p.segments.map(x=>`<div class="goal"><div class="goal-top"><span>${escapeHtml(x[0])}</span><b>${x[1]} мин</b></div></div>`).join("");
  const reasons=p.reasons.length?p.reasons.map(x=>`<div class="qmeta" style="margin-top:5px">• ${escapeHtml(x)}</div>`).join(""):'<div class="qmeta">Данных пока мало; используется сбалансированный базовый шаблон.</div>';
  tennisDecision22SetHtml("tennisDecision22Next",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Формат</div><b>${escapeHtml(p.type)}</b></div><div class="report-item"><div class="smallcaps">Длительность</div><b>${p.minutes} мин</b></div><div class="report-item"><div class="smallcaps">RPE</div><b>${p.rpe}/10</b></div><div class="report-item"><div class="smallcaps">Главный фокус</div><b>${escapeHtml(p.focus)}</b></div><div class="report-item"><div class="smallcaps">Темп месяца</div><b>${pace.sessions}/${pace.target}</b></div><div class="report-item"><div class="smallcaps">Проекция месяца</div><b>${pace.projected.toFixed(1)} сесс.</b></div></div><div class="title" style="margin-top:14px">Структура сессии</div>${segments}<div class="title" style="margin-top:14px">Почему такой план</div>${reasons}<button class="btn secondary" style="margin-top:12px" onclick="tennisDecision22ApplyNext()">Заполнить форму этой тренировкой</button>`)
}
function renderTennisDecision22Form(){
  const f=tennisDecision22Form(),goal=Math.max(0,typeof tennisOsNumber==="function"?tennisOsNumber("tennisRatingGoal",0,0,100000):0),official=Math.max(0,+S.settings.tennisOfficialRating||0);
  tennisDecision22SetHtml("tennisDecision22Form",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Текущий Elo</div><b>${f.currentElo}</b></div><div class="report-item"><div class="smallcaps">Elo • 30 дней</div><b>${f.elo30>=0?"+":""}${f.elo30}</b></div><div class="report-item"><div class="smallcaps">Последние ${f.last10?.length||0}</div><b>${f.lastWr==null?"—":pct(f.lastWr,0)}</b></div><div class="report-item"><div class="smallcaps">К предыдущему отрезку</div><b>${f.delta==null?"—":`${f.delta>=0?"+":""}${Math.round(f.delta)} п.п.`}</b></div><div class="report-item"><div class="smallcaps">Официальный</div><b>${official||"—"}</b></div><div class="report-item"><div class="smallcaps">Цель</div><b>${goal||"—"}</b></div></div>${f.strongestWin?`<div class="status" style="margin-top:10px">Самая рейтинговая победа: <b>${escapeHtml(f.strongestWin.opponent||"соперник")} • ${f.strongestWin.opponentRating}</b>.</div>`:""}<div class="sub" style="margin-top:8px">Win rate и Elo описывают результаты записанных матчей; это не независимая оценка уровня техники.</div>`)
}
function renderTennisDecision22Load(){
  const l=tennisDecision22Load(),w=l.wearable,ratio=l.interpretable&&l.ratio!=null?`${l.ratio.toFixed(2)}×`:"—";
  const watch=w?`<div class="status" style="margin-top:10px"><b>${escapeHtml(w.dateKey||"Последняя сессия")}</b> • пульс ${w.avgHr??"—"} / ${w.maxHr??"—"}${w.recoveryHours!=null?` • оценка восстановления Huawei ${w.recoveryHours} ч`:""}${w.aerobicEffect!=null?` • аэроб. эффект ${w.aerobicEffect}`:""}${w.anaerobicEffect!=null?` • анаэроб. эффект ${w.anaerobicEffect}`:""}</div>`:'<div class="empty" style="margin-top:10px">Нет привязанных данных Huawei.</div>';
  tennisDecision22SetHtml("tennisDecision22Load",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Нагрузка 7 дней</div><b>${Math.round(l.acute||0)}</b><div class="sub">мин × RPE</div></div><div class="report-item"><div class="smallcaps">Обычная неделя</div><b>${Math.round(l.baseline||0)}</b></div><div class="report-item"><div class="smallcaps">7д / база</div><b>${ratio}</b></div><div class="report-item"><div class="smallcaps">Тяжёлых / 3 дня</div><b>${l.hard3||0}</b></div></div>${watch}<div class="sub" style="margin-top:8px">Показатель восстановления Huawei отображается как значение устройства и не интерпретируется как медицинское заключение.</div>`)
}
function renderTennisDecision22Opponents(){
  const peer=tennisDecision22PeerProblem(),rows=tennisDecision22OpponentRisk();
  const peerHtml=peer?`<div class="status">Сопоставимые ±${peer.band-1} Elo: <b>${peer.w}:${peer.l} • ${Math.round(peer.wr)}%</b>.</div>`:'<div class="status">Недостаточно рейтинговых матчей с сопоставимыми соперниками для устойчивого сравнения.</div>';
  const list=rows.length?rows.map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.name)}${x.rating?` • ${x.rating}`:""}</div><div class="qmeta">${x.n} матч. • ${x.w}:${x.l} • win rate ${Math.round(x.wr)}%</div></div>`).join(""):'<div class="empty">Для профиля нужны повторные матчи с именами соперников.</div>';
  tennisDecision22SetHtml("tennisDecision22Opponents",peerHtml+`<div class="title" style="margin-top:12px">Сложные повторные соперники</div>`+list+`<div class="sub" style="margin-top:8px">Плохой баланс побед сам по себе не говорит, какой именно технический элемент слабее; он только показывает, где нужен разбор матчей.</div>`)
}
function renderTennisDecision22Quality(){
  const q=tennisDecision22DataQuality(),f=v=>v==null?"—":`${Math.round(v)}%`,score=q.score==null?"—":`${Math.round(q.score)}%`;
  tennisDecision22SetHtml("tennisDecision22Quality",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Сессий / 30 дней</div><b>${q.sessions}</b></div><div class="report-item"><div class="smallcaps">Точная разбивка</div><b>${f(q.detailPct)}</b><div class="sub">${q.details}/${q.sessions}</div></div><div class="report-item"><div class="smallcaps">Huawei</div><b>${f(q.wearPct)}</b><div class="sub">${q.wear}/${q.sessions}</div></div><div class="report-item"><div class="smallcaps">Заметки</div><b>${f(q.notePct)}</b><div class="sub">${q.notes}/${q.sessions}</div></div><div class="report-item"><div class="smallcaps">Матчи с рейтингом</div><b>${f(q.ratedPct)}</b><div class="sub">${q.rated}/${q.matches}</div></div><div class="report-item"><div class="smallcaps">Покрытие данных</div><b>${score}</b></div></div><div class="sub" style="margin-top:8px">«Покрытие данных» — только полнота записей, не оценка качества тренировок.</div>`)
}
function renderTennisDecision22(){
  ensureTennisDecision22Ui();
  if(!document.getElementById("tennisDecision22Next"))return;
  renderTennisDecision22Next();renderTennisDecision22Form();renderTennisDecision22Load();renderTennisDecision22Opponents();renderTennisDecision22Quality()
}
