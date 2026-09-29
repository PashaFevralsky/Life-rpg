import { test, expect } from "@playwright/test";
test("Stage 3.3 Safe Mode is read-only across lazy stores and render", async ({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);await expect(page.locator("#versionStatus")).toContainText("13.9.1");
  const result=await page.evaluate(async()=>{
    const original=deepClone(S);localStorage.setItem("lifeRpgRecovery133SafeMode","1");recovery133ApplySafeModeUi();
    delete S.settings.personalOS;delete S.settings.growthOS;delete S.settings.intelligence132;delete S.settings.gptExchange135;delete S.settings.aiBridge134;delete S.settings.shareHub131;delete S.settings.decisionPreferences;delete S.settings.ruleToggles;delete S.settings.knowledgeNotes;
    for(const k of ["projects","tasks","goals","routines","routineLogs","reviews","inbox","calendarEvents"])S.entities[k]=undefined;
    const beforeStores=JSON.stringify(S);
    for(const fn of [()=>personalData(),()=>growthData(),()=>entityStore("projects"),()=>projectStore(),()=>taskStore(),()=>goalStore(),()=>routineStore(),()=>routineLogStore(),()=>reviewStore(),()=>calendarStore(),()=>inboxStore(),()=>knowledgeNoteStore(),()=>decisionPreferenceStore(),()=>ruleToggles(),()=>intelligence132Store(),()=>gpt135Store(),()=>typeof ai134Store==="function"&&ai134Store(),()=>share131State()])fn();
    const storesUnchanged=JSON.stringify(S)===beforeStores;
    const beforeRender=JSON.stringify(S);render();await new Promise(r=>setTimeout(r,180));const renderUnchanged=JSON.stringify(S)===beforeRender;
    S=deepClone(original);storageRememberDurable(original);S.profile.name="unsafe-write";let code="";try{await save()}catch(e){code=e.code||""}const rolledBack=S.profile.name===original.profile.name;
    localStorage.removeItem("lifeRpgRecovery133SafeMode");recovery133ApplySafeModeUi();S=deepClone(original);render();
    return {storesUnchanged,renderUnchanged,code,rolledBack};
  });
  expect(result).toEqual({storesUnchanged:true,renderUnchanged:true,code:"LIFE_RPG_SAFE_MODE",rolledBack:true});expect(errors).toEqual([]);
});