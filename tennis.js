"use strict";

/* Life RPG 10.0.2 — Tennis OS */

const TENNIS_WEEKLY=[
  {id:"sessions3",title:"3 тренировки за неделю",stat:"Теннис",xp:180,condition:()=>tennisWeek().sessions>=3},
  {id:"sessions4",title:"4 тренировки за неделю",stat:"Теннис",xp:250,condition:()=>tennisWeek().sessions>=4},
  {id:"tourney",title:"Турнир / рейтинговые игры",stat:"Теннис",xp:250,condition:()=>tennisWeek().tournaments>=1},
  {id:"serve60",title:"60 минут подачи / приёма",stat:"Теннис",xp:100,condition:()=>tennisWeek().serve>=60},
  {id:"foot45",title:"45 минут работы ног",stat:"Теннис",xp:100,condition:()=>tennisWeek().foot>=45}
];

function tennisWeek(){const [a,b]=weekBounds(),arr=S.tennis.filter(x=>inRange(x.dateKey,a,b));return {sessions:arr.length,tournaments:arr.filter(x=>x.type==="Турнир").length,serve:arr.reduce((n,x)=>n+(+x.serveMin||0),0),foot:arr.reduce((n,x)=>n+(+x.footMin||0),0)}}
function tennisSessionsDesc(){return (S.tennis||[]).slice().sort((a,b)=>String(b.dateKey||"").localeCompare(String(a.dateKey||""))||String(b.createdAt||"").localeCompare(String(a.createdAt||""))||String(b.id||"").localeCompare(String(a.id||"")))}
function eloExpected(r,opp){return 1/(1+Math.pow(10,(opp-r)/400))}
function eloAfterSession(r,opp,w,l,k=24){let cur=r;for(let i=0;i<w;i++)cur+=k*(1-eloExpected(cur,opp));for(let i=0;i<l;i++)cur+=k*(0-eloExpected(cur,opp));return Math.round(cur)}

function normalizeMatchResult(v){const s=String(v||"").trim().toLowerCase();if(["w","win","п","победа","1"].includes(s))return"W";if(["l","loss","пор","поражение","0"].includes(s))return"L";return""}
function parseTennisMatches(text){return String(text||"").split(/\n+/).map((line,i)=>{const parts=line.split("|").map(x=>x.trim());if(!parts.some(Boolean))return null;const [opponent,rating,result,score,note]=parts;return {id:`m-${Date.now()}-${i}`,opponent:opponent||"",opponentRating:Math.max(0,+rating||0),result:normalizeMatchResult(result),score:score||"",note:note||""}}).filter(Boolean).filter(m=>m.opponent||m.result||m.opponentRating||m.score)}
function sessionMatches(x){if(Array.isArray(x?.matches)&&x.matches.length)return x.matches.map((m,i)=>({id:m.id||`${x.id||"s"}-m${i+1}`,opponent:String(m.opponent||""),opponentRating:Math.max(0,+m.opponentRating||0),result:normalizeMatchResult(m.result),score:String(m.score||""),note:String(m.note||"")}));return []}
function tennisMatchText(x){const m=sessionMatches(x);return m.map(z=>[z.opponent,z.opponentRating||"",z.result,z.score,z.note].join(" | ")).join("\n")}
function sessionWinLoss(x){const m=sessionMatches(x);if(m.length)return {w:m.filter(z=>z.result==="W").length,l:m.filter(z=>z.result==="L").length};return {w:Math.max(0,+x.w||0),l:Math.max(0,+x.l||0)}}
function tennisAllMatches(){const out=[];for(const s of S.tennis||[]){const ms=sessionMatches(s);if(ms.length)for(const m of ms)out.push({...m,sessionId:s.id,dateKey:s.dateKey,type:s.type});else if((+s.w||0)+(+s.l||0)>0){for(let i=0;i<+s.w||0;i++)out.push({id:`${s.id}-lw${i}`,sessionId:s.id,dateKey:s.dateKey,type:s.type,opponent:s.opponent||"",opponentRating:+s.opponentRating||0,result:"W",score:s.score||"",legacy:true});for(let i=0;i<+s.l||0;i++)out.push({id:`${s.id}-ll${i}`,sessionId:s.id,dateKey:s.dateKey,type:s.type,opponent:s.opponent||"",opponentRating:+s.opponentRating||0,result:"L",score:s.score||"",legacy:true})}}return out}

function computeTennisElo(){let r=Math.max(0,finiteNumberOr(S.settings.tennisBaseElo,1000)),history=[],ratedMatches=0;const rows=tennisSessionsDesc().slice().reverse();for(const x of rows){const before=r,ms=sessionMatches(x);if(ms.length){for(const m of ms){const opp=+m.opponentRating||0;if(opp<=0||!["W","L"].includes(m.result))continue;r=eloAfterSession(r,opp,m.result==="W"?1:0,m.result==="L"?1:0);ratedMatches++}}else{const opp=+x.opponentRating||0;if(opp>0){r=eloAfterSession(r,opp,Math.max(0,+x.w||0),Math.max(0,+x.l||0));ratedMatches+=(+x.w||0)+(+x.l||0)}}history.push({id:x.id,before,after:r})}return {rating:r,history,ratedMatches}}
function recomputeTennisElo(){const calc=computeTennisElo(),by=new Map(calc.history.map(x=>[x.id,x]));for(const x of S.tennis||[]){const h=by.get(x.id);if(h){x.eloBefore=h.before;x.eloAfter=h.after}}S.settings.tennisElo=calc.rating;return calc.rating}

function tennisXpFor(x){const wl=sessionWinLoss(x);return Math.min(60,Math.floor((+x.min||0)/30)*15)+(x.type==="Турнир"?50:0)+Math.min(25,wl.w*5)+((+x.serveMin||0)>=20?15:0)+((+x.footMin||0)>=15?10:0)}
async function addTennis(){const dateKey=$("ttDate")?.value||localDateKey();if(!validActivityDate(dateKey)){toast("Тренировку можно добавить только за сегодня или прошедшую дату");return}const min=Math.max(0,+$("ttMinutes").value||0),load=clamp(+$("ttLoad").value||0,1,10),serveMin=Math.max(0,+$("ttServe").value||0),footMin=Math.max(0,+$("ttFoot").value||0);if(min<=0){toast("Укажи длительность");return}if(serveMin+footMin>min){toast("Подача/приём + ноги не могут быть дольше всей сессии");return}const editId=$("ttEditId")?.value||"",old=editId?S.tennis.find(x=>x.id===editId):null;if(old){S.tennis=S.tennis.filter(x=>x.id!==editId);removeXp(old.xpAward||0,"Теннис","Редактирование тренировки",`tennis:${editId}`,old.dateKey)}const matches=parseTennisMatches($("ttMatches")?.value||""),legacyW=Math.max(0,Math.round(+$("ttW").value||0)),legacyL=Math.max(0,Math.round(+$("ttL").value||0)),wl=matches.length?{w:matches.filter(m=>m.result==="W").length,l:matches.filter(m=>m.result==="L").length}:{w:legacyW,l:legacyL};const x={id:old?.id||uid(),dateKey,date:parseLocal(dateKey).toLocaleDateString("ru-RU"),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),type:$("ttType").value,min,focus:$("ttFocus").value,load,w:wl.w,l:wl.l,serveMin,footMin,matches,opponent:matches[0]?.opponent||$("ttOpponent").value.trim(),opponentRating:matches[0]?.opponentRating||Math.max(0,+$("ttOpponentRating")?.value||0),score:matches[0]?.score||$("ttScore").value.trim(),note:$("ttNote").value.trim()};x.xpAward=tennisXpFor(x);S.tennis.unshift(x);recomputeTennisElo();const sx=S.tennis.find(z=>z.id===x.id);addXp(x.xpAward,"Теннис",old?"Теннисная сессия обновлена":"Теннисная сессия",`tennis:${x.id}`,"process",dateKey);audit(old?"Теннис изменён":"Теннис","sport",`${x.type} • Elo ${sx?.eloBefore??"—"}→${sx?.eloAfter??"—"}`);cancelTennisEdit();await save(`${old?"Сессия обновлена":"Сессия сохранена"} • текущий внутренний Elo ${S.settings.tennisElo}`)}
async function deleteTennis(id){const i=S.tennis.findIndex(x=>x.id===id);if(i<0)return;const x=S.tennis[i];if(!confirm("Удалить эту тренировку? Её можно будет восстановить из корзины."))return;await createPreActionSnapshot("Перед удалением теннисной сессии");trashPush("tennis",x);S.tennis.splice(i,1);removeXp(x.xpAward||0,"Теннис","Удалена тренировка",`tennis:${id}`,x.dateKey);recomputeTennisElo();await save("Тренировка удалена • Elo пересчитан, восстановление доступно")}
function editTennis(id){const x=S.tennis.find(z=>z.id===id);if(!x)return;const vals={ttEditId:x.id,ttDate:x.dateKey,ttMinutes:x.min,ttLoad:x.load,ttServe:x.serveMin||0,ttFoot:x.footMin||0,ttW:x.w||0,ttL:x.l||0,ttOpponent:x.opponent||"",ttOpponentRating:x.opponentRating||"",ttScore:x.score||"",ttNote:x.note||"",ttMatches:tennisMatchText(x)};for(const [id,v] of Object.entries(vals))if($(id))$(id).value=v??"";if($("ttType"))$("ttType").value=x.type||"Тренировка";if($("ttFocus"))$("ttFocus").value=x.focus||"Смешанная";if($("ttSaveBtn"))$("ttSaveBtn").textContent="Обновить сессию";if($("ttCancelEdit"))$("ttCancelEdit").hidden=false;$("ttDate")?.scrollIntoView({behavior:"smooth",block:"center"})}
function cancelTennisEdit(){for(const id of ["ttW","ttL","ttServe","ttFoot"])if($(id))$(id).value=0;if($("ttMinutes"))$("ttMinutes").value=90;if($("ttLoad"))$("ttLoad").value=7;for(const id of ["ttOpponent","ttOpponentRating","ttScore","ttNote","ttMatches","ttEditId"])if($(id))$(id).value="";if($("ttDate"))$("ttDate").value=localDateKey();if($("ttSaveBtn"))$("ttSaveBtn").textContent="Сохранить сессию";if($("ttCancelEdit"))$("ttCancelEdit").hidden=true}

function tennisLoad7(){const start=addDays(new Date(),-6);return S.tennis.filter(x=>parseLocal(x.dateKey)>=new Date(start.getFullYear(),start.getMonth(),start.getDate())).reduce((a,x)=>a+(+x.min||0)*(+x.load||0),0)}
function tennisExposure(days=14){const start=localDateKey(addDays(new Date(),-(days-1))),exp={FH:0,BH:0,"Подача":0,"Приём":0,"Ноги":0,"Тактика":0};for(const x of S.tennis.filter(s=>s.dateKey>=start)){const min=Math.max(0,+x.min||0);if(x.focus==="Смешанная")for(const k of Object.keys(exp))exp[k]+=min/6;else if(exp[x.focus]!=null)exp[x.focus]+=min;exp["Подача"]+=Math.max(0,+x.serveMin||0);exp["Ноги"]+=Math.max(0,+x.footMin||0)}return exp}
function tennisFocusRecommendation(){const exp=tennisExposure(14),total=Object.values(exp).reduce((a,b)=>a+b,0);if(!total)return"нет данных";return Object.entries(exp).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0],"ru"))[0][0]}
function tennisRecommendation(){const focus=tennisFocusRecommendation(),week=tennisWeek(),load=tennisLoad7();if(week.sessions<3)return `Сначала добери регулярность: ${week.sessions}/3 сессий на неделе. Фокус следующей тренировки — ${focus}.`;if(load>4500)return `Нагрузка за 7 дней высокая (${Math.round(load)} мин×RPE). Следующую сессию сделай легче, с техникой ${focus}.`;return `Следующий технический приоритет — ${focus}: за последние 14 дней на него пришлось меньше всего целевой работы.`}

function renderTennisAnalytics(){const box=$("tennisAnalytics");if(!box)return;const calc=computeTennisElo(),load=tennisLoad7(),focus=tennisFocusRecommendation(),matches=tennisAllMatches(),rated=matches.filter(m=>(+m.opponentRating||0)>0&&["W","L"].includes(m.result)).length,official=Math.max(0,+S.settings.tennisOfficialRating||0);box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Внутренний Elo</div><b>${calc.rating}</b><div class="sub">только матчи с рейтингом соперника</div></div><div class="report-item"><div class="smallcaps">Официальный рейтинг</div><b>${official||"—"}</b></div><div class="report-item"><div class="smallcaps">Рейтинговых матчей</div><b>${rated}</b></div><div class="report-item"><div class="smallcaps">Нагрузка 7 дней</div><b>${Math.round(load)}</b><div class="sub">минуты × RPE</div></div><div class="report-item"><div class="smallcaps">Технический приоритет</div><b>${escapeHtml(focus)}</b></div><div class="report-item"><div class="smallcaps">Цель месяца</div><b>${S.tennis.filter(x=>x.dateKey?.startsWith(localMonthKey())).length}/${S.settings.tennisMonthlyTarget||12}</b></div></div><div class="notice" style="margin-top:10px">${escapeHtml(tennisRecommendation())}</div>`}

function renderTennis(){const ss=tennisSessionsDesc(),mins=ss.reduce((a,x)=>a+(+x.min||0),0),all=tennisAllMatches(),w=all.filter(m=>m.result==="W").length,l=all.filter(m=>m.result==="L").length,month=ss.filter(x=>x.dateKey?.startsWith(localMonthKey())),last10=all.slice().sort((a,b)=>String(b.dateKey).localeCompare(String(a.dateKey))).slice(0,10),lw=last10.filter(m=>m.result==="W").length,ll=last10.filter(m=>m.result==="L").length;$("ttSessions").textContent=ss.length;$("ttHours").textContent=(mins/60).toFixed(1);$("ttWinRate").textContent=pct(w+l?w/(w+l)*100:0,0);$("ttMonthSessions").textContent=month.length;$("ttLast10").textContent=pct(lw+ll?lw/(lw+ll)*100:0,0);if($("ttElo"))$("ttElo").textContent=String(computeTennisElo().rating);const sk=tennisExposure(30),max=Math.max(1,...Object.values(sk));$("tennisSkills").innerHTML=Object.entries(sk).map(([k,v])=>`<div class="stat-row"><div class="stat-name">${k}</div><div class="statbar"><i style="width:${clamp(v/max*100,0,100)}%"></i></div><div class="stat-xp">${Math.round(v)}м</div></div>`).join("");$("tennisQuests").innerHTML=renderQuestGroup(TENNIS_WEEKLY,"tennis");renderOpponents();renderTennisMonthly();renderTennisAnalytics();$("tennisLog").innerHTML=ss.length?ss.slice(0,12).map(x=>{const wl=sessionWinLoss(x),ms=sessionMatches(x);return `<div class="log-item"><div class="qtitle">${fmtDate(parseLocal(x.dateKey))} • ${escapeHtml(x.type)} • ${x.min} мин</div><div class="score">${escapeHtml(x.focus)} • матчи ${wl.w}:${wl.l} • нагрузка ${x.load}/10 • подача/приём ${x.serveMin||0} мин • ноги ${x.footMin||0} мин</div>${ms.length?`<div class="qmeta">${ms.map(m=>`${escapeHtml(m.opponent||"соперник")} ${m.opponentRating?`(${m.opponentRating}) `:""}${m.result||"?"}${m.score?` ${escapeHtml(m.score)}`:""}`).join(" • ")}</div>`:x.opponent?`<div class="qmeta">Legacy: ${escapeHtml(x.opponent)}${x.opponentRating?` • ${x.opponentRating}`:""}</div>`:""}${x.note?`<div class="qmeta">${escapeHtml(x.note)}</div>`:""}<div class="split" style="margin-top:7px"><button class="btn ghost small" onclick="editTennis('${x.id}')">Изменить</button><button class="btn ghost small" onclick="deleteTennis('${x.id}')">Удалить</button></div></div>`}).join(""):`<div class="empty">Пока нет сессий.</div>`}

function renderOpponents(){const map={};for(const x of tennisAllMatches()){if(!String(x.opponent||"").trim())continue;const display=x.opponent.trim(),k=display.toLowerCase().replace(/\s+/g," ");map[k]=map[k]||{name:display,w:0,l:0,s:0,rating:0};if(x.result==="W")map[k].w++;if(x.result==="L")map[k].l++;map[k].s++;if(+x.opponentRating>0)map[k].rating=+x.opponentRating}const arr=Object.values(map).sort((a,b)=>b.s-a.s||a.name.localeCompare(b.name,"ru")).slice(0,12);$("opponentJournal").innerHTML=arr.length?arr.map(v=>`<div class="log-item"><div class="qtitle">${escapeHtml(v.name)}${v.rating?` • ${v.rating}`:""}</div><div class="score">${v.s} матч. • ${v.w}:${v.l} • win rate ${pct(v.w+v.l?v.w/(v.w+v.l)*100:0,0)}</div></div>`).join(""):`<div class="empty">Добавляй матчи — здесь появится история соперников.</div>`}
function renderTennisMonthly(){const arr=S.tennis.filter(x=>x.dateKey?.startsWith(localMonthKey())),mins=arr.reduce((a,x)=>a+(+x.min||0),0),matches=tennisAllMatches().filter(x=>x.dateKey?.startsWith(localMonthKey())),w=matches.filter(x=>x.result==="W").length,l=matches.filter(x=>x.result==="L").length,tour=arr.filter(x=>x.type==="Турнир").length,serve=arr.reduce((a,x)=>a+(+x.serveMin||0),0),foot=arr.reduce((a,x)=>a+(+x.footMin||0),0);$("tennisMonthlyReport").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Сессии</div><b>${arr.length}</b></div><div class="report-item"><div class="smallcaps">Часы</div><b>${(mins/60).toFixed(1)}</b></div><div class="report-item"><div class="smallcaps">Турниры</div><b>${tour}</b></div><div class="report-item"><div class="smallcaps">Матчи</div><b>${matches.length}</b></div><div class="report-item"><div class="smallcaps">Win rate</div><b>${pct(w+l?w/(w+l)*100:0,0)}</b></div><div class="report-item"><div class="smallcaps">Подача/приём</div><b>${serve} мин</b></div><div class="report-item"><div class="smallcaps">Ноги</div><b>${foot} мин</b></div></div>`}


/* Tennis OS deep analytics layer — first iteration.
   No new mandatory input fields. New settings live inside the existing settings object. */

function tennisOsNumber(key,fallback,min=0,max=Number.POSITIVE_INFINITY){
  const v=Number(S.settings?.[key]);
  return Number.isFinite(v)?clamp(v,min,max):fallback
}
function tennisDateStart(days){
  const d=addDays(new Date(),-(days-1));
  return localDateKey(new Date(d.getFullYear(),d.getMonth(),d.getDate(),12))
}
function tennisSessionsInDays(days){const start=tennisDateStart(days);return (S.tennis||[]).filter(x=>String(x.dateKey||"")>=start)}
function tennisLoadInDays(days){return tennisSessionsInDays(days).reduce((s,x)=>s+Math.max(0,+x.min||0)*clamp(+x.load||0,0,10),0)}
function tennisLoadProfile(){
  const acute=tennisLoadInDays(7),load28=tennisLoadInDays(28),baseline=load28/4,sessions28=tennisSessionsInDays(28).length,ratio=baseline>0?acute/baseline:null;
  const hard3=tennisSessionsInDays(3).filter(x=>(+x.load||0)>=8).length;
  return {acute,load28,baseline,sessions28,ratio,hard3,interpretable:sessions28>=4&&baseline>0}
}
function tennisExposureDeep(days=14){
  const start=tennisDateStart(days),exp={FH:0,BH:0,"Подача":0,"Приём":0,"Ноги":0,"Тактика":0};
  for(const x of (S.tennis||[]).filter(s=>String(s.dateKey||"")>=start)){
    const total=Math.max(0,+x.min||0),serve=Math.min(total,Math.max(0,+x.serveMin||0)),foot=Math.min(Math.max(0,total-serve),Math.max(0,+x.footMin||0)),remaining=Math.max(0,total-serve-foot);
    exp["Подача"]+=serve/2;exp["Приём"]+=serve/2;exp["Ноги"]+=foot;
    const focus=String(x.focus||"Смешанная");
    if(focus==="Смешанная"){exp.FH+=remaining/3;exp.BH+=remaining/3;exp["Тактика"]+=remaining/3}
    else if(exp[focus]!=null)exp[focus]+=remaining;
    else exp["Тактика"]+=remaining;
  }
  return exp
}
tennisExposure=function(days=14){return tennisExposureDeep(days)};
tennisFocusRecommendation=function(){const exp=tennisExposureDeep(14),total=Object.values(exp).reduce((a,b)=>a+b,0);if(!total)return"нет данных";return Object.entries(exp).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0],"ru"))[0][0]};

function tennisMatchTimeline(){
  let rating=Math.max(0,finiteNumberOr(S.settings.tennisBaseElo,1000)),out=[];
  const sessions=tennisSessionsDesc().slice().reverse();
  for(const s of sessions){
    let ms=sessionMatches(s);
    if(!ms.length&&((+s.w||0)+(+s.l||0)>0)){
      ms=[];
      for(let i=0;i<Math.max(0,+s.w||0);i++)ms.push({id:`${s.id}-lw${i}`,opponent:s.opponent||"",opponentRating:+s.opponentRating||0,result:"W",score:s.score||"",legacy:true});
      for(let i=0;i<Math.max(0,+s.l||0);i++)ms.push({id:`${s.id}-ll${i}`,opponent:s.opponent||"",opponentRating:+s.opponentRating||0,result:"L",score:s.score||"",legacy:true});
    }
    for(const m of ms){
      const opp=Math.max(0,+m.opponentRating||0),result=normalizeMatchResult(m.result),before=rating;
      if(opp>0&&["W","L"].includes(result))rating=eloAfterSession(rating,opp,result==="W"?1:0,result==="L"?1:0);
      out.push({...m,sessionId:s.id,dateKey:s.dateKey,type:s.type,ownBefore:before,ownAfter:rating,eloDelta:rating-before,rated:opp>0&&["W","L"].includes(result)});
    }
  }
  return out
}
function tennisMatchBands(){
  const band=Math.round(tennisOsNumber("tennisRatingBand",100,25,500)),rows=tennisMatchTimeline().filter(x=>x.rated);
  const buckets={
    stronger:{label:`Сильнее ≥${band}`,w:0,l:0,n:0},
    similar:{label:`Сопоставимые ±${band-1}`,w:0,l:0,n:0},
    weaker:{label:`Ниже ≤-${band}`,w:0,l:0,n:0}
  };
  for(const m of rows){const diff=(+m.opponentRating||0)-m.ownBefore,k=diff>=band?"stronger":diff<=-band?"weaker":"similar",b=buckets[k];b.n++;if(m.result==="W")b.w++;if(m.result==="L")b.l++}
  return {band,rows,buckets}
}
function tennisFormData(){
  const all=tennisMatchTimeline().filter(x=>["W","L"].includes(x.result)).slice().reverse(),last10=all.slice(0,10),prev10=all.slice(10,20);
  const wr=a=>a.length?a.filter(x=>x.result==="W").length/a.length*100:null;
  const rated=tennisMatchTimeline().filter(x=>x.rated),cut=tennisDateStart(30),r30=rated.filter(x=>String(x.dateKey||"")>=cut),elo30=r30.length?r30[r30.length-1].ownAfter-r30[0].ownBefore:0;
  const strongestWin=rated.filter(x=>x.result==="W").sort((a,b)=>(+b.opponentRating||0)-(+a.opponentRating||0))[0]||null;
  return {last10,prev10,lastWr:wr(last10),prevWr:wr(prev10),elo30,strongestWin}
}
function tennisDaysSinceLast(){
  const s=tennisSessionsDesc()[0];if(!s?.dateKey)return null;
  return Math.max(0,Math.floor((parseLocal(localDateKey())-parseLocal(s.dateKey))/86400000))
}
function tennisMonthStats(){
  const month=localMonthKey(),sessions=(S.tennis||[]).filter(x=>String(x.dateKey||"").startsWith(month)),matches=tennisAllMatches().filter(x=>String(x.dateKey||"").startsWith(month));
  return {sessions:sessions.length,tournaments:sessions.filter(x=>x.type==="Турнир").length,matches:matches.length,wins:matches.filter(x=>x.result==="W").length,losses:matches.filter(x=>x.result==="L").length}
}
function tennisPlanFact(){
  const week=tennisWeek(),month=tennisMonthStats();
  return {
    weekSessions:week.sessions,weekTarget:Math.round(tennisOsNumber("tennisWeeklyTarget",4,1,14)),
    monthSessions:month.sessions,monthTarget:Math.round(tennisOsNumber("tennisMonthlyTarget",12,1,60)),
    tournaments:month.tournaments,tournamentTarget:Math.round(tennisOsNumber("tennisTournamentMonthlyTarget",4,0,20)),
    serve:week.serve,serveTarget:Math.round(tennisOsNumber("tennisServeWeeklyTarget",60,0,1000)),
    foot:week.foot,footTarget:Math.round(tennisOsNumber("tennisFootWeeklyTarget",45,0,1000))
  }
}
function tennisDecisionEngineDeep(){
  const items=[],plan=tennisPlanFact(),load=tennisLoadProfile(),focus=tennisFocusRecommendation(),days=tennisDaysSinceLast(),form=tennisFormData(),bands=tennisMatchBands();
  if(plan.weekSessions<plan.weekTarget)items.push({kind:"regularity",title:"Добрать недельный объём",meta:`Сессии: ${plan.weekSessions}/${plan.weekTarget}. До цели недели осталось ${plan.weekTarget-plan.weekSessions}.`});
  if(load.interpretable&&load.ratio>1.5)items.push({kind:"load",title:"Сделать следующую сессию легче",meta:`Нагрузка 7 дней ${Math.round(load.acute)} мин×RPE — ${load.ratio.toFixed(2)}× твоей средней недельной нагрузки за 28 дней.`});
  else if(load.hard3>=2)items.push({kind:"load",title:"Не ставить ещё одну тяжёлую сессию подряд",meta:`За последние 3 дня уже ${load.hard3} сессии с RPE ≥8. Логичнее техника/подача/приём.`});
  else if(days!=null&&days>=3)items.push({kind:"regularity",title:"Вернуться к столу",meta:`Последняя сессия была ${days} дн. назад.`});
  if(plan.tournaments<plan.tournamentTarget)items.push({kind:"competition",title:"Добавить соревновательную практику",meta:`Турниры месяца: ${plan.tournaments}/${plan.tournamentTarget}.`});
  if(focus!=="нет данных")items.push({kind:"technique",title:`Технический приоритет: ${focus}`,meta:"Это зона с минимальным объёмом целевой работы за последние 14 дней."});
  const similar=bands.buckets.similar;if(similar.n>=4&&similar.w/similar.n<0.5)items.push({kind:"matches",title:"Больше игр с сопоставимыми соперниками",meta:`В диапазоне ±${bands.band-1}: ${similar.w}:${similar.l}. Это наиболее полезная выборка для контроля игрового прогресса.`});
  if(form.last10.length>=5&&form.prev10.length>=5&&form.lastWr+15<form.prevWr)items.push({kind:"form",title:"Форма просела относительно предыдущего отрезка",meta:`Последние ${form.last10.length}: ${pct(form.lastWr,0)}; предыдущие ${form.prev10.length}: ${pct(form.prevWr,0)}. Проверь нагрузку и повторяющиеся причины поражений.`});
  return items.slice(0,7)
}
tennisRecommendation=function(){const x=tennisDecisionEngineDeep()[0];return x?`${x.title}. ${x.meta}`:"Сохраняй текущий ритм и продолжай накапливать данные."};

function tennisOpponentDeep(){
  const map=new Map();
  for(const m of tennisMatchTimeline()){
    const name=String(m.opponent||"").trim();if(!name)continue;const key=name.toLocaleLowerCase("ru-RU").replace(/\s+/g," "),x=map.get(key)||{name,n:0,w:0,l:0,rating:0,elo:0};
    x.n++;if(m.result==="W")x.w++;if(m.result==="L")x.l++;if(+m.opponentRating>0)x.rating=+m.opponentRating;x.elo+=m.eloDelta||0;map.set(key,x)
  }
  return [...map.values()].sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name,"ru"))
}
function tennisOsSetHtml(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html}
function ensureTennisOsUi(){
  if(document.getElementById("tennisOsCommand"))return;
  const grid=document.querySelector?.("#tennis .grid");if(!grid)return;
  const anchor=grid.querySelector?.(".tennis-hero")||null,target=anchor||grid;if(typeof target.insertAdjacentHTML!=="function")return;
  target.insertAdjacentHTML(anchor?"afterend":"beforeend",`
    <div data-ux7-view="overview analytics" class="card ux7-card span-12"><div class="eyebrow">Tennis OS</div><div class="section-title">Центр тренировочных решений</div><div class="muted" style="margin-top:6px">План/факт, форма, игровая динамика и нагрузка относительно твоей собственной истории. Это тренировочная аналитика, а не медицинская оценка риска.</div><div id="tennisOsCommand" style="margin-top:12px"></div></div>
    <div data-ux7-view="analytics" class="card ux7-card span-6"><div class="eyebrow">Load Engine</div><div class="title">Нагрузка и плотность</div><div id="tennisOsLoad"></div></div>
    <div data-ux7-view="analytics" class="card ux7-card span-6"><div class="eyebrow">Match Engine</div><div class="title">Результаты по уровню соперника</div><div id="tennisOsBands"></div></div>
    <div data-ux7-view="overview analytics" class="card ux7-card span-6"><div class="title">План → факт</div><div id="tennisOsPlan"></div></div>
    <div data-ux7-view="analytics" class="card ux7-card span-6"><div class="title">Игровая форма</div><div id="tennisOsForm"></div></div>
    <div data-ux7-view="analytics" class="card ux7-card span-6"><div class="title">Баланс технической работы • 28 дней</div><div id="tennisOsExposure"></div></div>
    <div data-ux7-view="analytics" class="card ux7-card span-6"><div class="title">Соперники: расширенный профиль</div><div id="tennisOsOpponents"></div></div>
    <div data-ux7-view="analytics" class="card ux7-card span-12"><details><summary>Настройки Tennis OS</summary><div class="formgrid" style="margin-top:12px"><div class="field"><label>Сессий / неделю</label><input id="tennisOsWeeklyTarget" type="number" min="1" max="14"></div><div class="field"><label>Сессий / месяц</label><input id="tennisOsMonthlyTarget" type="number" min="1" max="60"></div><div class="field"><label>Турниров / месяц</label><input id="tennisOsTournamentTarget" type="number" min="0" max="20"></div><div class="field"><label>Подача/приём / неделю, мин</label><input id="tennisOsServeTarget" type="number" min="0"></div><div class="field"><label>Ноги / неделю, мин</label><input id="tennisOsFootTarget" type="number" min="0"></div><div class="field"><label>Граница уровня соперника, Elo</label><input id="tennisOsRatingBand" type="number" min="25" max="500"></div><div class="field"><label>Официальный рейтинг</label><input id="tennisOsOfficial" type="number" min="0"></div><div class="field"><label>Цель по рейтингу</label><input id="tennisOsRatingGoal" type="number" min="0"></div></div><button class="btn secondary" style="margin-top:12px" onclick="saveTennisOsSettings()">Сохранить настройки</button></details></div>
  `)
}
function renderTennisOsCommand(){
  const p=tennisPlanFact(),f=tennisFormData(),calc=computeTennisElo(),actions=tennisDecisionEngineDeep(),goal=Math.max(0,tennisOsNumber("tennisRatingGoal",0,0,100000));
  tennisOsSetHtml("tennisOsCommand",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Неделя</div><b>${p.weekSessions}/${p.weekTarget}</b></div><div class="report-item"><div class="smallcaps">Elo</div><b>${calc.rating}</b></div><div class="report-item"><div class="smallcaps">Elo • 30 дней</div><b>${f.elo30>=0?"+":""}${f.elo30}</b></div><div class="report-item"><div class="smallcaps">Последние 10</div><b>${f.lastWr==null?"—":pct(f.lastWr,0)}</b></div><div class="report-item"><div class="smallcaps">Цель рейтинга</div><b>${goal||"—"}</b></div></div>${actions.length?`<div class="title" style="margin-top:14px">Что делать дальше</div>${actions.map(a=>`<div class="quest"><span class="tag ${a.kind==="load"?"warn":""}">${a.kind==="load"?"Нагрузка":a.kind==="technique"?"Техника":a.kind==="competition"?"Игры":"Приоритет"}</span><div class="qbody"><div class="qtitle">${escapeHtml(a.title)}</div><div class="qmeta">${escapeHtml(a.meta)}</div></div></div>`).join("")}`:""}`)
}
function renderTennisOsLoad(){
  const l=tennisLoadProfile(),days=tennisDaysSinceLast(),ratio=l.interpretable?`${l.ratio.toFixed(2)}×`:"—";
  const text=!l.interpretable?"Нужно минимум несколько сессий за 28 дней, чтобы сравнение с собственной базой было осмысленным.":l.ratio>1.5?"Текущая недельная нагрузка заметно выше твоей средней за 28 дней. Это повод снизить следующую нагрузку, а не оценка риска травмы.":l.ratio<0.6?"Текущая неделя заметно легче твоей недавней средней.":"Текущая неделя близка к твоей собственной недавней базе.";
  tennisOsSetHtml("tennisOsLoad",`<div class="goal"><div class="goal-top"><span>7 дней</span><b>${Math.round(l.acute)} мин×RPE</b></div><div class="goal-top" style="margin-top:7px"><span>Средняя неделя по 28 дням</span><b>${Math.round(l.baseline)} мин×RPE</b></div><div class="goal-top" style="margin-top:7px"><span>Отношение</span><b>${ratio}</b></div><div class="goal-top" style="margin-top:7px"><span>Тяжёлых сессий за 3 дня</span><b>${l.hard3}</b></div><div class="goal-top" style="margin-top:7px"><span>Дней с последней сессии</span><b>${days==null?"—":days}</b></div></div><div class="status" style="margin-top:10px">${escapeHtml(text)}</div>`)
}
function renderTennisOsBands(){
  const x=tennisMatchBands(),arr=Object.values(x.buckets);
  tennisOsSetHtml("tennisOsBands",arr.map(b=>`<div class="goal"><div class="goal-top"><span>${escapeHtml(b.label)}</span><b>${b.n?`${b.w}:${b.l}`:"—"}</b></div><div class="qmeta">${b.n?`win rate ${pct(b.w/b.n*100,0)} • ${b.n} матч.`:"Нет рейтинговых матчей в диапазоне"}</div></div>`).join("")+`<div class="sub" style="margin-top:8px">Уровень определяется относительно твоего внутреннего Elo непосредственно перед каждым матчем.</div>`)
}
function renderTennisOsPlan(){
  const p=tennisPlanFact(),rows=[["Сессии недели",p.weekSessions,p.weekTarget],["Сессии месяца",p.monthSessions,p.monthTarget],["Турниры месяца",p.tournaments,p.tournamentTarget],["Подача/приём недели",p.serve,p.serveTarget],["Ноги недели",p.foot,p.footTarget]];
  tennisOsSetHtml("tennisOsPlan",rows.map(([label,fact,target])=>{const pc=target>0?clamp(fact/target*100,0,100):100;return `<div class="goal"><div class="goal-top"><span>${label}</span><b>${fact}/${target}</b></div><div class="progress"><i style="width:${pc}%"></i></div></div>`}).join(""))
}
function renderTennisOsForm(){
  const f=tennisFormData(),delta=f.lastWr!=null&&f.prevWr!=null?f.lastWr-f.prevWr:null;
  tennisOsSetHtml("tennisOsForm",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Последние ${f.last10.length||0}</div><b>${f.lastWr==null?"—":pct(f.lastWr,0)}</b></div><div class="report-item"><div class="smallcaps">Предыдущие ${f.prev10.length||0}</div><b>${f.prevWr==null?"—":pct(f.prevWr,0)}</b></div><div class="report-item"><div class="smallcaps">Изменение win rate</div><b>${delta==null?"—":`${delta>=0?"+":""}${delta.toFixed(0)} п.п.`}</b></div><div class="report-item"><div class="smallcaps">Elo • 30 дней</div><b>${f.elo30>=0?"+":""}${f.elo30}</b></div></div>${f.strongestWin?`<div class="status" style="margin-top:10px">Самая рейтинговая победа: <b>${escapeHtml(f.strongestWin.opponent||"соперник")} • ${f.strongestWin.opponentRating}</b>.</div>`:""}`)
}
function renderTennisOsExposure(){
  const e=tennisExposureDeep(28),max=Math.max(1,...Object.values(e));
  tennisOsSetHtml("tennisOsExposure",Object.entries(e).map(([k,v])=>`<div class="stat-row"><div class="stat-name">${escapeHtml(k)}</div><div class="statbar"><i style="width:${clamp(v/max*100,0,100)}%"></i></div><div class="stat-xp">${Math.round(v)}м</div></div>`).join("")+`<div class="sub" style="margin-top:8px">Явные минуты подачи/приёма и ног вычитаются из общей длительности, поэтому больше не происходит двойного учёта времени.</div>`)
}
function renderTennisOsOpponents(){
  const arr=tennisOpponentDeep().slice(0,8);
  tennisOsSetHtml("tennisOsOpponents",arr.length?arr.map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.name)}${x.rating?` • ${x.rating}`:""}</div><div class="score">${x.n} матч. • ${x.w}:${x.l} • ${pct(x.n?x.w/x.n*100:0,0)} • Elo ${x.elo>=0?"+":""}${x.elo}</div></div>`).join(""):'<div class="empty">Добавляй матчи с именами соперников — профиль появится автоматически.</div>')
}
function renderTennisOsSettings(){
  const vals={
    tennisOsWeeklyTarget:Math.round(tennisOsNumber("tennisWeeklyTarget",4,1,14)),
    tennisOsMonthlyTarget:Math.round(tennisOsNumber("tennisMonthlyTarget",12,1,60)),
    tennisOsTournamentTarget:Math.round(tennisOsNumber("tennisTournamentMonthlyTarget",4,0,20)),
    tennisOsServeTarget:Math.round(tennisOsNumber("tennisServeWeeklyTarget",60,0,1000)),
    tennisOsFootTarget:Math.round(tennisOsNumber("tennisFootWeeklyTarget",45,0,1000)),
    tennisOsRatingBand:Math.round(tennisOsNumber("tennisRatingBand",100,25,500)),
    tennisOsOfficial:Math.max(0,+S.settings.tennisOfficialRating||0),
    tennisOsRatingGoal:Math.max(0,tennisOsNumber("tennisRatingGoal",0,0,100000))
  };
  for(const [id,v] of Object.entries(vals)){const el=document.getElementById(id);if(el&&!el.dataset.ready){el.value=String(v);el.dataset.ready="1"}}
}
async function saveTennisOsSettings(){
  const n=(id,min,max)=>clamp(Number(document.getElementById(id)?.value)||0,min,max);
  S.settings.tennisWeeklyTarget=Math.round(n("tennisOsWeeklyTarget",1,14));
  S.settings.tennisMonthlyTarget=Math.round(n("tennisOsMonthlyTarget",1,60));
  S.settings.tennisTournamentMonthlyTarget=Math.round(n("tennisOsTournamentTarget",0,20));
  S.settings.tennisServeWeeklyTarget=Math.round(n("tennisOsServeTarget",0,1000));
  S.settings.tennisFootWeeklyTarget=Math.round(n("tennisOsFootTarget",0,1000));
  S.settings.tennisRatingBand=Math.round(n("tennisOsRatingBand",25,500));
  S.settings.tennisOfficialRating=Math.round(n("tennisOsOfficial",0,100000));
  S.settings.tennisRatingGoal=Math.round(n("tennisOsRatingGoal",0,100000));
  audit("Настройки Tennis OS","sport",`Неделя ${S.settings.tennisWeeklyTarget} • месяц ${S.settings.tennisMonthlyTarget}`);
  await save("Настройки Tennis OS сохранены")
}
function renderTennisOsPanels(){
  if(!document.getElementById("tennisOsCommand"))return;
  renderTennisOsCommand();renderTennisOsLoad();renderTennisOsBands();renderTennisOsPlan();renderTennisOsForm();renderTennisOsExposure();renderTennisOsOpponents();renderTennisOsSettings()
}

const renderTennis1002=renderTennis;
renderTennis=function(){renderTennis1002();ensureTennisOsUi();renderTennisOsPanels()};
