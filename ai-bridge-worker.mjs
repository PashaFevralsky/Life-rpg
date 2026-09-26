/* Life RPG 13.4.1 — Free AI Bridge Worker
   Cloudflare Workers AI only. No paid provider API key is required.
   Add a Workers AI binding named AI in the Cloudflare dashboard. */

const PROTOCOL="life-rpg-secure-ai-bridge-v1";
const DEFAULT_ORIGIN="https://pashafevralsky.github.io";
const DEFAULT_MODEL="@cf/zai-org/glm-4.7-flash";
const DEFAULT_FALLBACK_MODEL="@cf/google/gemma-4-26b-a4b-it";
const MAX_BODY_BYTES=18*1024*1024;
const MAX_CONTEXT_CHARS=180000;
const MAX_SHARED_TEXT=30000;
const MAX_ATTACHMENTS=3;
const MAX_ATTACHMENT_DATA_CHARS=12*1024*1024*4/3+2048;
const MAX_CONVERTED_CHARS=70000;

function allowedOrigins(env){return String(env.ALLOWED_ORIGINS||DEFAULT_ORIGIN).split(",").map(x=>x.trim()).filter(Boolean)}
function cors(origin,env){
  const allowed=allowedOrigins(env),ok=!origin||allowed.includes(origin);
  if(!ok)return null;
  return {"Access-Control-Allow-Origin":origin||allowed[0]||DEFAULT_ORIGIN,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,X-Life-RPG-Token","Access-Control-Max-Age":"86400","Vary":"Origin","Cache-Control":"no-store"}
}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...(headers||{})}})}
function equalSecret(a,b){
  a=String(a||"");b=String(b||"");let diff=a.length^b.length,n=Math.max(a.length,b.length);
  for(let i=0;i<n;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return diff===0
}
function cleanString(v,max){return String(v||"").trim().slice(0,max)}
function tokenRequired(env){return !!String(env.BRIDGE_ACCESS_TOKEN||"").trim()}
function quotaError(e){return /neuron|quota|daily limit|free allocation|3040|out of capacity|capacity/i.test(String(e?.message||e))}
function dataUrlBlob(dataUrl,mime){
  const m=String(dataUrl||"").match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/);if(!m)throw new Error("Некорректный attachment data URL");
  const raw=atob(m[2].replace(/\s+/g,"")),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new Blob([bytes],{type:mime||m[1]||"application/octet-stream"})
}
function cleanAttachments(rows){
  if(!Array.isArray(rows))return [];
  const out=[];
  for(const a of rows.slice(0,MAX_ATTACHMENTS)){
    const dataUrl=String(a?.dataUrl||""),name=cleanString(a?.name||"file",180),mime=cleanString(a?.mime||"application/octet-stream",120);
    if(dataUrl.length>MAX_ATTACHMENT_DATA_CHARS)throw new Error(`Attachment слишком большой: ${name}`);
    out.push({name,mime,dataUrl})
  }
  return out
}
async function convertAttachments(rows,env){
  if(!rows.length)return "";
  if(!env.AI?.toMarkdown)throw new Error("Workers AI binding AI не настроен");
  const docs=rows.map(a=>({name:a.name,blob:dataUrlBlob(a.dataUrl,a.mime)}));
  const result=await env.AI.toMarkdown(docs,{conversionOptions:{output:{format:"text"},pdf:{metadata:false},image:{descriptionLanguage:"ru"}}});
  const list=Array.isArray(result)?result:[result],chunks=[];
  for(const x of list){
    if(x?.format==="error")chunks.push(`FILE ${x.name||"unknown"}: conversion error: ${x.error||"unknown"}`);
    else chunks.push(`FILE ${x?.name||"unknown"}:\n${cleanString(x?.data,MAX_CONVERTED_CHARS)}`)
  }
  return chunks.join("\n\n").slice(0,MAX_CONVERTED_CHARS)
}
function instructions(){
  return [
    "Ты — аналитический слой Life RPG. Отвечай по-русски, кратко и предметно.",
    "Персональные факты бери только из FACT_PACK, SHARED_TEXT и преобразованных приложений.",
    "Не заполняй пробелы выдумками. Явно разделяй факты, выводы/интерпретации и неизвестное, когда это влияет на решение.",
    "Если данные конфликтуют, укажи конфликт. Если данных недостаточно — скажи, какой конкретно факт нужен.",
    "Не утверждай, что действие выполнено, и не изменяй Life RPG: backend только формирует ответ.",
    "Для технических заявок сначала извлекай требования, противоречия и недостающие параметры. Не выдумывай артикулы, характеристики, наличие или цены.",
    "Ссылайся на названия источников из context.sources, когда это полезно."
  ].join("\n")
}
function extractText(data){
  if(typeof data==="string")return data.trim();
  if(typeof data?.response==="string")return data.response.trim();
  const c=data?.choices?.[0]?.message?.content;
  if(typeof c==="string")return c.trim();
  if(Array.isArray(c))return c.map(x=>typeof x==="string"?x:String(x?.text||x?.content||"")).filter(Boolean).join("\n").trim();
  if(typeof data?.result?.response==="string")return data.result.response.trim();
  return ""
}
async function runModel(messages,env){
  if(!env.AI?.run)throw Object.assign(new Error("Workers AI binding AI не настроен"),{status:503});
  const primary=String(env.WORKERS_AI_MODEL||DEFAULT_MODEL),fallback=String(env.WORKERS_AI_FALLBACK_MODEL||DEFAULT_FALLBACK_MODEL);
  const models=[primary,...(fallback&&fallback!==primary?[fallback]:[])],maxTokens=Math.max(256,Math.min(3000,Number(env.MAX_OUTPUT_TOKENS)||1400));
  let last=null;
  for(const model of models){
    try{
      const result=await env.AI.run(model,{messages,max_tokens:maxTokens,temperature:0.2,store:false});
      const answer=extractText(result);if(!answer)throw new Error("Workers AI вернул пустой текст");
      return {answer,model,usage:result?.usage||null}
    }catch(e){
      last=e;if(quotaError(e))throw Object.assign(new Error("Бесплатная квота Workers AI или доступная мощность исчерпана. Используй «Поделиться → ChatGPT»."),{status:429});
    }
  }
  throw Object.assign(last||new Error("Workers AI unavailable"),{status:503})
}
async function handleAsk(body,env){
  const attachments=cleanAttachments(body.attachments),contextText=JSON.stringify(body.context||{});
  if(contextText.length>MAX_CONTEXT_CHARS)throw Object.assign(new Error("Fact pack слишком большой"),{status:413});
  let converted="";if(attachments.length)converted=await convertAttachments(attachments,env);
  const shared=cleanString(body.sharedText,MAX_SHARED_TEXT),prompt=[
    `MODE: ${cleanString(body.mode||"general",40)}`,
    `QUESTION:\n${cleanString(body.question,6000)}`,
    `CONTEXT_HASH: ${cleanString(body.contextHash,100)}`,
    `FACT_PACK:\n${contextText}`,
    shared?`SHARED_TEXT:\n${shared}`:"",
    converted?`ATTACHMENTS_TEXT:\n${converted}`:""
  ].filter(Boolean).join("\n\n");
  return runModel([{role:"system",content:instructions()},{role:"user",content:prompt}],env)
}

export default {
  async fetch(request,env){
    const origin=request.headers.get("Origin")||"",corsHeaders=cors(origin,env);
    if(!corsHeaders)return json({ok:false,error:"Origin not allowed"},403,{"Cache-Control":"no-store"});
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});
    const url=new URL(request.url),required=tokenRequired(env),model=String(env.WORKERS_AI_MODEL||DEFAULT_MODEL);
    if(url.pathname==="/health"&&request.method==="GET")return json({ok:true,protocol:PROTOCOL,provider:"cloudflare-workers-ai",model,fallbackModel:String(env.WORKERS_AI_FALLBACK_MODEL||DEFAULT_FALLBACK_MODEL),freeAllocation:"10000 neurons/day",reset:"00:00 UTC",aiBindingConfigured:!!env.AI,tokenRequired:required,accessTokenConfigured:required},200,corsHeaders);
    if(url.pathname!=="/v1/ask")return json({ok:false,error:"Not found"},404,corsHeaders);
    if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405,corsHeaders);
    if(!env.AI)return json({ok:false,error:"Workers AI binding AI is not configured"},503,corsHeaders);
    if(required&&!equalSecret(request.headers.get("X-Life-RPG-Token"),env.BRIDGE_ACCESS_TOKEN))return json({ok:false,error:"Unauthorized"},401,corsHeaders);
    const len=Number(request.headers.get("Content-Length")||0);if(len>MAX_BODY_BYTES)return json({ok:false,error:"Request too large"},413,corsHeaders);
    let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid JSON"},400,corsHeaders)}
    if(body?.protocol!==PROTOCOL)return json({ok:false,error:"Protocol mismatch"},400,corsHeaders);
    if(!cleanString(body?.question,6000))return json({ok:false,error:"Question is required"},400,corsHeaders);
    try{
      const result=await handleAsk(body,env);
      return json({ok:true,protocol:PROTOCOL,requestId:cleanString(body.requestId,200),answer:result.answer,model:result.model,provider:"cloudflare-workers-ai",usage:result.usage,createdAt:new Date().toISOString()},200,corsHeaders)
    }catch(e){
      return json({ok:false,error:String(e?.message||"Workers AI error")},Number(e?.status)||500,corsHeaders)
    }
  }
};
