"use strict";

/* Tennis Huawei Import — structured wearable metrics + screenshot OCR.
   Additive module: no state migration and no runtime monkey-patching. */

const TENNIS_HUAWEI_CDN="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

function tennisHuaweiStore(){
  const g=growthData();
  if(!Array.isArray(g.tennisWearables))g.tennisWearables=[];
  return g.tennisWearables
}
function tennisHuaweiAll(){
  const ids=new Set((S.tennis||[]).map(x=>String(x.id)));
  return tennisHuaweiStore().filter(x=>x&&ids.has(String(x.sessionId)))
}
function tennisHuaweiDetail(sessionId){return tennisHuaweiAll().find(x=>String(x.sessionId)===String(sessionId))||null}
function tennisHuaweiSession(sessionId){return (S.tennis||[]).find(x=>String(x.id)===String(sessionId))||null}
function tennisHuaweiNum(v,min=0,max=Number.POSITIVE_INFINITY){
  if(v==null||String(v).trim()==="")return null;
  const n=Number(String(v).trim().replace(/\s/g,"").replace(",","."));
  return Number.isFinite(n)?clamp(n,min,max):null
}
function tennisHuaweiInt(v,min=0,max=Number.POSITIVE_INFINITY){
  const n=tennisHuaweiNum(v,min,max);return n==null?null:Math.round(n)
}
function tennisHuaweiDurationToSec(v){
  const s=String(v||"").trim();
  let m=s.match(/^(\d{1,2})[:.](\d{2})[:.](\d{2})$/);
  if(m)return (+m[1])*3600+(+m[2])*60+(+m[3]);
  m=s.match(/^(\d{1,3})[:.](\d{2})$/);
  if(m)return (+m[1])*60+(+m[2]);
  const n=tennisHuaweiNum(s,0,10000);
  return n==null?0:Math.round(n*60)
}
function tennisHuaweiSecText(sec){
  sec=Math.max(0,Math.round(+sec||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
}
function tennisHuaweiDateKey(v){
  const s=String(v||"").trim();
  let m=s.match(/(\d{4})-(\d{2})-(\d{2})/);if(m){const k=`${m[1]}-${m[2]}-${m[3]}`;return validDateKey(k)?k:""}
  m=s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/);if(!m)return"";
  const k=`${m[3]}-${String(+m[2]).padStart(2,"0")}-${String(+m[1]).padStart(2,"0")}`;
  return validDateKey(k)?k:""
}
function tennisHuaweiNormalizeLine(s){return String(s||"").replace(/[|]/g," ").replace(/\s+/g," ").trim()}
function tennisHuaweiLines(text){return String(text||"").split(/\r?\n/).map(tennisHuaweiNormalizeLine).filter(Boolean)}
function tennisHuaweiFirstNumberNear(lines,re,{min=0,max=9999,decimal=false}={}){
  for(let i=0;i<lines.length;i++){
    if(!re.test(lines[i]))continue;
    const sample=[lines[i],lines[i+1]||"",lines[i+2]||""].join(" ");
    const nums=[...sample.matchAll(/<?\s*(\d+(?:[.,]\d+)?)/g)].map(m=>Number(m[1].replace(",","."))).filter(n=>Number.isFinite(n)&&n>=min&&n<=max);
    if(nums.length)return decimal?nums[0]:Math.round(nums[0])
  }
  return null
}
function tennisHuaweiZone(lines,re){
  for(let i=0;i<lines.length;i++){
    if(!re.test(lines[i]))continue;
    const current=lines[i];
    if(/<\s*1\s*(?:мин|mин|min)/i.test(current))return 0.5;
    let m=current.match(/<?\s*(\d+)\s*(?:мин|mин|min)/i);
    if(m)return Math.max(0,+m[1]||0);
    const next=lines[i+1]||"";
    if(/<\s*1\s*(?:мин|mин|min)/i.test(next))return 0.5;
    m=next.match(/<?\s*(\d+)\s*(?:мин|mин|min)/i);
    if(m)return Math.max(0,+m[1]||0)
  }
  return null
}
function tennisHuaweiParseText(text){
  const lines=tennisHuaweiLines(text),flat=lines.join(" "),low=flat.toLowerCase();
  const out={source:"Huawei Health",device:"",dateKey:"",durationSec:0,totalCalories:null,activeCalories:null,avgHr:null,maxHr:null,extremeMin:null,anaerobicMin:null,aerobicMin:null,fatBurnMin:null,warmupMin:null,aerobicEffect:null,anaerobicEffect:null,recoveryHours:null,recoveryStartHr:null,recoveryEndHr:null};

  const device=lines.find(x=>/huawei\s+watch/i.test(x));if(device)out.device=device.replace(/^.*?(HUAWEI\s+WATCH)/i,"HUAWEI WATCH").trim().slice(0,80);
  const dm=flat.match(/(\d{1,2}[.\/-]\d{1,2}[.\/-]20\d{2})/);if(dm)out.dateKey=tennisHuaweiDateKey(dm[1]);

  for(let i=0;i<lines.length;i++){
    if(!/длитель/i.test(lines[i]))continue;
    const sample=[lines[i],lines[i+1]||""].join(" ");
    const m=sample.match(/(\d{1,2})[:.](\d{2})[:.](\d{2})/);
    if(m){out.durationSec=(+m[1])*3600+(+m[2])*60+(+m[3]);break}
  }
  if(!out.durationSec){
    const m=flat.match(/\b(\d{1,2})[:.](\d{2})[:.](\d{2})\b/);
    if(m)out.durationSec=(+m[1])*3600+(+m[2])*60+(+m[3])
  }

  const kcals=[...flat.matchAll(/(\d[\d\s]{2,5})\s*ккал/gi)].map(m=>Number(m[1].replace(/\s/g,""))).filter(n=>n>=20&&n<=10000);
  if(kcals.length){out.totalCalories=Math.max(...kcals);if(kcals.length>1)out.activeCalories=[...kcals].sort((a,b)=>b-a)[1]}

  out.avgHr=tennisHuaweiFirstNumberNear(lines,/средн(?:ий|ее).*(?:пульс)?/i,{min:50,max:240});
  out.maxHr=tennisHuaweiFirstNumberNear(lines,/максимум|макс(?:имальный)?/i,{min:50,max:260});
  if(out.avgHr==null){
    const m=flat.match(/средн(?:ий|ее)[^\d]{0,30}(\d{2,3})\s*(?:уд|уд\/мин)/i);if(m)out.avgHr=+m[1]
  }
  if(out.maxHr==null){
    const m=flat.match(/макс(?:имум|имальный)?[^\d]{0,30}(\d{2,3})/i);if(m)out.maxHr=+m[1]
  }

  out.extremeMin=tennisHuaweiZone(lines,/экстрим/i);
  out.anaerobicMin=tennisHuaweiZone(lines,/анаэроб/i);
  out.aerobicMin=tennisHuaweiZone(lines,/(?:^|\s)аэробн/i);
  out.fatBurnMin=tennisHuaweiZone(lines,/сжиган(?:ие|ия)\s+жира/i);
  out.warmupMin=tennisHuaweiZone(lines,/разминк/i);

  out.aerobicEffect=tennisHuaweiFirstNumberNear(lines,/стресс\s+от\s+аэробн/i,{min:0,max:5.5,decimal:true});
  out.anaerobicEffect=tennisHuaweiFirstNumberNear(lines,/стресс\s+от\s+анаэробн/i,{min:0,max:5.5,decimal:true});
  out.recoveryHours=tennisHuaweiFirstNumberNear(lines,/время\s+на\s+восстановлен/i,{min:0,max:240});

  const rec=flat.match(/(?:начало\s*\/?\s*конец|начало.?конец)[^\d]{0,20}(\d{2,3})\s*\/\s*(\d{2,3})/i);
  if(rec){out.recoveryStartHr=+rec[1];out.recoveryEndHr=+rec[2]}

  const activeLine=lines.findIndex(x=>/расход\s+калорий\s+при\s+нагруз/i.test(x));
  if(activeLine>=0){
    const sample=[lines[activeLine],lines[activeLine+1]||""].join(" "),m=sample.match(/(\d[\d\s]{2,5})\s*ккал/i);
    if(m)out.activeCalories=Number(m[1].replace(/\s/g,""))
  }
  return out
}
function tennisHuaweiParsedCount(x){
  return ["dateKey","durationSec","totalCalories","activeCalories","avgHr","maxHr","extremeMin","anaerobicMin","aerobicMin","aerobicEffect","anaerobicEffect","recoveryHours","recoveryStartHr","recoveryEndHr"].filter(k=>x?.[k]!=null&&x[k]!=="").length
}
function tennisHuaweiSet(id,v){const el=document.getElementById(id);if(el)el.value=v==null?"":String(v)}
function tennisHuaweiGet(id){return document.getElementById(id)?.value??""}
function tennisHuaweiFormData(){
  const durationSec=tennisHuaweiDurationToSec(tennisHuaweiGet("tennisHuaweiDuration"));
  return {
    source:"Huawei Health",
    device:String(tennisHuaweiGet("tennisHuaweiDevice")||"Huawei Watch Fit 4 Pro").trim(),
    dateKey:tennisHuaweiDateKey(tennisHuaweiGet("tennisHuaweiDate")),
    durationSec,
    totalCalories:tennisHuaweiInt(tennisHuaweiGet("tennisHuaweiCalories"),0,10000),
    activeCalories:tennisHuaweiInt(tennisHuaweiGet("tennisHuaweiActiveCalories"),0,10000),
    avgHr:tennisHuaweiInt(tennisHuaweiGet("tennisHuaweiAvgHr"),30,260),
    maxHr:tennisHuaweiInt(tennisHuaweiGet("tennisHuaweiMaxHr"),30,280),
    extremeMin:tennisHuaweiNum(tennisHuaweiGet("tennisHuaweiExtreme"),0,1000),
    anaerobicMin:tennisHuaweiNum(tennisHuaweiGet("tennisHuaweiAnaerobic"),0,1000),
    aerobicMin:tennisHuaweiNum(tennisHuaweiGet("tennisHuaweiAerobic"),0,1000),
    fatBurnMin:tennisHuaweiNum(tennisHuaweiGet("tennisHuaweiFat"),0,1000),
    warmupMin:tennisHuaweiNum(tennisHuaweiGet("tennisHuaweiWarmup"),0,1000),
    aerobicEffect:tennisHuaweiNum(tennisHuaweiGet("tennisHuaweiAerobicEffect"),0,5.5),
    anaerobicEffect:tennisHuaweiNum(tennisHuaweiGet("tennisHuaweiAnaerobicEffect"),0,5.5),
    recoveryHours:tennisHuaweiNum(tennisHuaweiGet("tennisHuaweiRecoveryHours"),0,240),
    recoveryStartHr:tennisHuaweiInt(tennisHuaweiGet("tennisHuaweiRecoveryStart"),30,260),
    recoveryEndHr:tennisHuaweiInt(tennisHuaweiGet("tennisHuaweiRecoveryEnd"),30,260)
  }
}
function tennisHuaweiFillForm(x={}){
  tennisHuaweiSet("tennisHuaweiDevice",x.device||"Huawei Watch Fit 4 Pro");
  tennisHuaweiSet("tennisHuaweiDate",x.dateKey||"");
  tennisHuaweiSet("tennisHuaweiDuration",x.durationSec?tennisHuaweiSecText(x.durationSec):"");
  tennisHuaweiSet("tennisHuaweiCalories",x.totalCalories);
  tennisHuaweiSet("tennisHuaweiActiveCalories",x.activeCalories);
  tennisHuaweiSet("tennisHuaweiAvgHr",x.avgHr);
  tennisHuaweiSet("tennisHuaweiMaxHr",x.maxHr);
  tennisHuaweiSet("tennisHuaweiExtreme",x.extremeMin);
  tennisHuaweiSet("tennisHuaweiAnaerobic",x.anaerobicMin);
  tennisHuaweiSet("tennisHuaweiAerobic",x.aerobicMin);
  tennisHuaweiSet("tennisHuaweiFat",x.fatBurnMin);
  tennisHuaweiSet("tennisHuaweiWarmup",x.warmupMin);
  tennisHuaweiSet("tennisHuaweiAerobicEffect",x.aerobicEffect);
  tennisHuaweiSet("tennisHuaweiAnaerobicEffect",x.anaerobicEffect);
  tennisHuaweiSet("tennisHuaweiRecoveryHours",x.recoveryHours);
  tennisHuaweiSet("tennisHuaweiRecoveryStart",x.recoveryStartHr);
  tennisHuaweiSet("tennisHuaweiRecoveryEnd",x.recoveryEndHr)
}
function tennisHuaweiClearForm(){
  tennisHuaweiFillForm({device:"Huawei Watch Fit 4 Pro"});
  tennisHuaweiSet("tennisHuaweiRpe","");
  const status=document.getElementById("tennisHuaweiOcrStatus");if(status)status.textContent="Выбери скриншот Huawei Health или заполни поля вручную."
}
async function tennisHuaweiLoadTesseract(){
  if(window.Tesseract?.recognize)return window.Tesseract;
  await new Promise((resolve,reject)=>{
    const old=document.querySelector(`script[src="${TENNIS_HUAWEI_CDN}"]`);
    if(old){old.addEventListener("load",resolve,{once:true});old.addEventListener("error",reject,{once:true});return}
    const s=document.createElement("script");s.src=TENNIS_HUAWEI_CDN;s.onload=resolve;s.onerror=()=>reject(new Error("Не удалось загрузить OCR"));document.head.appendChild(s)
  });
  if(!window.Tesseract?.recognize)throw new Error("OCR не инициализирован");
  return window.Tesseract
}
async function tennisHuaweiReadScreenshot(input){
  const file=input?.files?.[0];if(!file)return;
  const status=document.getElementById("tennisHuaweiOcrStatus"),preview=document.getElementById("tennisHuaweiOcrPreview");
  try{
    if(status)status.textContent="OCR: подготовка…";
    const T=await tennisHuaweiLoadTesseract();
    const result=await T.recognize(file,"rus+eng",{logger:m=>{
      if(!status)return;
      if(m.status==="recognizing text"&&Number.isFinite(m.progress))status.textContent=`OCR: ${Math.round(m.progress*100)}%`;
      else if(m.status)status.textContent=`OCR: ${m.status}`
    }});
    const text=String(result?.data?.text||""),parsed=tennisHuaweiParseText(text);
    tennisHuaweiFillForm(parsed);
    const n=tennisHuaweiParsedCount(parsed),confidence=Math.round(Number(result?.data?.confidence)||0);
    if(status)status.textContent=`Распознано полей: ${n} • уверенность OCR ${confidence}%. Проверь цифры перед сохранением.`;
    if(preview)preview.textContent=text.slice(0,2400)
  }catch(e){
    if(status)status.textContent=`OCR не сработал: ${e.message}. Поля можно заполнить вручную.`
  }finally{input.value=""}
}
function tennisHuaweiSessionOptions(selected=""){
  return (typeof tennisSessionsDesc==="function"?tennisSessionsDesc():(S.tennis||[])).slice(0,40).map(x=>`<option value="${escapeHtml(x.id)}" ${String(x.id)===String(selected)?"selected":""}>${escapeHtml(x.dateKey||"")} • ${escapeHtml(x.type||"Тренировка")} • ${Math.round(+x.min||0)} мин</option>`).join("")
}
function tennisHuaweiLoadSelected(){
  const id=String(tennisHuaweiGet("tennisHuaweiSession")||""),d=tennisHuaweiDetail(id);
  if(d){tennisHuaweiFillForm(d);tennisHuaweiSet("tennisHuaweiRpe",tennisHuaweiSession(id)?.load||"");const st=document.getElementById("tennisHuaweiOcrStatus");if(st)st.textContent="Загружены сохранённые данные часов для выбранной сессии."}
}
function tennisHuaweiValidate(data){
  if(!data.dateKey)return"Укажи дату";
  if(data.durationSec<=0)return"Укажи длительность";
  if(data.avgHr!=null&&data.maxHr!=null&&data.avgHr>data.maxHr)return"Средний пульс не может быть выше максимального";
  if(data.activeCalories!=null&&data.totalCalories!=null&&data.activeCalories>data.totalCalories)return"Активные ккал не могут быть выше общих";
  return""
}
async function tennisHuaweiSaveForSession(sessionId,data){
  const s=tennisHuaweiSession(sessionId);if(!s){toast("Сессия не найдена");return null}
  const err=tennisHuaweiValidate(data);if(err){toast(err);return null}
  const store=tennisHuaweiStore(),old=store.find(x=>String(x.sessionId)===String(sessionId));
  const row={id:old?.id||uid(),sessionId:String(sessionId),...data,updatedAt:new Date().toISOString(),createdAt:old?.createdAt||new Date().toISOString()};
  if(old)Object.assign(old,row);else store.unshift(row);
  audit("Huawei Health → теннис","sport",`${s.dateKey} • ${data.avgHr??"—"}/${data.maxHr??"—"} уд/мин`);
  await save("Данные часов сохранены");
  tennisHuaweiRefresh();
  return row
}
async function tennisHuaweiAttach(){
  const id=String(tennisHuaweiGet("tennisHuaweiSession")||"");if(!id){toast("Выбери сохранённую тренировку");return}
  await tennisHuaweiSaveForSession(id,tennisHuaweiFormData())
}
async function tennisHuaweiCreateSession(){
  const data=tennisHuaweiFormData(),err=tennisHuaweiValidate(data);if(err){toast(err);return}
  const rpe=tennisHuaweiInt(tennisHuaweiGet("tennisHuaweiRpe"),1,10);if(rpe==null){toast("Укажи субъективную нагрузку RPE 1–10");return}
  const minutes=Math.max(1,Math.round(data.durationSec/60));
  const similar=(S.tennis||[]).find(x=>x.dateKey===data.dateKey&&Math.abs((+x.min||0)-minutes)<=2);
  if(similar){
    tennisHuaweiSet("tennisHuaweiSession",similar.id);
    toast("Похожая сессия уже есть — выбрал её для привязки, чтобы не создать дубль");
    return
  }
  const ids=new Set((S.tennis||[]).map(x=>String(x.id)));
  tennisHuaweiSet("ttDate",data.dateKey);tennisHuaweiSet("ttMinutes",minutes);tennisHuaweiSet("ttLoad",rpe);tennisHuaweiSet("ttServe",0);tennisHuaweiSet("ttFoot",0);tennisHuaweiSet("ttW",0);tennisHuaweiSet("ttL",0);tennisHuaweiSet("ttOpponent","");tennisHuaweiSet("ttOpponentRating","");tennisHuaweiSet("ttScore","");tennisHuaweiSet("ttMatches","");tennisHuaweiSet("ttType","Тренировка");tennisHuaweiSet("ttFocus","Смешанная");tennisHuaweiSet("ttNote","Импорт Huawei Health");
  await addTennis();
  const s=(S.tennis||[]).find(x=>!ids.has(String(x.id)))||(S.tennis||[])[0];
  if(!s){toast("Не удалось создать тренировку");return}
  await tennisHuaweiSaveForSession(s.id,data);
  tennisHuaweiSet("tennisHuaweiSession",s.id);
  toast("Тренировка и данные Huawei сохранены")
}
function tennisHuaweiHistoryHtml(){
  const rows=tennisHuaweiAll().slice().sort((a,b)=>String(b.dateKey||"").localeCompare(String(a.dateKey||""))).slice(0,12);
  if(!rows.length)return'<div class="empty">Пока нет данных часов.</div>';
  return rows.map(x=>{
    const s=tennisHuaweiSession(x.sessionId),zones=[x.extremeMin!=null?`экстрим ${x.extremeMin}м`:"",x.anaerobicMin!=null?`анаэроб ${x.anaerobicMin}м`:"",x.aerobicMin!=null?`аэроб ${x.aerobicMin}м`:""].filter(Boolean).join(" • ");
    return `<div class="log-item"><div class="qtitle">${escapeHtml(x.dateKey||s?.dateKey||"")} • ${escapeHtml(x.device||"Huawei")}</div><div class="score">Пульс ${x.avgHr??"—"} / ${x.maxHr??"—"} • ${x.totalCalories??"—"} ккал • ${x.durationSec?tennisHuaweiSecText(x.durationSec):"—"}</div><div class="qmeta">${zones}${x.aerobicEffect!=null?` • аэроб. эффект ${x.aerobicEffect}`:""}${x.anaerobicEffect!=null?` • анаэроб. эффект ${x.anaerobicEffect}`:""}${x.recoveryHours!=null?` • восстановление ${x.recoveryHours} ч`:""}</div></div>`
  }).join("")
}
function tennisHuaweiSummary(){
  const rows=tennisHuaweiAll(),hr=rows.filter(x=>x.avgHr!=null),cal=rows.filter(x=>x.totalCalories!=null&&x.durationSec>0),mx=rows.map(x=>+x.maxHr||0).filter(Boolean);
  return {
    n:rows.length,
    avgHr:hr.length?Math.round(hr.reduce((a,x)=>a+(+x.avgHr||0),0)/hr.length):null,
    maxHr:mx.length?Math.max(...mx):null,
    kcalHour:cal.length?Math.round(cal.reduce((a,x)=>a+(+x.totalCalories||0)/(x.durationSec/3600),0)/cal.length):null
  }
}
function tennisHuaweiEnsureUi(){
  if(document.getElementById("tennisHuaweiCard"))return;
  const grid=document.querySelector("#tennis .grid"),form=document.getElementById("ttDate")?.closest(".card");if(!grid||!form)return;
  form.insertAdjacentHTML("afterend",`<div id="tennisHuaweiCard" data-ux7-view="training analytics" class="card ux7-card span-12">
    <div class="eyebrow">Huawei Health</div><div class="section-title">Данные часов по тренировке</div>
    <div class="muted" style="margin-top:6px">Скриншот используется только для распознавания. В Life RPG сохраняются числовые показатели, само изображение не сохраняется. Пульсовые данные — журнал тренировки, не медицинская оценка.</div>
    <div class="split" style="margin-top:12px"><label class="btn secondary">Импорт скриншота<input id="tennisHuaweiFile" type="file" accept="image/*" style="display:none" onchange="tennisHuaweiReadScreenshot(this)"></label><button class="btn ghost" onclick="tennisHuaweiClearForm()">Очистить</button></div>
    <div id="tennisHuaweiOcrStatus" class="status" style="margin-top:8px">Выбери скриншот Huawei Health или заполни поля вручную.</div>
    <details style="margin-top:8px"><summary>Текст OCR</summary><pre id="tennisHuaweiOcrPreview" class="status" style="white-space:pre-wrap;max-height:180px;overflow:auto"></pre></details>
    <div class="formgrid" style="margin-top:12px">
      <div class="field"><label>Дата</label><input id="tennisHuaweiDate" type="date"></div>
      <div class="field"><label>Длительность HH:MM:SS</label><input id="tennisHuaweiDuration" placeholder="01:39:20"></div>
      <div class="field"><label>RPE 1–10 — твоя оценка</label><input id="tennisHuaweiRpe" type="number" min="1" max="10"></div>
      <div class="field"><label>Устройство</label><input id="tennisHuaweiDevice" value="Huawei Watch Fit 4 Pro"></div>
      <div class="field"><label>Ккал всего</label><input id="tennisHuaweiCalories" type="number" min="0"></div>
      <div class="field"><label>Активные ккал</label><input id="tennisHuaweiActiveCalories" type="number" min="0"></div>
      <div class="field"><label>Средний пульс</label><input id="tennisHuaweiAvgHr" type="number" min="30" max="260"></div>
      <div class="field"><label>Максимальный пульс</label><input id="tennisHuaweiMaxHr" type="number" min="30" max="280"></div>
      <div class="field"><label>Экстрим, мин</label><input id="tennisHuaweiExtreme" type="number" min="0" step="0.5"></div>
      <div class="field"><label>Анаэробная, мин</label><input id="tennisHuaweiAnaerobic" type="number" min="0" step="0.5"></div>
      <div class="field"><label>Аэробная, мин</label><input id="tennisHuaweiAerobic" type="number" min="0" step="0.5"></div>
      <div class="field"><label>Сжигание жира, мин</label><input id="tennisHuaweiFat" type="number" min="0" step="0.5"></div>
      <div class="field"><label>Разминка, мин</label><input id="tennisHuaweiWarmup" type="number" min="0" step="0.5"></div>
      <div class="field"><label>Аэробный эффект</label><input id="tennisHuaweiAerobicEffect" type="number" min="0" max="5.5" step="0.1"></div>
      <div class="field"><label>Анаэробный эффект</label><input id="tennisHuaweiAnaerobicEffect" type="number" min="0" max="5.5" step="0.1"></div>
      <div class="field"><label>Восстановление, ч</label><input id="tennisHuaweiRecoveryHours" type="number" min="0" step="0.5"></div>
      <div class="field"><label>Пульс восстановления — начало</label><input id="tennisHuaweiRecoveryStart" type="number" min="30" max="260"></div>
      <div class="field"><label>Пульс восстановления — конец</label><input id="tennisHuaweiRecoveryEnd" type="number" min="30" max="260"></div>
    </div>
    <div class="title" style="margin-top:14px">Куда сохранить</div>
    <div class="split" style="margin-top:8px"><select id="tennisHuaweiSession" onchange="tennisHuaweiLoadSelected()"></select><button class="btn secondary" onclick="tennisHuaweiAttach()">Привязать к выбранной</button><button class="btn" onclick="tennisHuaweiCreateSession()">Создать новую сессию + данные</button></div>
    <div id="tennisHuaweiSummary" style="margin-top:14px"></div>
    <div class="title" style="margin-top:14px">История данных часов</div><div id="tennisHuaweiHistory" style="margin-top:8px"></div>
  </div>`)
}
function tennisHuaweiRefresh(){
  tennisHuaweiEnsureUi();
  const select=document.getElementById("tennisHuaweiSession"),hist=document.getElementById("tennisHuaweiHistory"),sum=document.getElementById("tennisHuaweiSummary");if(!select||!hist||!sum)return;
  const before=select.value;select.innerHTML='<option value="">Сохранённая тренировка…</option>'+tennisHuaweiSessionOptions(before);if(before&&[...select.options].some(o=>o.value===before))select.value=before;
  const s=tennisHuaweiSummary();
  sum.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Сессий с часами</div><b>${s.n}</b></div><div class="report-item"><div class="smallcaps">Средний пульс по сессиям</div><b>${s.avgHr??"—"}</b></div><div class="report-item"><div class="smallcaps">Макс. зафиксированный</div><b>${s.maxHr??"—"}</b></div><div class="report-item"><div class="smallcaps">Средние ккал/ч</div><b>${s.kcalHour??"—"}</b></div></div>`;
  hist.innerHTML=tennisHuaweiHistoryHtml()
}
// Life RPG 13.0: lifecycle is owned by the central bootstrap render pipeline.
