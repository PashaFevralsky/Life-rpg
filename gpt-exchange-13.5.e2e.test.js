import fs from "node:fs";
import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#versionStatus")).toContainText("13.2.2");
  return errors
}

test("GPT Exchange 13.5.1 safely imports tasks/calendar and guidance",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{switchTab("more");ux7SetView("more","overview",false)});
  await expect(page.locator("#gpt135Card")).toBeVisible();
  await expect(page.locator("#gpt135Card")).toContainText("GPT Exchange 13.5.1");
  await expect(page.locator("#ai134Card")).toHaveCount(0);
  expect(await page.evaluate(()=>typeof ai134Ask)).toBe("undefined");

  const today=await page.evaluate(()=>localDateKey()),tomorrow=await page.evaluate(()=>localDateKey(addDays(new Date(),1)));
  const payload={
    format:"life-rpg-gpt-response-v1",version:1,packageId:"pkg-e2e-guidance",generatedAt:new Date().toISOString(),
    summary:"E2E GPT plan",
    tasks:[{title:"GPT E2E задача",area:"Работа",priority:1,plannedDate:today,dueDate:"",notBefore:"",minutes:25,note:"test"}],
    calendar:[{title:"GPT E2E событие",type:"Работа",dateKey:tomorrow,minutes:30,priority:2,note:"test"}],
    recommendations:[{area:"Работа",title:"E2E recommendation",detail:"test"}],assumptions:[],
    guidance:{
      headline:"E2E headline",validThrough:tomorrow,
      todayTop3:[{title:"E2E приоритет",area:"Работа",reason:"Проверка guidance"}],
      weekFocus:[{title:"E2E фокус недели",area:"Работа",outcome:"Готово"}],
      guardrails:["E2E guardrail"],
      domainNotes:[{area:"Работа",status:"watch",title:"E2E domain",detail:"test"}],
      reviewPrompt:"E2E next review"
    }
  };
  await page.locator("#gpt135ImportFile").setInputFiles({
    name:"gpt-response.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(payload))
  });
  await expect(page.locator("#gpt135Preview")).toContainText("E2E GPT plan");
  await expect(page.locator("#gpt135Preview")).toContainText("Сохранить GPT-слой в Life OS");
  await expect(page.locator("#gpt135Preview")).toContainText("E2E приоритет");

  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#gpt135ApplyBtn").click();

  expect(await page.evaluate(()=>taskActive().some(x=>x.title==="GPT E2E задача"))).toBe(true);
  expect(await page.evaluate(()=>calendarManualEvents().some(x=>x.title==="GPT E2E событие"))).toBe(true);
  expect(await page.evaluate(()=>gpt135Store().activeGuidance?.headline)).toBe("E2E headline");

  await page.evaluate(()=>{switchTab("today");ux7SetView("today","focus",false)});
  await expect(page.locator("#gpt135LifeOsLayer")).toBeVisible();
  await expect(page.locator("#gpt135LifeOsLayer")).toContainText("E2E приоритет");
  await expect(page.locator("#gpt135LifeOsLayer")).toContainText("E2E headline");
  expect(errors).toEqual([])
});

test("GPT Exchange export advertises guidance and includes previous accepted layer",async({page})=>{
  await boot(page);
  await page.evaluate(()=>{
    const st=gpt135Store();
    st.activeGuidance={version:1,headline:"Previous guidance",validThrough:localDateKey(),todayTop3:[],weekFocus:[],guardrails:[],domainNotes:[],reviewPrompt:""};
    switchTab("more");ux7SetView("more","overview",false)
  });
  await page.locator("#gpt135Question").fill("Составь план на сегодня");
  const downloadPromise=page.waitForEvent("download");
  await page.locator("#gpt135ExportBtn").click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^life-rpg-gpt-context-\d{4}-\d{2}-\d{2}\.json$/);
  const p=await download.path();
  const data=JSON.parse(fs.readFileSync(p,"utf8"));
  expect(data.responseSchema.guidance.todayTop3).toBeTruthy();
  expect(data.context.previousGpt.activeGuidance.headline).toBe("Previous guidance");
});
