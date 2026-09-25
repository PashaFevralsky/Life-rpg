"use strict";

/* Work OS 12.1 — sales execution, deal health and pipeline structure.
   Additive layer over work.js. No state schema migration. */

function work121OpenDeals(){
  return (S.crmDeals||[]).filter(d=>!["Выиграно","Проиграно"].includes(d.stage))
}

function work121IsWorkday(d=new Date()){
  const wd=d.getDay();
  return wd!==0&&wd!==6
}

function work121PaceForecast(d=new Date()){
  const pace=workPaceData(d),coverage=crmCoverageData(pace.month);
  const elapsed=Math.max(0,pace.total-pace.left+(work121IsWorkday(d)?1:0));
  const daily=elapsed>0?pace.sales/elapsed:0;
  const paceForecast=daily*pace.total;
  const paceGap=pace.plan>0?Math.max(0,pace.plan-paceForecast):0;
  let status="План не задан";
  if(pace.plan>0){
    if(pace.sales>=pace.plan)status="План уже закрыт фактом";
    else if(coverage.probabilityForecast>=pace.plan)status="CRM-прогноз математически покрывает план";
    else if(paceForecast>=pace.plan)status="Текущий темп математически покрывает план";
    else status="По текущим данным остаётся дефицит"
  }
  return {...pace,elapsed,daily,paceForecast,paceGap,probabilityForecast:coverage.probabilityForecast,weighted:coverage.weighted,status}
}

function work121LargeDealGaps(d){
  if((+d.potential||0)<500000)return [];
  const checks=[
    ["База: объект, город, потенциал",!!(d.name&&d.city&&+d.potential>0)],
    ["Минимум 2 участника / контакта",crmParticipantsCount(d)>=2],
    ["Следующий шаг + дата",!!(d.nextStep&&d.nextDate)],
    ["Дата решения / тендера / закрытия",!!(d.decisionDate||d.tenderDate||d.closeDate)],
    ["Заложенные производители",!!d.manufacturers],
    ["Конкурент",!!d.competitor],
    ["Проект / П / Р / спецификация / ВОР",!!d.projectDocs],
    ["ЛПР или закупщик / согласующий",!!(d.lpr||d.procurement)]
  ];
  return checks.filter(([,ok])=>!ok).map(([label])=>label)
}

function work121DealHealth(d){
  const today=localDateKey(),staleDays=Math.round(workOsNumber("workStaleDays",14,1,365)),reasons=[];
  let score=100;
  const penalize=(points,label)=>{score-=points;reasons.push(label)};
  if(!String(d.nextStep||"").trim()||!d.nextDate)penalize(30,"нет следующего шага или даты");
  if(d.nextDate&&d.nextDate<today)penalize(25,"следующий шаг просрочен");
  if(!d.closeDate)penalize(15,"нет даты закрытия");
  else if(d.closeDate<today)penalize(20,"дата закрытия в прошлом");
  const ts=Date.parse(d.updatedAt||d.createdAt||"");
  if(Number.isFinite(ts)&&Date.now()-ts>staleDays*86400000)penalize(15,`нет обновлений >${staleDays} дней`);
  const missing=work121LargeDealGaps(d);
  if(missing.length)penalize(Math.min(20,missing.length*4),`карточка ≥500k: не заполнено ${missing.length}`);
  score=clamp(Math.round(score),0,100);
  const level=score<60?"risk":score<80?"attention":"ok";
  return {deal:d,score,level,reasons,missing,weighted:(+d.potential||0)*(+d.probability||0)/100}
}

function work121HealthSummary(){
  const rows=work121OpenDeals().map(work121DealHealth);
  const risk=rows.filter(x=>x.level==="risk"),attention=rows.filter(x=>x.level==="attention"),ok=rows.filter(x=>x.level==="ok");
  const average=rows.length?rows.reduce((s,x)=>s+x.score,0)/rows.length:100;
  const riskRaw=risk.reduce((s,x)=>s+(+x.deal.potential||0),0);
  const riskWeighted=risk.reduce((s,x)=>s+x.weighted,0);
  const ordered=rows.slice().sort((a,b)=>a.score-b.score||(+b.deal.potential||0)-(+a.deal.potential||0));
  return {rows,risk,attention,ok,average,riskRaw,riskWeighted,ordered}
}

function work121PipelineConcentration(){
  const deals=work121OpenDeals().slice().sort((a,b)=>(+b.potential||0)-(+a.potential||0)),raw=deals.reduce((s,d)=>s+(+d.potential||0),0);
  const top1=deals[0]?(+deals[0].potential||0):0,top3=deals.slice(0,3).reduce((s,d)=>s+(+d.potential||0),0);
  const top1Share=raw>0?top1/raw*100:0,top3Share=raw>0?top3/raw*100:0;
  return {deals,raw,top1,top3,top1Share,top3Share}
}

function work121StageRows(){
  const order=Object.keys(CRM_STAGE_PROB).filter(x=>!["Выиграно","Проиграно"].includes(x)),map=new Map();
  for(const stage of order)map.set(stage,{stage,count:0,raw:0,weighted:0,monthRaw:0});
  for(const d of work121OpenDeals()){
    const row=map.get(d.stage)||{stage:d.stage||"Без стадии",count:0,raw:0,weighted:0,monthRaw:0};
    row.count++;row.raw+=+d.potential||0;row.weighted+=(+d.potential||0)*(+d.probability||0)/100;
    if(String(d.closeDate||"").startsWith(localMonthKey()))row.monthRaw+=+d.potential||0;
    map.set(row.stage,row)
  }
  return [...map.values()].filter(x=>x.count>0)
}

function work121ActivityPulse(){
  const w=workWeek();
  return [
    ["contacts","Контакты",w.contacts],
    ["followups","Follow-up",w.followups],
    ["lpr","ЛПР",w.lpr],
    ["meetings","Встречи",w.meetings],
    ["proposals","КП / расчёты",w.proposals]
  ].map(([key,label,fact])=>{
    const target=workTarget(key,0),ratio=target>0?fact/target:1;
    return {key,label,fact,target,ratio,missing:Math.max(0,target-fact)}
  })
}

function ensureWork121Ui(){
  if(document.getElementById("work121Pace"))return;
  const grid=document.querySelector?.("#work .grid");if(!grid)return;
  const overviewAnchor=document.getElementById("workOsCommand")?.closest(".card")||grid.querySelector(".work-hero");
  overviewAnchor?.insertAdjacentHTML("afterend",`
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="eyebrow">Work OS 12.1</div><div class="title">Прогноз темпа месяца</div><div id="work121Pace"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="eyebrow">Activity Pulse</div><div class="title">Активность этой недели</div><div id="work121Activity"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-12"><div class="eyebrow">Pipeline Structure</div><div class="title">Концентрация открытой воронки</div><div id="work121Concentration"></div></div>
  `);
  const crmAnchor=document.getElementById("crmEditorCard")||grid.querySelector('[data-ux7-view="crm"]');
  crmAnchor?.insertAdjacentHTML("beforebegin",`
    <div data-ux7-view="crm" class="card ux7-card span-12"><div class="eyebrow">Deal Health</div><div class="section-title">Риск-карта открытых сделок</div><div class="muted" style="margin-top:6px">Health-score отражает только дисциплину CRM: сроки, обновления и полноту карточки. Это не вероятность победы.</div><div id="work121Health" style="margin-top:12px"></div></div>
    <div data-ux7-view="crm" class="card ux7-card span-6"><div class="eyebrow">Stage Map</div><div class="title">Структура воронки по стадиям</div><div id="work121Stages"></div></div>
    <div data-ux7-view="crm" class="card ux7-card span-6"><div class="eyebrow">Large Deals</div><div class="title">Карточки ≥500 тыс.: чего не хватает</div><div id="work121LargeDeals"></div></div>
  `)
}

function renderWork121Pace(){
  const x=work121PaceForecast(),plan=x.plan>0;
  workOsSetHtml("work121Pace",`<div class="report-grid">
    <div class="report-item"><div class="smallcaps">Средний факт / рабочий день</div><b>${x.elapsed?rub(x.daily):"—"}</b></div>
    <div class="report-item"><div class="smallcaps">Прогноз по текущему темпу</div><b>${plan?rub(x.paceForecast):"—"}</b></div>
    <div class="report-item"><div class="smallcaps">CRM-прогноз по вероятностям</div><b>${plan?rub(x.probabilityForecast):"—"}</b></div>
    <div class="report-item"><div class="smallcaps">Нужно / оставшийся рабочий день</div><b>${plan&&Number.isFinite(x.requiredDaily)?rub(x.requiredDaily):"—"}</b></div>
  </div><div class="status" style="margin-top:10px"><b>${escapeHtml(x.status)}</b>. Учтено рабочих дней в темпе: ${x.elapsed}/${x.total}.</div>
  <div class="sub" style="margin-top:8px">Прогноз по темпу экстраполирует уже полученный факт на рабочие дни месяца; CRM-прогноз использует вероятности из карточек. Оба показателя — сценарии, не обещание результата.</div>`)
}

function renderWork121Activity(){
  const rows=work121ActivityPulse();
  workOsSetHtml("work121Activity",rows.map(x=>`<div class="goal"><div class="goal-top"><span>${escapeHtml(x.label)}</span><b>${x.fact}/${x.target||"—"}</b></div>${x.target?`<div class="progress green"><i style="width:${clamp(x.ratio*100,0,100)}%"></i></div><div class="qmeta">${x.missing?`Осталось ${x.missing}`:"Цель недели закрыта"}</div>`:`<div class="qmeta">Цель не задана</div>`}</div>`).join(""))
}

function renderWork121Concentration(){
  const x=work121PipelineConcentration();
  if(!x.deals.length){workOsSetHtml("work121Concentration",'<div class="empty">Открытых CRM-сделок пока нет.</div>');return}
  const top=x.deals.slice(0,3);
  workOsSetHtml("work121Concentration",`<div class="report-grid">
    <div class="report-item"><div class="smallcaps">Открытая воронка</div><b>${rub(x.raw)}</b></div>
    <div class="report-item"><div class="smallcaps">Доля крупнейшей сделки</div><b>${pct(x.top1Share,0)}</b></div>
    <div class="report-item"><div class="smallcaps">Доля топ-3</div><b>${pct(x.top3Share,0)}</b></div>
    <div class="report-item"><div class="smallcaps">Открытых сделок</div><b>${x.deals.length}</b></div>
  </div><div class="title" style="margin-top:12px">Крупнейшие сделки</div>${top.map(d=>`<div class="quest"><div class="qbody"><div class="qtitle">${escapeHtml(d.name||"Без названия")}</div><div class="qmeta">${escapeHtml(d.stage||"")} • ${rub(+d.potential||0)} • ${d.probability||0}%</div></div><button class="btn ghost small" onclick="editCrmDeal('${d.id}')">Открыть</button></div>`).join("")}<div class="sub" style="margin-top:8px">Высокая доля топ-сделок означает концентрацию результата на небольшом числе объектов; сама по себе она не означает, что сделки плохие.</div>`)
}

function renderWork121Health(){
  const x=work121HealthSummary();
  if(!x.rows.length){workOsSetHtml("work121Health",'<div class="empty">Открытых CRM-сделок пока нет.</div>');return}
  workOsSetHtml("work121Health",`<div class="report-grid">
    <div class="report-item"><div class="smallcaps">Средний health-score</div><b>${pct(x.average,0)}</b></div>
    <div class="report-item"><div class="smallcaps">Высокий риск дисциплины</div><b class="${x.risk.length?"income-bad":"income-good"}">${x.risk.length}</b></div>
    <div class="report-item"><div class="smallcaps">Требуют внимания</div><b>${x.attention.length}</b></div>
    <div class="report-item"><div class="smallcaps">Потенциал high-risk</div><b>${rub(x.riskRaw)}</b></div>
  </div>${x.ordered.slice(0,6).map(h=>`<div class="quest"><span class="tag ${h.level==="risk"?"bad":h.level==="attention"?"warn":"good"}">${h.score}/100</span><div class="qbody"><div class="qtitle">${escapeHtml(h.deal.name||"Без названия")} • ${rub(+h.deal.potential||0)}</div><div class="qmeta">${h.reasons.length?escapeHtml(h.reasons.join(" • ")):"Нарушений дисциплины по текущим правилам не найдено"}</div></div><button class="btn ghost small" onclick="editCrmDeal('${h.deal.id}')">Открыть</button></div>`).join("")}`)
}

function renderWork121Stages(){
  const rows=work121StageRows();
  workOsSetHtml("work121Stages",rows.length?rows.map(x=>`<div class="goal"><div class="goal-top"><span>${escapeHtml(x.stage)}</span><b>${x.count} • ${rub(x.raw)}</b></div><div class="qmeta">Взвешено: ${rub(x.weighted)}${x.monthRaw?` • закрытие в этом месяце: ${rub(x.monthRaw)}`:""}</div></div>`).join(""):'<div class="empty">Открытых CRM-сделок пока нет.</div>')
}

function renderWork121LargeDeals(){
  const rows=work121OpenDeals().filter(d=>(+d.potential||0)>=500000).map(d=>({d,missing:work121LargeDealGaps(d)})).filter(x=>x.missing.length).sort((a,b)=>b.missing.length-a.missing.length||(+b.d.potential||0)-(+a.d.potential||0));
  workOsSetHtml("work121LargeDeals",rows.length?rows.slice(0,6).map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.d.name||"Без названия")} • ${rub(+x.d.potential||0)}</div><div class="qmeta">${escapeHtml(x.missing.join(" • "))}</div><button class="btn ghost small" style="margin-top:7px" onclick="editCrmDeal('${x.d.id}')">Заполнить карточку</button></div>`).join(""):'<div class="empty">Все открытые сделки ≥500 тыс. проходят обязательную проверку карточки.</div>')
}

function renderWork121Panels(){
  if(!document.getElementById("work121Pace"))return;
  renderWork121Pace();renderWork121Activity();renderWork121Concentration();renderWork121Health();renderWork121Stages();renderWork121LargeDeals()
}

// Life RPG 13.0: lifecycle is owned by the central bootstrap render pipeline.
