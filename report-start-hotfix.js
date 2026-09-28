"use strict";

/* Life RPG 13.7.5 — reportStart boundary hotfix.
   Keeps factual history, but excludes pre-campaign data from reports,
   recurring obligations, XP/streaks and campaign analytics. */

(function(){
  const HOTFIX_VERSION="13.7.5";
  const WRAPPED="__lifeReportStartHotfix";

  function stateReady(){return typeof S!=="undefined"&&S&&S.settings}
  function validKey(v){const s=String(v||"");return /^\d{4}-\d{2}-\d{2}$/.test(s)&&(typeof validDateKey!=="function"||validDateKey(s))}
  function startKey(){
    if(!stateReady())return "";
    const raw=String(S.settings.reportStart||S.settings.campaignStart||"");
    return validKey(raw)?raw:""
  }
  function dateKey(v){
    if(typeof v==="string"){
      if(validKey(v))return v;
      if(/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10)
    }
    if(v instanceof Date&&!Number.isNaN(v.getTime()))return localDateKey(v);
    return ""
  }
  function allowed(v){const s=startKey(),k=dateKey(v);return !s||!k||k>=s}
  function beforeStart(v){const s=startKey(),k=dateKey(v);return !!s&&!!k&&k<s}
  function startDate(){const s=startKey();return s?parseLocal(s):null}
  function effectiveDate(d=new Date()){
    const x=d instanceof Date?new Date(d):new Date(d),s=startDate();
    if(!s||Number.isNaN(x.getTime()))return x;
    return x<s?new Date(s):x
  }
  function reportMonthAllowed(mk){const s=startKey();return !s||String(mk||"")>=s.slice(0,7)}
  function filterRows(rows,getKey){return (Array.isArray(rows)?rows:[]).filter(x=>allowed(getKey?getKey(x):x?.dateKey||x?.date||x?.localDate))}

  window.lifeReportStartKey=startKey;
  window.lifeReportingDateAllowed=allowed;
  window.lifeReportingEffectiveDate=effectiveDate;

  function wrap(name,factory){
    const fn=window[name];
    if(typeof fn!=="function"||fn[WRAPPED])return false;
    const next=factory(fn);
    if(typeof next!=="function")return false;
    try{Object.defineProperty(next,WRAPPED,{value:true})}catch{next[WRAPPED]=true}
    try{Object.defineProperty(next,"__original",{value:fn})}catch{}
    window[name]=next;
    return true
  }

  function emptyWork(){return typeof aggregateWork==="function"?aggregateWork([]):{sales:0,contacts:0,followups:0,lpr:0,meetings:0,proposals:0,wins:0,pipeline:0}}

  function installWrappers(){
    wrap("overdueMinimums",orig=>function(){return filterRows(orig(),x=>x?.dateKey||x?.date)});
    wrap("regularEventsBetween",orig=>function(start,end){return filterRows(orig(effectiveDate(start),end),x=>x?.dateKey||x?.date)});
    wrap("incomeEventsBetween",orig=>function(start,end){return filterRows(orig(effectiveDate(start),end),x=>x?.dateKey||x?.date)});
    wrap("debtEventsBetween",orig=>function(start,end){return filterRows(orig(effectiveDate(start),end),x=>x?.dateKey||x?.date)});
    wrap("financialEvents",orig=>function(){return filterRows(orig(),x=>x?.dateKey||x?.date)});
    wrap("debtScheduleIssues",orig=>function(){const s=startKey();return (orig()||[]).filter(d=>!s||!validKey(d?.nextPaymentDate)||d.nextPaymentDate>=s)});
    wrap("projectionLivingPerDay",orig=>function(d){return allowed(d)?orig(d):0});
    wrap("plannedIncomeForMonth",orig=>function(d=new Date()){
      const mk=d instanceof Date?localMonthKey(d):String(d||localMonthKey());
      return reportMonthAllowed(mk)?orig(d):0
    });
    wrap("plannedIncomeToDate",orig=>function(d=new Date()){return beforeStart(d)?0:orig(d)});
    wrap("monthlyLivingBudget",orig=>function(d=new Date()){return beforeStart(d)?0:orig(d)});
    wrap("remainingLivingBudget",orig=>function(d=new Date()){return beforeStart(d)?0:orig(d)});
    wrap("dynamicDailyBudget",orig=>function(d=new Date()){return beforeStart(d)?0:orig(d)});

    wrap("monthPayments",orig=>function(month=localMonthKey()){
      if(!reportMonthAllowed(month))return 0;
      const s=startKey();
      if(!s||String(month)!==s.slice(0,7))return orig(month);
      return moneySum((S.payments||[]).filter(p=>{
        const mk=p.monthKey||String(p.date||"").slice(0,7),k=p.localDate||String(p.date||"").slice(0,10);
        return mk===month&&allowed(k)
      }).map(p=>p.amount))
    });
    wrap("monthExpenses",orig=>function(month=localMonthKey()){
      if(!reportMonthAllowed(month))return 0;
      const s=startKey();if(!s||String(month)!==s.slice(0,7))return orig(month);
      return moneySum((S.expenses||[]).filter(x=>x.dateKey?.startsWith(month)&&allowed(x.dateKey)).map(x=>x.amount))
    });
    wrap("monthLivingExpenses",orig=>function(month=localMonthKey()){
      if(!reportMonthAllowed(month))return 0;
      const s=startKey();if(!s||String(month)!==s.slice(0,7))return orig(month);
      return moneySum((S.expenses||[]).filter(x=>x.dateKey?.startsWith(month)&&!x.regularPaymentId&&allowed(x.dateKey)).map(x=>x.amount))
    });
    wrap("monthRegularExpenses",orig=>function(month=localMonthKey()){
      if(!reportMonthAllowed(month))return 0;
      const s=startKey();if(!s||String(month)!==s.slice(0,7))return orig(month);
      return moneySum((S.expenses||[]).filter(x=>x.dateKey?.startsWith(month)&&!!x.regularPaymentId&&allowed(x.dateKey)).map(x=>x.amount))
    });
    wrap("monthIncome",orig=>function(month=localMonthKey()){
      if(!reportMonthAllowed(month))return 0;
      const s=startKey();if(!s||String(month)!==s.slice(0,7))return orig(month);
      return moneySum((S.incomeLogs||[]).filter(x=>x.dateKey?.startsWith(month)&&allowed(x.dateKey)).map(x=>x.amount))
    });

    // Expense envelopes follow the same reportStart boundary as the rest of the campaign.
    wrap("monthCategorySpend",orig=>function(cat,month=localMonthKey()){
      if(!reportMonthAllowed(month))return 0;
      const s=startKey();if(!s||String(month)!==s.slice(0,7))return orig(cat,month);
      return moneySum((S.expenses||[]).filter(x=>x.dateKey?.startsWith(month)&&x.category===cat&&!x.regularPaymentId&&allowed(x.dateKey)).map(x=>x.amount))
    });
    wrap("envelopeCarry",orig=>function(cat,month=localMonthKey()){
      const s=startKey(),mk=String(month||localMonthKey());
      if(s&&mk<=s.slice(0,7))return 0;
      return orig(cat,month)
    });
    wrap("applyEnvelopeCarryover",orig=>function(month){
      const s=startKey(),mk=String(month||"");
      if(s&&mk&&mk<s.slice(0,7)){
        const target=typeof nextMonthKey==="function"?nextMonthKey(mk):"";
        if(target===s.slice(0,7)&&S.envelopeCarryovers?.[target])delete S.envelopeCarryovers[target];
        return
      }
      return orig(month)
    });

    wrap("ux7NextMoneyEvent",orig=>function(){
      try{
        const start=effectiveDate(new Date()),end=addDays(start,90),events=[...debtEventsBetween(start,end),...regularEventsBetween(start,end)]
          .filter(x=>(+x.amount||0)>0&&allowed(x.dateKey||x.date)).sort((a,b)=>a.date-b.date);
        return events[0]||null
      }catch{return orig()}
    });

    wrap("renderUx7TodayPulse",orig=>function(){
      const s=startKey();
      if(!s||localDateKey()>=s)return orig();
      const box=$("ux7TodayPulse");if(!box||!stateReady())return;
      let next=null;try{next=ux7NextMoneyEvent()}catch{}
      const free=typeof freeCashBalance==="function"?freeCashBalance():0;
      box.innerHTML=`<div class="ux7-today-line"><div><div class="smallcaps">Финансовый статус</div><b class="ux7-status-good">Старт ${fmtDate(parseLocal(s))}</b></div><div><div class="smallcaps">Свободно</div><b>${rub(free)}</b></div><div><div class="smallcaps">Следующий платёж</div><b>${next?rub(next.amount):"—"}</b><small>${next?`${fmtDate(next.date)} • ${escapeHtml(next.label)}`:"нет данных"}</small></div><button class="btn secondary small" onclick="ux7Go('finance','overview')">Открыть деньги</button></div>`
    });

    wrap("currentMonthReport",orig=>function(){
      if(beforeStart(localDateKey()))return {income:0,expenses:0,payments:0,cash:0,work:emptyWork(),tennis:0,tournaments:0,readMinutes:0,books:0};
      return orig()
    });
    wrap("monthMetrics",orig=>function(mk){
      if(!reportMonthAllowed(mk))return {income:0,expenses:0,payments:0,sales:0,tennis:0,read:0};
      return orig(mk)
    });
    wrap("gamificationTennisFacts",orig=>function(){return filterRows(orig(),x=>x?.dateKey)});
    wrap("gamificationReadingFacts",orig=>function(){return filterRows(orig(),x=>x?.dateKey)});
    wrap("workMonth",orig=>function(){
      const mk=localMonthKey();if(!reportMonthAllowed(mk))return emptyWork();
      const s=startKey();if(!s||mk!==s.slice(0,7))return orig();
      return aggregateWork((S.workLogs||[]).filter(x=>String(x.date||"").startsWith(mk)&&allowed(x.date)))
    });
    wrap("workWeek",orig=>function(){
      const [a,b]=weekBounds(),rows=(S.workLogs||[]).filter(x=>inRange(x.date,a,b)&&allowed(x.date));
      return typeof aggregateWork==="function"?aggregateWork(rows):orig()
    });
    wrap("tennisWeek",orig=>function(){
      if(typeof weekBounds!=="function"||typeof tennisRecordedSessions!=="function")return orig();
      const [a,b]=weekBounds(),arr=tennisRecordedSessions().filter(x=>inRange(x.dateKey,a,b)&&allowed(x.dateKey));
      return {sessions:arr.length,tournaments:arr.filter(x=>x.type==="Турнир").length,serve:arr.reduce((n,x)=>n+(+x.serveMin||0),0),foot:arr.reduce((n,x)=>n+(+x.footMin||0),0)}
    });
    wrap("readingDaysThisWeek",orig=>function(){
      if(typeof knowledgeFactualReadingLogs!=="function")return orig();
      const wk=isoWeekKey();return new Set(knowledgeFactualReadingLogs().filter(x=>allowed(x.dateKey)&&isoWeekKey(parseLocal(x.dateKey))===wk).map(x=>x.dateKey)).size
    });
    wrap("readingWindowLogs",orig=>function(days=28,bookId=""){return filterRows(orig(days,bookId),x=>x?.dateKey)});
    wrap("knowledgeGrowthReadingLogs",orig=>function(){return filterRows(orig(),x=>x?.dateKey)});
    wrap("knowledgeGrowthFactualNotes",orig=>function(){return filterRows(orig(),x=>x?.dateKey)});
    wrap("tennisGrowthExposure",orig=>function(days=30){
      if(typeof tennisGrowthSessionExposure!=="function")return orig(days);
      const start=localDateKey(addDays(new Date(),-(days-1))),sum={FH:0,BH:0,"Подача":0,"Приём":0,"Ноги":0,"Тактика":0},sessions=(S.tennis||[]).filter(x=>String(x.dateKey||"")>=start&&allowed(x.dateKey));
      let exact=0;for(const row of sessions){const e=tennisGrowthSessionExposure(row);if(e.exact)exact++;for(const k of Object.keys(sum))sum[k]+=+e[k]||0}
      return {sum,sessions:sessions.length,exact,total:Object.values(sum).reduce((a,b)=>a+b,0)}
    });
    wrap("rpgGrowthEvidence",orig=>function(){
      if(!beforeStart(localDateKey()))return orig();
      return {knowledgeSessions:0,captureRate:0,knowledgeNotes:0,applications:0,tennisSessions:0,tennisExact:0,matches:0,habits:0,strongHabits:0,avgHabit:0,events:0,time:0}
    });
    wrap("lifeTimelineEvents",orig=>function(days=60){return filterRows(orig(days),x=>x?.dateKey)});
    wrap("activeDay",orig=>function(k){return allowed(k)?orig(k):false});
    wrap("dailyQuestState",orig=>function(qid,date=localDateKey()){return allowed(date)?orig(qid,date):false});

    wrap("syncAutoDailyQuests",orig=>function(date){
      if(date&&beforeStart(date))return;
      if(!date){
        const s=startKey();
        if(!s)return orig();
        const dates=new Set([localDateKey(),...Object.keys(S.checks||{}),...(S.readingLogs||[]).map(x=>x.dateKey),...(S.expenses||[]).map(x=>x.dateKey)]);
        for(const day of dates)if(validKey(day)&&day>=s&&day<=localDateKey())orig(day);
        return
      }
      return orig(date)
    });
    wrap("addXp",orig=>function(xp,stat,label="",sourceId="",kind="",dateKey=""){
      const k=validKey(dateKey)?dateKey:localDateKey();if(beforeStart(k))return;return orig(xp,stat,label,sourceId,kind,dateKey)
    });
    wrap("removeXp",orig=>function(xp,stat,label="Откат",sourceId="",dateKey=""){
      const k=validKey(dateKey)?dateKey:localDateKey();if(beforeStart(k))return;return orig(xp,stat,label,sourceId,dateKey)
    });
    wrap("claimQuest",orig=>async function(group,id){if(beforeStart(localDateKey())){toast(`Кампания начнётся ${fmtDate(parseLocal(startKey()))}`);return}return orig(group,id)});
    wrap("toggleDaily",orig=>async function(qid){if(beforeStart(localDateKey())){toast(`Кампания начнётся ${fmtDate(parseLocal(startKey()))}`);return}return orig(qid)});
    wrap("checkAchievements",orig=>function(){if(beforeStart(localDateKey()))return false;return orig()});
    wrap("achievementConditions",orig=>function(){if(beforeStart(localDateKey())){const x=orig();return Object.fromEntries(Object.keys(x).map(k=>[k,false]))}return orig()});

    wrap("lifeScore",orig=>function(){
      if(!beforeStart(localDateKey()))return orig();
      const msg=`кампания начинается ${fmtDate(parseLocal(startKey()))}`;
      return {finance:0,career:0,tennis:0,reading:0,discipline:0,total:0,details:[{name:"Финансы",reason:msg},{name:"Работа",reason:msg},{name:"Теннис",reason:msg},{name:"Знания",reason:msg},{name:"Система",reason:msg}]}
    });
  }

  function cleanupReportStartEnvelopes(){
    if(!stateReady())return false;
    const s=startKey();if(!s)return false;
    const marker="13.7.5-envelope-1";
    if(S.settings.reportStartEnvelopeFixVersion===marker)return false;
    let changed=false;
    const startMonth=s.slice(0,7);
    if(S.envelopeCarryovers?.[startMonth]){delete S.envelopeCarryovers[startMonth];changed=true}

    // Restore the agreed 49,000 ₽ monthly envelope scheme only when the
    // surrounding limits still match that scheme and "Связь" is missing.
    const limits=S.envelopeLimits||{};
    const signature=[["Еда",17000],["Транспорт",10000],["Развлечения",1000],["Теннис",9000],["Покупки",2000],["Другое",8000]];
    if(signature.every(([k,v])=>Math.abs((+limits[k]||0)-v)<.01)&&(+limits["Связь"]||0)===0){
      limits["Связь"]=2000;changed=true
    }
    S.settings.reportStartEnvelopeFixVersion=marker;
    return true
  }

  function rebuildCampaignGamification(){
    if(!stateReady())return false;
    const s=startKey();if(!s)return false;
    if(S.settings.reportStartCleanupVersion===HOTFIX_VERSION)return false;

    const eventKey=x=>dateKey(x?.date);
    S.xpEvents=(S.xpEvents||[]).filter(x=>allowed(eventKey(x)));
    const stats={Финансы:0,Карьера:0,Разум:0,Теннис:0,Тело:0,Отношения:0,Дисциплина:0};
    let earned=0;
    for(const x of S.xpEvents){
      const value=Number(x?.xp)||0;earned+=value;
      if(x?.stat&&stats[x.stat]!=null)stats[x.stat]+=value
    }
    S.xpEarned=Math.max(0,Math.round(earned));
    for(const k of Object.keys(stats))stats[k]=Math.max(0,Math.round(stats[k]));
    S.stats={...S.stats,...stats};

    S.rewardPurchases=(S.rewardPurchases||[]).filter(x=>allowed(x?.date));
    S.xpSpent=Math.max(0,Math.round(S.rewardPurchases.reduce((sum,x)=>sum+(+x.cost||0),0)));
    for(const [id,ts] of Object.entries(S.achievements||{}))if(!allowed(ts))delete S.achievements[id];

    if(localDateKey()<s){
      S.questDone={};
      S.xpEvents=[];S.xpEarned=0;S.xpSpent=0;
      for(const k of Object.keys(stats))S.stats[k]=0;
      S.achievements={};S.rewardPurchases=[]
    }
    S.settings.reportStartCleanupVersion=HOTFIX_VERSION;
    return true
  }

  let REPORT_START_FINALIZED=false;

  async function lifeReportStartFinalize(){
    try{
      installWrappers();
      if(REPORT_START_FINALIZED)return false;
      if(typeof storage137BootSettling!=="undefined"&&storage137BootSettling)return false;
      if(!stateReady())return false;

      REPORT_START_FINALIZED=true;
      const envelopeChanged=cleanupReportStartEnvelopes();
      const gamificationChanged=rebuildCampaignGamification();
      const changed=envelopeChanged||gamificationChanged;

      if(changed&&typeof persist==="function"){
        try{await persist()}catch(e){console.warn("reportStart cleanup persist failed",e)}
      }
      if(changed&&typeof render==="function"){
        try{render()}catch{}
      }
      return changed
    }catch(e){
      console.error("reportStart hotfix failed",e);
      return false
    }
  }

  window.lifeReportStartFinalize=lifeReportStartFinalize;
  installWrappers();

})();
