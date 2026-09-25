"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert"),root=__dirname;
const files=[
  "data-os.js","work.js","work-growth.js","tennis.js","tennis-huawei.js","knowledge.js","routines-os.js","inbox-os.js","life-os.js","personal-integration-os.js",
  "tracking-os.js","people-os.js","focus-os.js","body-os.js","home-os.js","capture2-os.js","dashboard-os.js","ux-12.8.js","training-os.js"
];
const legacyAllow=new Set([
  "data-os.js:dataIntegrityIssues",
  "work.js:renderWork",
  "tennis.js:tennisExposure","tennis.js:tennisFocusRecommendation","tennis.js:tennisRecommendation","tennis.js:renderTennis",
  "knowledge.js:knowledgeReviewQueue","knowledge.js:markKnowledgeReviewed","knowledge.js:renderReadingDashboard",
  "routines-os.js:activeDay",
  "inbox-os.js:renderKnowledgeBase",
  "life-os.js:lifeScore","life-os.js:dailyEngineItems","life-os.js:renderPriorities","life-os.js:renderToday",
  "personal-integration-os.js:lifeTimelineEvents","personal-integration-os.js:activeDay","personal-integration-os.js:lifeOsRawCandidates"
]);
const found=[],scanned=new Set();
for(const file of files){
  const full=path.join(root,file);if(!fs.existsSync(full))continue;scanned.add(file);
  const src=fs.readFileSync(full,"utf8");
  for(const m of src.matchAll(/^([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/gm))found.push(`${file}:${m[1]}`)
}
const unexpected=found.filter(x=>!legacyAllow.has(x));
const missingLegacy=[...legacyAllow].filter(x=>scanned.has(x.split(":")[0])&&!found.includes(x));
assert.deepEqual(unexpected,[],`New runtime monkey-patches are forbidden: ${unexpected.join(", ")}`);
assert.deepEqual(missingLegacy,[],`Legacy monkey-patch allowlist changed; review intentionally: ${missingLegacy.join(", ")}`);
assert.ok(!fs.readFileSync(path.join(root,"work-growth.js"),"utf8").includes("renderWork=function"),"Work 12.1 must use render pipeline, not override renderWork");
assert.ok(!fs.readFileSync(path.join(root,"training-os.js"),"utf8").includes("lifeOsRawCandidates=function"),"Training OS must use Life OS provider API");
assert.ok(!fs.readFileSync(path.join(root,"ux-12.8.js"),"utf8").includes("switchTab=function"),"UX 12.8 must use navigation hooks");
for(const file of ["tasks-os.js","goals-os.js","routines-os.js","inbox-os.js"]){
  const src=fs.readFileSync(path.join(root,file),"utf8");
  assert.ok(!/a\[i\]\s*=\s*(?:task|goal|routine|inbox)Normalize\(/.test(src),`${file} must not replace entity objects during reads`)
}
console.log(`OK — refactor guard: ${found.length} reviewed legacy overrides, no hidden Work/Training/UX monkey-patches`);
