"use strict";

/* Life RPG 11.1.0 — modular runtime bootstrap */

const LIFE_RPG_111_MODULES=[
  "data-os.js",
  "projects-os.js",
  "goals-os.js",
  "review-os.js",
  "calendar-os.js",
  "tasks-os.js",
  "routines-os.js",
  "inbox-os.js",
  "rules-os.js",
  "insights-os.js",
  "command-os.js",
  "calibration-os.js",
  "execution-os.js",
  "decision-os.js",
  "recovery-os.js",
  "life-os.js"
];

function life111LoadScript(file){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector?.(`script[data-life111="${file}"]`);
    if(existing){if(existing.dataset.ready==="1")resolve();else existing.addEventListener("load",resolve,{once:true});return}
    const s=document.createElement("script");s.src=`./${file}?v=${APP_VERSION}`;s.async=false;s.dataset.life111=file;
    s.onload=()=>{s.dataset.ready="1";resolve()};s.onerror=()=>reject(new Error(`Не удалось загрузить ${file}`));document.head.appendChild(s)
  })
}

function life111InstallRuntime(){
  if(window.__LIFE_RPG_111_RUNTIME__)return;window.__LIFE_RPG_111_RUNTIME__=true;
  const baseRender=render;
  render=function(){
    baseRender();
    ensureProjectsOsUi();renderProjectsOs();
    ensureGoalsOsUi();renderGoalsOs();
    ensureReviewOsUi();renderReviewOs();
    ensureCalendarOsUi();renderCalendarOs();
    ensureTasksOsUi();renderTasksOs();
    ensureRoutinesOsUi();renderRoutinesOs();
    ensureInboxOsUi();renderInboxOs();
    ensureExecutionOsUi();renderExecutionOs();
    ensureCalibrationOsUi();renderCalibrationOs();
    ensureDecisionOsUi();renderDecisionOs();
    ensureRulesOsUi();renderRulesOs();
    ensureInsightsOsUi();renderInsightsOs();
    ensureCommandOsUi();renderCommandOs();
    ensureDataOsUi();renderDataOs();
    ensureRecoveryOsUi();renderRecoveryOs();
    requestAnimationFrame(()=>{renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();for(const id of Object.keys(UX7_META))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false);window.LifePlatform?.refreshIcons?.()})
  };
  const baseSwitchTab=switchTab;
  switchTab=function(id){baseSwitchTab(id);requestAnimationFrame(()=>{const view=UX7_PREFS[id]||UX7_DEFAULTS[id];ux7SetView(id,view,false);ux7RefreshHeaders();ui82SyncChrome(id,view)})}
}

async function life111Boot(){
  window.__LIFE_RPG_HTML_VERSION__=APP_VERSION;document.title=`Life RPG ${APP_VERSION}`;
  if(!window.__LIFE_RPG_MODULES_PRELOADED__)for(const file of LIFE_RPG_111_MODULES)await life111LoadScript(file);
  life111InstallRuntime();ux7InstallShell();initUi();await loadState();if(typeof calibrationOnBoot==="function")await calibrationOnBoot()
}

life111Boot().catch(e=>{console.error("Life RPG boot failed",e);document.documentElement.classList.remove("life-rpg-booting");const box=document.getElementById("versionStatus");if(box)box.textContent=`Life RPG ${APP_VERSION} • ошибка загрузки: ${e.message}`;try{toast(`Ошибка запуска: ${e.message}`)}catch{}});
