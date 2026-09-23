"use strict";

/* Personal OS integration — feeds personal facts back into Life OS without rewriting core domains. */

const personalBaseTimeline=lifeTimelineEvents;
lifeTimelineEvents=function(days=60){
  const out=personalBaseTimeline(days),start=localDateKey(addDays(new Date(),-(Math.max(1,days)-1)));
  for(const x of journalEntries())if(x.dateKey>=start)out.push({id:"journal:"+x.id,dateKey:x.dateKey,occurredAt:x.createdAt,area:"Личное",kind:"journal",title:x.type==="weekly"?"Недельный обзор":"Рефлексия",durationMin:0,value:1,unit:"✓",note:x.text||x.learned||"",source:"journal",raw:x});
  for(const x of peopleInteractions())if(String(x.dateKey||"")>=start)out.push({id:"person:"+x.id,dateKey:x.dateKey,occurredAt:x.occurredAt||x.createdAt,area:"Отношения",kind:"interaction",title:peopleFind(x.personId)?.name||"Контакт",durationMin:0,value:1,unit:"✓",note:x.note||"",source:"people",raw:x});
  for(const x of focusSessions())if(String(x.dateKey||"")>=start)out.push({id:"focus:"+x.id,dateKey:x.dateKey,occurredAt:x.endedAt||x.createdAt,area:"Система",kind:"focus",title:x.title||"Фокус",durationMin:+x.minutes||0,value:+x.minutes||0,unit:"мин",note:"",source:"focus",raw:x});
  for(const x of personalData().choreLogs)if(String(x.dateKey||"")>=start)out.push({id:"chore:"+x.id,dateKey:x.dateKey,occurredAt:x.createdAt,area:"Личное",kind:"chore",title:homeChores().find(c=>c.id===x.choreId)?.title||"Домашнее дело",durationMin:0,value:1,unit:"✓",note:"",source:"home",raw:x});
  return out.sort((a,b)=>String(b.occurredAt||b.dateKey).localeCompare(String(a.occurredAt||a.dateKey)))
};

const personalBaseActiveDay=activeDay;
activeDay=function(dateKey){return personalBaseActiveDay(dateKey)||journalEntries().some(x=>x.dateKey===dateKey)||peopleInteractions().some(x=>x.dateKey===dateKey)||focusSessions().some(x=>x.dateKey===dateKey)||personalData().choreLogs.some(x=>x.dateKey===dateKey)};

const personalBaseLifeRaw=lifeOsRawCandidates;
lifeOsRawCandidates=function(){
  const out=personalBaseLifeRaw();
  const dueD=journalDueDecisions()[0];if(dueD)lifeOsAddCandidate(out,{id:"personal:decision:"+dueD.id,area:"Система",kind:"reflection",title:`Пересмотреть решение: ${dueD.title}`,meta:`Плановый пересмотр ${dueD.revisitDate}`,score:72,minutes:10,source:"Journal OS"});
  const dueP=peopleDue()[0];if(dueP)lifeOsAddCandidate(out,{id:"personal:person:"+dueP.p.id,area:"Отношения",kind:"relationship",title:`Связаться: ${dueP.p.name}`,meta:`Без контакта ${dueP.h.days} дн. • желаемый ритм ${dueP.p.cadenceDays} дн.`,score:48,minutes:10,source:"People OS"});
  const dueC=homeDueChores()[0];if(dueC)lifeOsAddCandidate(out,{id:"personal:chore:"+dueC.c.id,area:"Личное",kind:"home",title:`Дом: ${dueC.c.title}`,meta:`Срок ${dueC.due}`,score:42,minutes:15,source:"Home OS"});
  const active=personalData().activeFocus;if(active?.startedAt)lifeOsAddCandidate(out,{id:"personal:focus-active",area:"Система",kind:"focus",title:`Завершить активный фокус: ${active.title||"блок"}`,meta:"Таймер уже идёт",score:85,minutes:5,source:"Focus OS"});
  return out
};
