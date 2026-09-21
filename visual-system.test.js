"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert");
const css=fs.readFileSync(path.join(__dirname,"styles.css"),"utf8"),html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8"),ui=fs.readFileSync(path.join(__dirname,"ui.js"),"utf8");
const families=[
  "quick","kpi","report-item","health-item","decision-kpis","forecast-card","money-balance","bank-sync-summary","autopilot-step","compare-card","mini-forecast",
  "log-item","quest","debt","scenario","reward","envelope","cashflow-event","regular-row","income-schedule-row","account-row","transaction-row","debt-engine-row","asset-row","smart-proposal","ai-action","decision-row","boss-mini",
  "goal","phase-box","accepted-plan","book","skill-node","season","ach","ocr-row","crm-deal","cash-advisor","event","life-score","stat-row","funnel-row","calendar","day","entry-details","settings-group","crm-details","modal-card","bottom","navbtn","ux7-action-grid"
];
for(const c of families)assert.ok(css.includes(`.ui82 .${c}`),`UI82 visual coverage missing for .${c}`);
assert.ok(html.includes('data-lucide="plus"')&&html.includes('data-lucide="briefcase"'),"static quick actions must use Lucide line icons");
assert.ok(ui.includes('function ui82Icon(name)'),"dynamic quick actions must use ui82 icon helper");
assert.ok(!css.includes('.ui82 .quick button{min-height:64px;border:0;border-radius:16px;background:#141923'),"old 8.1 shortcut tile styling leaked into active layer");
console.log(`OK — Life RPG 9.0.0 visual-system coverage passed: ${families.length} component families`);
