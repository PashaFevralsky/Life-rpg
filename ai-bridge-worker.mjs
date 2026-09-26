/* Life RPG 13.4.0 — Secure AI Bridge Worker
   Deploy as a server-side module Worker. Never place OPENAI_API_KEY in the PWA or repository. */

const PROTOCOL="life-rpg-secure-ai-bridge-v1";
const DEFAULT_ORIGIN="https://pashafevralsky.github.io";
const DEFAULT_MODEL="gpt-6-luna";
const MAX_BODY_BYTES=18*1024*1024;
const MAX_CONTEXT_CHARS=180000;
const MAX_SHARED_TEXT=30000;
const MAX_ATTACHMENTS=3;
const MAX_ATTACHMENT_DATA_CHARS=12*1024*1024*4/3+2048;

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
function attachmentKind(a){return a?.kind==="image"?"image":"file"}
function cleanAttachments(rows){
  if(!Array.isArray(rows))return [];
  const out=[];
  for(const a of rows.slice(0,MAX_ATTACHMENTS)){
    const dataUrl=String(a?.dataUrl||""),name=cleanString(a?.name||"file",180),mime=cleanString(a?.mime||"application/octet-stream",120);
    if(!/^data:[^;,]+;base64,[A-Za-z0-9+/=\s]+$/.test(dataUrl))throw new Error(`Некорректный attachment: ${name}`);
    if(dataUrl.length>MAX_ATTACHMENT_DATA_CHARS)throw new Error(`Attachment слишком большой: ${name}`);
    out.push({name,mime,kind:attachmentKind(a),dataUrl})
  }
  return out
}
function outputText(data){
  const out=[];
  for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&c.text)out.push(String(c.text));
  return out.join("\n").trim()
}
function instructions(){
  return [
    "Ты — аналитический слой Life RPG. Отвечай по-русски, кратко и предметно.",
    "Персональные факты о пользователе бери только из переданного fact pack и приложений. Не заполняй пробелы выдумками.",
    "Явно разделяй ФАКТЫ, ВЫВОДЫ/ИНТЕРПРЕТАЦИИ и НЕИЗВЕСТНОЕ, когда это влияет на решение.",
    "Если данные конфликтуют, укажи конфликт. Если данных недостаточно — скажи, какой конкретно факт нужен.",
    "Не утверждай, что действие выполнено, и не изменяй Life RPG: backend только формирует ответ.",
    "Для технических заявок сначала извлекай требования, противоречия и недостающие параметры. Не выдумывай артикулы, характеристики, наличие или цены.",
    "Не выдавай модельную уверенность за факт. Ссылайся на названия источников из context.sources, когда это полезно."
  ].join("\n")
}
async function callOpenAI(body,env){
  const attachments=cleanAttachments(body.attachments),content=[];
  for(const a of attachments){
    if(a.kind==="image")content.push({type:"input_image",image_url:a.dataUrl,detail:"auto"});
    else{
      const item={type:"input_file",filename:a.name,file_data:a.dataUrl};
      if(a.mime==="application/pdf"||a.name.toLowerCase().endsWith(".pdf"))item.detail="low";
      content.push(item)
    }
  }
  const contextText=JSON.stringify(body.context||{});
  if(contextText.length>MAX_CONTEXT_CHARS)throw new Error("Fact pack слишком большой");
  const shared=cleanString(body.sharedText,MAX_SHARED_TEXT);
  const prompt=[
    `MODE: ${cleanString(body.mode||"general",40)}`,
    `QUESTION:\n${cleanString(body.question,6000)}`,
    `CONTEXT_HASH: ${cleanString(body.contextHash,100)}`,
    `FACT_PACK:\n${contextText}`,
    shared?`SHARED_TEXT:\n${shared}`:""
  ].filter(Boolean).join("\n\n");
  content.push({type:"input_text",text:prompt});
  const model=String(env.OPENAI_MODEL||DEFAULT_MODEL),effort=String(env.OPENAI_REASONING||"low"),maxOut=Math.max(256,Math.min(8000,Number(env.MAX_OUTPUT_TOKENS)||1600)),webSearch=String(env.ENABLE_WEB_SEARCH||"0")==="1";
  const req={model,instructions:instructions(),input:[{role:"user",content}],reasoning:{effort},max_output_tokens:maxOut,store:false};
  if(webSearch)req.tools=[{type:"web_search"}];
  const clientRequestId=cleanString(body.requestId||crypto.randomUUID(),200);
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json","X-Client-Request-Id":clientRequestId},body:JSON.stringify(req)});
  const providerRequestId=r.headers.get("x-request-id")||"",raw=await r.text();let data={};try{data=JSON.parse(raw)}catch{}
  if(!r.ok)throw Object.assign(new Error(data?.error?.message||`OpenAI HTTP ${r.status}`),{status:502,providerRequestId});
  const answer=outputText(data);if(!answer)throw Object.assign(new Error("OpenAI вернул пустой текст"),{status:502,providerRequestId});
  return {answer,model:data.model||model,providerRequestId,usage:data.usage||null,webSearch}
}

export default {
  async fetch(request,env){
    const origin=request.headers.get("Origin")||"",corsHeaders=cors(origin,env);
    if(!corsHeaders)return json({ok:false,error:"Origin not allowed"},403,{"Cache-Control":"no-store"});
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});
    const url=new URL(request.url);
    if(url.pathname==="/health"&&request.method==="GET")return json({ok:true,protocol:PROTOCOL,model:String(env.OPENAI_MODEL||DEFAULT_MODEL),webSearch:String(env.ENABLE_WEB_SEARCH||"0")==="1",accessTokenConfigured:!!env.BRIDGE_ACCESS_TOKEN,openaiKeyConfigured:!!env.OPENAI_API_KEY},200,corsHeaders);
    if(url.pathname!=="/v1/ask")return json({ok:false,error:"Not found"},404,corsHeaders);
    if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405,corsHeaders);
    if(!env.OPENAI_API_KEY||!env.BRIDGE_ACCESS_TOKEN)return json({ok:false,error:"Worker secrets are not configured"},503,corsHeaders);
    if(!equalSecret(request.headers.get("X-Life-RPG-Token"),env.BRIDGE_ACCESS_TOKEN))return json({ok:false,error:"Unauthorized"},401,corsHeaders);
    const len=Number(request.headers.get("Content-Length")||0);if(len>MAX_BODY_BYTES)return json({ok:false,error:"Request too large"},413,corsHeaders);
    let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid JSON"},400,corsHeaders)}
    if(body?.protocol!==PROTOCOL)return json({ok:false,error:"Protocol mismatch"},400,corsHeaders);
    if(!cleanString(body?.question,6000))return json({ok:false,error:"Question is required"},400,corsHeaders);
    try{
      const result=await callOpenAI(body,env);
      return json({ok:true,protocol:PROTOCOL,requestId:cleanString(body.requestId,200),answer:result.answer,model:result.model,providerRequestId:result.providerRequestId,usage:result.usage,webSearch:result.webSearch,createdAt:new Date().toISOString()},200,corsHeaders)
    }catch(e){
      return json({ok:false,error:String(e?.message||"Bridge error"),providerRequestId:String(e?.providerRequestId||"")},Number(e?.status)||500,corsHeaders)
    }
  }
};
