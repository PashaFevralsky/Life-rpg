import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#versionStatus")).toContainText("13.2.2");
  return errors
}
function corsHeaders(){return {"Access-Control-Allow-Origin":"http://127.0.0.1:4173","Access-Control-Allow-Headers":"Content-Type,X-Life-RPG-Token","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json"}}
function postedJson(req){
  const raw=req.postData()||"{}";
  return JSON.parse(raw);
}

test("Free AI Bridge 13.4.2 sends fact pack to Cloudflare Workers AI bridge without token",async({page})=>{
  let posted=null,token="";
  await page.route("https://bridge.example.test/**",async route=>{
    const req=route.request(),method=req.method(),url=req.url();
    if(method==="OPTIONS"){await route.fulfill({status:204,headers:corsHeaders(),body:""});return}
    if(url.endsWith("/health")){
      await route.fulfill({status:200,headers:corsHeaders(),body:JSON.stringify({
        ok:true,protocol:"life-rpg-secure-ai-bridge-v1",provider:"cloudflare-workers-ai",
        model:"@cf/zai-org/glm-4.7-flash",freeAllocation:"10000 neurons/day",
        tokenRequired:false,accessTokenConfigured:false
      })});return
    }
    if(url.endsWith("/v1/ask")){
      posted=postedJson(req);
      token=req.headers()["x-life-rpg-token"]||"";
      await route.fulfill({status:200,headers:corsHeaders(),body:JSON.stringify({
        ok:true,protocol:"life-rpg-secure-ai-bridge-v1",requestId:posted.requestId,
        answer:"Бесплатный ответ из Workers AI.",model:"@cf/zai-org/glm-4.7-flash",
        provider:"cloudflare-workers-ai"
      })});return
    }
    await route.fulfill({status:404,headers:corsHeaders(),body:"{}"})
  });

  const errors=await boot(page);
  await page.evaluate(()=>{localStorage.removeItem("lifeRpgAiBridge134AccessToken");switchTab("more");ux7SetView("more","settings",false)});
  await expect(page.locator("#ai134SettingsCard")).toContainText("Бесплатное подключение");
  await page.locator("#ai134Endpoint").fill("https://bridge.example.test");
  await page.getByRole("button",{name:"Сохранить"}).last().click();
  await page.locator("#ai134HealthBtn").click();
  await expect(page.locator("#ai134HealthState")).toContainText("Workers AI Free OK");

  await page.evaluate(()=>ux7SetView("more","overview",false));
  await expect(page.locator("#ai134Card")).toContainText("AI без платного API");
  await page.locator("#ai134Question").fill("Что делать сегодня?");
  await page.locator("#ai134AskBtn").click();
  await expect(page.locator("#ai134Answer")).toContainText("Бесплатный ответ",{timeout:10000});

  expect(posted.protocol).toBe("life-rpg-secure-ai-bridge-v1");
  expect(posted.context.stateVersion).toBe(18);
  expect(posted.context.sources.length).toBeGreaterThan(0);
  expect(token).toBe("");
  expect(await page.evaluate(()=>JSON.stringify(S).includes("lifeRpgAiBridge134AccessToken"))).toBe(false);
  expect(errors).toEqual([])
});

test("Free AI Bridge 13.4.2 shares fact pack and files through Android Share without backend",async({page})=>{
  const errors=await boot(page);
  await page.addInitScript(()=>{});
  await page.evaluate(()=>{
    window.__sharedPayload=null;
    Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});
    Object.defineProperty(navigator,"share",{configurable:true,value:async data=>{window.__sharedPayload={title:data.title,text:data.text,files:(data.files||[]).map(f=>({name:f.name,size:f.size,type:f.type}))}}});
    switchTab("more");ux7SetView("more","overview",false);render()
  });
  await page.locator("#ai134Question").fill("Проверь текущие риски");
  await page.locator("#ai134Files").setInputFiles({name:"request.txt",mimeType:"text/plain",buffer:Buffer.from("airflow 1500 m3/h, pressure 320 Pa")});
  await page.locator("#ai134ShareChatGptBtn").click();
  const p=await page.evaluate(()=>window.__sharedPayload);
  expect(p.title).toBe("Life RPG → ChatGPT");expect(p.text).toContain("FACT_PACK");expect(p.text).toContain("Проверь текущие риски");
  expect(p.files).toHaveLength(1);expect(p.files[0].name).toBe("request.txt");
  expect(await page.evaluate(()=>JSON.stringify(S).includes("airflow 1500"))).toBe(false);expect(errors).toEqual([])
});

test("Free AI Bridge 13.4.2 keeps attached document transient when using tokenless Worker",async({page})=>{
  let posted=null;
  await page.route("https://bridge.example.test/**",async route=>{
    const req=route.request(),method=req.method();
    if(method==="OPTIONS"){await route.fulfill({status:204,headers:corsHeaders(),body:""});return}
    if(req.url().endsWith("/v1/ask")){
      posted=postedJson(req);
      await route.fulfill({status:200,headers:corsHeaders(),body:JSON.stringify({
        ok:true,answer:"Файл обработан бесплатно.",model:"@cf/zai-org/glm-4.7-flash",
        provider:"cloudflare-workers-ai",requestId:posted.requestId
      })});return
    }
    await route.fulfill({status:200,headers:corsHeaders(),body:JSON.stringify({ok:true})})
  });

  await boot(page);
  await page.evaluate(()=>{
    localStorage.removeItem("lifeRpgAiBridge134AccessToken");
    S.settings.aiBridge134={version:3,endpoint:"https://bridge.example.test",privacy:"summary",
      scopes:{finance:true,work:true,tennis:true,training:true,knowledge:true,planning:true,intelligence:true},history:[]};
    switchTab("more");ux7SetView("more","overview",false);render()
  });
  await page.locator("#ai134Files").setInputFiles({name:"request.txt",mimeType:"text/plain",buffer:Buffer.from("airflow 1500 m3/h, pressure 320 Pa")});
  await page.locator("#ai134Question").fill("Разбери заявку");
  await page.locator("#ai134AskBtn").click();
  await expect(page.locator("#ai134Answer")).toContainText("Файл обработан бесплатно",{timeout:10000});

  expect(posted.attachments).toHaveLength(1);
  expect(posted.attachments[0].dataUrl).toMatch(/^data:text\/plain;base64,/);
  expect(await page.evaluate(()=>JSON.stringify(S).includes("airflow 1500"))).toBe(false)
});
