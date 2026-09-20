"use strict";

/* Life RPG 8.0.3 — Runtime bootstrap */

const ux7BaseRender=render;

render=function(){ux7BaseRender();requestAnimationFrame(()=>{renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();for(const id of Object.keys(UX7_META))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false)})};

const ux7BaseSwitchTab=switchTab;

switchTab=function(id){ux7BaseSwitchTab(id);requestAnimationFrame(()=>{ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false);ux7RefreshHeaders()})};

ux7InstallShell();

initUi();

loadState();
