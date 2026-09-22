"use strict";

/* Life RPG 10.1.0 — modular runtime bootstrap */

const LIFE_RPG_101_MODULES=[
  "life-os.js",
  "projects-os.js",
  "review-os.js",
  "calendar-os.js",
  "tasks-os.js",
  "inbox-os.js",
  "rules-os.js",
  "insights-os.js"
];

function life101LoadScript(file){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector?.(`script[data-life101="${file}"]`);
    if(existing){if(existing.dataset.ready==="1")resolve();else existing.addEventListener("load",resolve,{once:true});return}
    const s=document.createElement("script");
    s.src=`./${file}?v=${APP_VERSION}`;s.async=false;s.dataset.life101=file;
    s.onload=()=>{s.dataset.ready="1";resolve()};
    s.onerror=()=>reject(new Error(`Не удалось загрузить ${file}`));
    document.head.appendChild(s)
  })
}

function life101InstallRuntime(){
  if(window.__LIFE_RPG_101_RUNTIME__)return;window.__LIFE_RPG_101_RUNTIME__=true;
  const ux7BaseRender=render;
  render=function(){
    ux7BaseRender();
    ensureProjectsOsUi();renderProjectsOs();
    ensureReviewOsUi();renderReviewOs();
    ensureCalendarOsUi();renderCalendarOs();
    ensureTasksOsUi();renderTasksOs();
    ensureInboxOsUi();renderInboxOs();
    ensureRulesOsUi();renderRulesOs();
    ensureInsightsOsUi();renderInsightsOs();
    requestAnimationFrame(()=>{
      renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();
      for(const id of Object.keys(UX7_META))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false);
      window.LifePlatform?.refreshIcons?.()
    })
  };
  const ux7BaseSwitchTab=switchTab;
  switchTab=function(id){ux7BaseSwitchTab(id);requestAnimationFrame(()=>{const view=UX7_PREFS[id]||UX7_DEFAULTS[id];ux7SetView(id,view,false);ux7RefreshHeaders();ui82SyncChrome(id,view)})}
}

async function life101Boot(){
  window.__LIFE_RPG_HTML_VERSION__=APP_VERSION;
  document.title=`Life RPG ${APP_VERSION}`;
  if(!window.__LIFE_RPG_MODULES_PRELOADED__)for(const file of LIFE_RPG_101_MODULES)await life101LoadScript(file);
  life101InstallRuntime();
  ux7InstallShell();
  initUi();
  await loadState()
}

life101Boot().catch(e=>{
  console.error("Life RPG boot failed",e);
  document.documentElement.classList.remove("life-rpg-booting");
  const box=document.getElementById("versionStatus");if(box)box.textContent=`Life RPG ${APP_VERSION} • ошибка загрузки: ${e.message}`;
  try{toast(`Ошибка запуска: ${e.message}`)}catch{}
});
