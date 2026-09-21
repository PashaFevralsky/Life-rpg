"use strict";

/* Life RPG 10.0.0 — zero-dependency fallback platform layer */
(function(){
  const svg=(body)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const fallbackIcons={
    house:svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>'),
    wallet:svg('<path d="M4 7.5h14a2 2 0 0 1 2 2V19H6a2 2 0 0 1-2-2V7.5Z"/><path d="M4 7.5V6a2 2 0 0 1 2-2h11"/><path d="M15.5 12h4.5v4h-4.5a2 2 0 0 1 0-4Z"/>'),
    briefcase:svg('<path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 12h18"/>'),
    trophy:svg('<path d="M8 4h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v5M8 20h8M9 17h6"/>'),
    ellipsis:svg('<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>'),
    plus:svg('<path d="M12 5v14M5 12h14"/>'), minus:svg('<path d="M5 12h14"/>'),
    'credit-card':svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M7 15h4"/>'),
    landmark:svg('<path d="M4 9h16M6 9v8M10 9v8M14 9v8M18 9v8M3 19h18M12 4 3 8h18z"/>'),
    'book-open':svg('<path d="M4 5.5c3.1-.7 5.8-.1 8 1.7v12c-2.2-1.8-4.9-2.4-8-1.7zM20 5.5c-3.1-.7-5.8-.1-8 1.7v12c2.2-1.8 4.9-2.4 8-1.7z"/>'),
    search:svg('<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>'),
    activity:svg('<path d="M3 12h4l2-6 4 12 2-6h6"/>')
  };
  const knownStateKeys=new Set(['version','profile','settings','debts','accounts','books','expenses','incomeLogs','payments','workLogs','tennis','readingLogs','crmDeals']);
  const validateBackup=value=>{if(!value||typeof value!=="object"||Array.isArray(value))return {ok:false,error:"Резервная копия должна быть JSON-объектом"};if(!Object.keys(value).some(k=>knownStateKeys.has(k)))return {ok:false,error:"Файл не похож на резервную копию Life RPG"};return {ok:true,data:value}};
  const validateReadingList=value=>{if(!value||typeof value!=="object"||value.format!=="life-rpg-reading-list-v1"||!Array.isArray(value.books))return {ok:false,error:"Неверный формат списка чтения"};if(!value.books.every(x=>x&&typeof x.title==="string"&&x.title.trim()))return {ok:false,error:"В списке есть книга без названия"};return {ok:true,data:value}};
  const validateAiPackage=value=>{const statement=value?.format==="life-rpg-statement-import-v1"&&Array.isArray(value.transactions);const ai=value?.format==="life-rpg-ai-import-v1"&&Array.isArray(value.actions);return statement||ai?{ok:true,data:value}:{ok:false,error:"Неверный формат импортного пакета"}};
  function refreshIcons(root=document){for(const el of root.querySelectorAll?.('[data-lucide]')||[]){if(el.dataset.iconReady)return;const icon=fallbackIcons[el.dataset.lucide]||fallbackIcons.activity;el.innerHTML=icon;el.dataset.iconReady='fallback'}}
  window.LifePlatform={mode:'fallback',zod:false,lucide:false,workbox:false,validateBackup,validateReadingList,validateAiPackage,refreshIcons,icon:(name)=>fallbackIcons[name]||fallbackIcons.activity,status:()=>`Fallback`};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refreshIcons());else refreshIcons();
})();
