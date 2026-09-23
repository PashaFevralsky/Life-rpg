"use strict";

/* Personal Import Adapters — generic local JSON/CSV events with dedupe. */

function personalImportFingerprint(row){return [row.dateKey,row.tracker||row.name,row.value,row.durationMin,row.note].map(x=>String(x??"").trim().toLowerCase()).join("|")}
function personalImportCsv(text){
  const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)return[];
  const sep=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?";":",";
  const split=line=>{const out=[];let cur="",q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===sep&&!q){out.push(cur);cur=""}else cur+=c}out.push(cur);return out.map(x=>x.trim())};
  const head=split(lines[0]).map(x=>x.toLowerCase());return lines.slice(1).map(line=>{const vals=split(line),o={};head.forEach((h,i)=>o[h]=vals[i]??"");return o})
}
function personalImportNormalize(row){
  const dateRaw=row.dateKey||row.date||row.day||"",dateKey=/^\d{4}-\d{2}-\d{2}/.test(String(dateRaw))?String(dateRaw).slice(0,10):localDateKey(),tracker=personalText(row.tracker||row.name||row.metric),value=Number(String(row.value??"").replace(",",".")),durationMin=Math.max(0,Number(row.durationMin||row.minutes||0)||0),unit=personalText(row.unit),note=personalText(row.note||row.comment);
  if(!validDateKey(dateKey)||!tracker)return null;return {dateKey,tracker,value:Number.isFinite(value)?value:null,durationMin,unit,note}
}
function personalImportEnsureTracker(row){
  let t=personalFindTrackerByName(row.tracker);if(t)return t;if(typeof growthData!=="function")return null;
  t={id:uid(),name:row.tracker,area:"Личное",type:row.durationMin>0?"timer":"value",unit:row.unit||"",active:true,createdAt:personalNow()};growthData().trackers.push(t);return t
}
async function personalImportFile(input){
  const file=input?.files?.[0];if(!file)return;let rows=[];try{const text=await file.text();if(file.name.toLowerCase().endsWith(".json")){const obj=JSON.parse(text);rows=Array.isArray(obj)?obj:Array.isArray(obj.events)?obj.events:Array.isArray(obj.rows)?obj.rows:[]}else rows=personalImportCsv(text)}catch(e){toast("Не удалось прочитать файл: "+e.message);input.value="";return}
  const seen=new Set(personalData().importFingerprints),batch=[];let skipped=0;
  for(const raw of rows){const row=personalImportNormalize(raw);if(!row){skipped++;continue}const fp=personalImportFingerprint(row);if(seen.has(fp)){skipped++;continue}const t=personalImportEnsureTracker(row);if(!t){skipped++;continue}growthLogEvent(t.id,{dateKey:row.dateKey,value:row.value,durationMin:row.durationMin,note:row.note});seen.add(fp);batch.push(fp)}
  personalData().importFingerprints=[...seen].slice(-20000);input.value="";audit("Personal import","system",`импорт ${batch.length}, пропуск ${skipped}`);await save(`Импортировано ${batch.length} • пропущено ${skipped}`)
}
function personalExportPortable(){
  const payload={format:"life-rpg-personal-os-v1",exportedAt:personalNow(),journal:personalSafeJsonClone(journalEntries()),decisions:personalSafeJsonClone(journalDecisions()),people:personalSafeJsonClone(peopleAll()),interactions:personalSafeJsonClone(peopleInteractions()),timeboxes:personalSafeJsonClone(focusTimeboxes()),focusSessions:personalSafeJsonClone(focusSessions()),home:{chores:personalSafeJsonClone(homeChores()),inventory:personalSafeJsonClone(homeInventory()),shopping:personalSafeJsonClone(personalData().shopping)},tracking:{trackers:personalSafeJsonClone(typeof growthTrackers==="function"?growthTrackers():[]),events:personalSafeJsonClone(typeof growthExplicitEvents==="function"?growthExplicitEvents():[])}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`life-rpg-personal-${localDateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
function ensurePersonalImportUi(){
  if(document.getElementById("personalImportCommand"))return;const grid=document.querySelector("#more .grid");if(!grid)return;const anchor=document.getElementById("systemDiagnostics")?.closest(".card")||grid.lastElementChild;
  anchor?.insertAdjacentHTML("afterend",`<div data-ux7-view="settings" data-personal-widget="import" class="card ux7-card span-12"><div><div class="eyebrow">Personal Data Adapters</div><div class="section-title">Импорт факта без привязки к одному сервису</div></div><div id="personalImportCommand" style="margin-top:10px"></div><div class="split" style="margin-top:10px"><label class="btn secondary">Импорт CSV / JSON<input type="file" accept=".csv,.json,text/csv,application/json" style="display:none" onchange="personalImportFile(this)"></label><button class="btn ghost" onclick="personalExportPortable()">Экспорт Personal OS</button></div><div class="status" style="margin-top:8px">CSV: date, tracker, value, unit, durationMin, note. Новые названия трекеров создаются автоматически. Дубли отсекаются по fingerprint.</div></div>`);personalRegisterWidget("import","Импорт внешних данных","more")
}
function renderPersonalImportUi(){const box=document.getElementById("personalImportCommand");if(!box)return;const n=personalData().importFingerprints.length,events=typeof growthExplicitEvents==="function"?growthExplicitEvents().length:0;box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Fingerprint</div><b>${n}</b></div><div class="report-item"><div class="smallcaps">Универсальных событий</div><b>${events}</b></div></div>`}
