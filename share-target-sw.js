"use strict";

/* Life RPG 13.1 — Android/Web Share Target bridge.
   Shared binary payloads stay in a dedicated IndexedDB queue and never enter S. */

const SHARE131_DB="life-rpg-share-13.1";
const SHARE131_DB_VERSION=1;
const SHARE131_STORE="queue";
const SHARE131_MAX_FILES=10;
const SHARE131_MAX_FILE_BYTES=20*1024*1024;
const SHARE131_MAX_TOTAL_BYTES=50*1024*1024;

function share131SwOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(SHARE131_DB,SHARE131_DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(SHARE131_STORE))db.createObjectStore(SHARE131_STORE,{keyPath:"id"})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("share queue unavailable"))
  })
}
function share131SwPut(row){return share131SwOpen().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(SHARE131_STORE,"readwrite");tx.objectStore(SHARE131_STORE).put(row);tx.oncomplete=()=>{db.close();resolve(row)};tx.onerror=()=>{const e=tx.error;db.close();reject(e)}}))}
function share131SwId(){return self.crypto?.randomUUID?.()||`share-${Date.now()}-${Math.random().toString(36).slice(2)}`}
async function share131SwReceive(request){
  const form=await request.formData(),raw=form.getAll("files"),files=[],errors=[];let total=0;
  for(const item of raw.slice(0,SHARE131_MAX_FILES)){
    if(!item||typeof item.arrayBuffer!=="function")continue;
    const size=Math.max(0,+item.size||0),name=String(item.name||"shared-file"),type=String(item.type||"application/octet-stream");
    if(size>SHARE131_MAX_FILE_BYTES){errors.push(`${name}: файл больше 20 МБ`);continue}
    if(total+size>SHARE131_MAX_TOTAL_BYTES){errors.push(`${name}: превышен общий лимит 50 МБ`);continue}
    total+=size;files.push({name,type,size,lastModified:+item.lastModified||Date.now(),blob:item})
  }
  if(raw.length>SHARE131_MAX_FILES)errors.push(`Принято только первые ${SHARE131_MAX_FILES} файлов`);
  const row={id:share131SwId(),receivedAt:new Date().toISOString(),source:"android-share",title:String(form.get("title")||""),text:String(form.get("text")||""),url:String(form.get("url")||""),files,errors,status:"queued",routedAt:""};
  await share131SwPut(row);return row
}
self.addEventListener("fetch",event=>{
  let url;try{url=new URL(event.request.url)}catch{return}
  const isTarget=event.request.method==="POST"&&url.pathname.replace(/\/+$/,"/").endsWith("/share-target/")||event.request.method==="POST"&&url.pathname.endsWith("/share-target");
  if(!isTarget)return;
  event.respondWith((async()=>{
    try{const row=await share131SwReceive(event.request.clone()),target=new URL("./?share=1&id="+encodeURIComponent(row.id),self.registration.scope);return Response.redirect(target.href,303)}
    catch(e){const target=new URL("./?share-error=1",self.registration.scope);return Response.redirect(target.href,303)}
  })())
});
