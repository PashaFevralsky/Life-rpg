import fs from "node:fs";
import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#versionStatus")).toContainText("13.2.2");
  return errors
}

test("GPT Exchange 13.6 binds package, tracks outcomes and exports feedback delta",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{switchTab("more");ux7SetView("more","overview",false)});
  await expect(page.locator("#gpt135Card")).toBeVisible();
  await expect(page.locator("#gpt135Card")).toContainText("GPT Exchange 13.6");

  await page.locator("#gpt135Question").fill("Проведи полный разбор");
  const d1p=page.waitForEvent("download");
  await page.locator("#gpt135ExportBtn").click();
  const d1=await d1p,p1=await d1.path(),ctx1=JSON.parse(fs.readFileSync(p1,"utf8"));
  expect(ctx1.context.feedback136).toBeTruthy();
  expect(ctx1.context.feedback136.changesSincePreviousGpt).toBeTruthy();
  expect(await page.evaluate(id=>!!gpt136FindExport(id),ctx1.packageId)).toBe(true);

  const today=await page.evaluate(()=>localDateKey());
  const tomorrow=await page.evaluate(()=>localDateKey(addDays(new Date(),1)));
  const response={
    format:"life-rpg-gpt-response-v1",version:1,packageId:ctx1.packageId,generatedAt:new Date().toISOString(),
    summary:"13.6 E2E",
    tasks:[{title:"Сверить E2E финансовый буфер",area:"Финансы",priority:1,plannedDate:today,dueDate:"",notBefore:"",minutes:20,note:"test"}],
    calendar:[{title:"E2E восстановительная прогулка",type:"Тренировка",dateKey:tomorrow,minutes:20,priority:2,note:"test"}],
    recommendations:[],assumptions:[],
    guidance:{
      headline:"E2E guidance",validThrough:tomorrow,
      todayTop3:[{title:"Сверить E2E финансовый буфер",area:"Финансы",reason:"test"}],
      weekFocus:[],guardrails:[],domainNotes:[],reviewPrompt:""
    },
    feedbackDecisions:[]
  };
  await page.locator("#gpt135ImportFile").setInputFiles({
    name:"gpt-response-13.6.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(response))
  });
  await expect(page.locator("#gpt135Preview")).toContainText("packageId подтверждён");
  page.once("dialog",d=>d.accept());
  await page.locator("#gpt135ApplyBtn").click();

  const receipt=await page.evaluate(()=>gpt136Store().receipts[0]);
  expect(receipt.packageId).toBe(ctx1.packageId);
  expect(receipt.tasks.length).toBe(1);
  expect(receipt.calendar.length).toBe(1);

  await page.evaluate(async()=>{
    const r=gpt136Store().receipts[0];
    await completeTask(r.tasks[0].id);
    await setCalendarEventStatus(r.calendar[0].id,"done");
  });

  await page.evaluate(()=>{switchTab("more");ux7SetView("more","overview",false)});
  await page.locator("#gpt135Question").fill("Обнови план после выполненных действий");
  const d2p=page.waitForEvent("download");
  await page.locator("#gpt135ExportBtn").click();
  const d2=await d2p,p2=await d2.path(),ctx2=JSON.parse(fs.readFileSync(p2,"utf8"));

  const tracked=ctx2.context.feedback136.previousActions.find(x=>x.packageId===ctx1.packageId);
  expect(tracked).toBeTruthy();
  expect(tracked.tasks[0].status).toBe("done");
  expect(tracked.calendar[0].status).toBe("done");
  expect(ctx2.context.feedback136.guidanceFeedback.todayTop3[0].status).toBe("done");
  expect(ctx2.context.feedback136.changesSincePreviousGpt.available).toBe(true);
  expect(ctx2.context.feedback136.changesSincePreviousGpt.changedDomains).toContain("tasks");
  expect(errors).toEqual([])
});

test("GPT Exchange 13.6 blocks response with unknown packageId",async({page})=>{
  await boot(page);
  await page.evaluate(()=>{switchTab("more");ux7SetView("more","overview",false)});
  const payload={
    format:"life-rpg-gpt-response-v1",version:1,packageId:"pkg-never-exported",generatedAt:new Date().toISOString(),
    summary:"bad binding",tasks:[],calendar:[],recommendations:[],assumptions:[],feedbackDecisions:[]
  };
  await page.locator("#gpt135ImportFile").setInputFiles({
    name:"unknown.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(payload))
  });
  await expect(page.locator("#gpt135Preview")).toContainText("неизвестному packageId");
  await expect(page.locator("#gpt135ApplyBtn")).toHaveCount(0);
});
