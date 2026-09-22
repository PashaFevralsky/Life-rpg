"use strict";

/* Life RPG 10.0.2 — Runtime bootstrap */

const ux7BaseRender=render;

render=function(){ux7BaseRender();requestAnimationFrame(()=>{renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();for(const id of Object.keys(UX7_META))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false);window.LifePlatform?.refreshIcons?.()})};

const ux7BaseSwitchTab=switchTab;

switchTab=function(id){ux7BaseSwitchTab(id);requestAnimationFrame(()=>{const view=UX7_PREFS[id]||UX7_DEFAULTS[id];ux7SetView(id,view,false);ux7RefreshHeaders();ui82SyncChrome(id,view)})};

ux7InstallShell();

initUi();

loadState();
