"use strict";

/* Life RPG Personal OS — shared local-first store and widget registry. */

function personalData(){
  S.settings=S.settings||{};
  const p=S.settings.personalOS&&typeof S.settings.personalOS==="object"&&!Array.isArray(S.settings.personalOS)?S.settings.personalOS:(S.settings.personalOS={});
  for(const key of ["journal","decisions","people","interactions","timeboxes","focusSessions","chores","choreLogs","inventory","shopping","importFingerprints"]){
    if(!Array.isArray(p[key]))p[key]=[];
  }
  if(!p.dashboard||typeof p.dashboard!=="object"||Array.isArray(p.dashboard))p.dashboard={order:[],hidden:[],compact:false};
  if(!p.activeFocus||typeof p.activeFocus!=="object"||Array.isArray(p.activeFocus))p.activeFocus={};
  if(!p.version)p.version=1;
  return p
}

const PERSONAL_WIDGETS={};
function personalRegisterWidget(id,title,section="more"){
  PERSONAL_WIDGETS[id]={id,title,section};
}
function personalWidgetPrefs(){
  const d=personalData().dashboard;
  if(!Array.isArray(d.order))d.order=[];
  if(!Array.isArray(d.hidden))d.hidden=[];
  return d
}
function personalText(v){return String(v??"").trim()}
function personalNow(){return new Date().toISOString()}
function personalDaysSince(dateLike){
  const t=Date.parse(dateLike||"");if(!Number.isFinite(t))return null;
  return Math.max(0,Math.floor((Date.now()-t)/86400000))
}
function personalDatePlus(days,from=new Date()){return localDateKey(addDays(from,days))}
function personalFindTask(id){return typeof taskAll==="function"?taskAll().find(x=>String(x.id)===String(id)):null}
function personalFindTrackerByName(name){
  const q=personalText(name).toLowerCase();if(!q||typeof growthTrackers!=="function")return null;
  return growthTrackers().find(x=>String(x.name||"").toLowerCase()===q)||growthTrackers().find(x=>String(x.name||"").toLowerCase().includes(q)||q.includes(String(x.name||"").toLowerCase()))||null
}
function personalSafeJsonClone(x){try{return JSON.parse(JSON.stringify(x))}catch{return null}}
