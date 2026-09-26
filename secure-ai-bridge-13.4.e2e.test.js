import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#versionStatus")).toContainText("13.2.2");
  return errors
}
function corsHeaders(){return {"Access-Control-Allow-Origin":"http://127.0.0.1:4173","Access-Control-Allow-Headers":"Content-Type,X-Life-RPG-Token","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json"}}

test("Secure AI Bridge 13.4 keeps provider key server-side and sends fact pack through bridge",async({page})=>{
  let posted=null,token="";
  await page.route("https://bridge.example.test/**",async route=>{
    const req=route.request(),method=req.method(),url=req.url();
    if(method==="OPTIONS"){await route.fulfill({status:204,headers:corsHeaders(),body:""});return}
    if(url.endsWith("/health")){await route.fulfill({status:200,headers:corsHeaders(),body:JSON.stringify({ok:true,protocol:"life-rpg-secure-ai-bridge-v1",model:"gpt-6-luna",webSearch:false,accessTokenConfigured:true,openaiKeyConfigured:true})});return}
    if(url.endsWith("/v1/ask")){posted=req.postDataJSON();token=req.headers()["x-life-rpg-token"]||"";await route.fulfill({status:200,headers:corsHeaders(),body:JSON.stringify({ok:true,protocol:"life-rpg-secure-ai-bridge-v1",requestId:posted.requestId,answer:"1. Сделать проверяемый следующий шаг.\n2. Не выдумывать отсутствующие данные.",model:"gpt-6-luna",providerRequestId:"req_test"})});return}
    await route.fulfill({status:404,headers:corsHeaders(),body:"{}"})
  });
  const errors=await boot(page);
  await page.evaluate(()=>{switchTab("more");ux7SetView("more","settings",false)});
  await expect(page.locator("#ai134SettingsCard")).toBeVisible();
  await page.locator("#ai134Endpoint").fill("https://bridge.example.test");
  await page.locator("#ai134Token").fill("local-bridge-token");
  await page.getByRole("button",{name:"Сохранить"}).last().click();
  await page.locator("#ai134HealthBtn").click();
  await expect(page.locator("#ai134HealthState")).toContainText("backend OK");

  await page.evaluate(()=>ux7SetView("more","overview",false));
  await expect(page.locator("#ai134Card")).toBeVisible();
  await page.locator("#ai134Question").fill("Что делать сегодня?");
  await page.locator("#ai134AskBtn").click();
  await expect(page.locator("#ai134Answer")).toContainText("Сделать проверяемый следующий шаг");
  expect(posted.protocol).toBe("life-rpg-secure-ai-bridge-v1");
  expect(posted.context.stateVersion).toBe(18);
  expect(posted.context.sources.length).toBeGreaterThan(0);
  expect(JSON.stringify(posted)).not.toContain("local-bridge-token");
  expect(token).toBe("local-bridge-token");
  expect(await page.evaluate(()=>JSON.stringify(S).includes("local-bridge-token"))).toBe(false);
  expect(errors).toEqual([])
});

test("Secure AI Bridge 13.4 transports an explicitly attached document without persisting its bytes",async({page})=>{
  let posted=null;
  await page.route("https://bridge.example.test/**",async route=>{
    const req=route.request(),method=req.method();
    if(method==="OPTIONS"){await route.fulfill({status:204,headers:corsHeaders(),body:""});return}
    if(req.url().endsWith("/v1/ask")){posted=req.postDataJSON();await route.fulfill({status:200,headers:corsHeaders(),body:JSON.stringify({ok:true,answer:"Файл получен.",model:"gpt-6-luna",requestId:posted.requestId})});return}
    await route.fulfill({status:200,headers:corsHeaders(),body:JSON.stringify({ok:true})})
  });
  await boot(page);
  await page.evaluate(()=>{S.settings.aiBridge134={version:1,endpoint:"https://bridge.example.test",privacy:"summary",scopes:{finance:true,work:true,tennis:true,training:true,knowledge:true,planning:true,intelligence:true},history:[]};localStorage.setItem("lifeRpgAiBridge134AccessToken","t");switchTab("more");ux7SetView("more","overview",false);render()});
  await page.locator("#ai134Files").setInputFiles({name:"request.txt",mimeType:"text/plain",buffer:Buffer.from("airflow 1500 m3/h, pressure 320 Pa")});
  await page.locator("#ai134Question").fill("Разбери заявку");
  await page.locator("#ai134AskBtn").click();
  await expect(page.locator("#ai134Answer")).toContainText("Файл получен");
  expect(posted.attachments).toHaveLength(1);expect(posted.attachments[0].name).toBe("request.txt");expect(posted.attachments[0].dataUrl).toMatch(/^data:text\/plain;base64,/);
  expect(await page.evaluate(()=>JSON.stringify(S).includes("airflow 1500"))).toBe(false)
});
