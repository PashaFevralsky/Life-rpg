"use strict";

/* Life RPG 8.1.0 — Runtime bootstrap */

const ux7BaseRender=render;

render=function(){ux7BaseRender();requestAnimationFrame(()=>{renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();for(const id of Object.keys(UX7_META))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false)})};

const ux7BaseSwitchTab=switchTab;

switchTab=function(id){ux7BaseSwitchTab(id);requestAnimationFrame(()=>{const view=UX7_PREFS[id]||UX7_DEFAULTS[id];ux7SetView(id,view,false);ux7RefreshHeaders();ui81SyncChrome(id,view)})};

ux7InstallShell();

initUi();

loadState();
