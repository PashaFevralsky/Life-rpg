"use strict";

/* Life RPG 12.0.3 — PWA and notifications • UX cleanup */

async function enableNotifications(){if(!("Notification" in window)){toast("Уведомления не поддерживаются");return}const p=await Notification.requestPermission();$("notificationStatus").textContent=`Разрешение: ${p}`;if(p==="granted"){toast("Уведомления включены");runReminderCheck(true)}}

async function notifyOnce(tag,title,body,force=false){if(!("Notification" in window)||Notification.permission!=="granted")return;const key=`notif:${tag}`,day=localDateKey();if(!force&&localStorage.getItem(key)===day)return;localStorage.setItem(key,day);if(navigator.serviceWorker?.controller)(pwaRegistration||await navigator.serviceWorker.ready).showNotification(title,{body,icon:"./icon-192.png",badge:"./icon-192.png",tag});else new Notification(title,{body,icon:"./icon-192.png",tag})}

function runReminderCheck(force=false){const now=new Date();for(const e of financialEvents().filter(x=>x.type==="payment")){const days=daysBetween(now,e.date);if(e.amount<=0)continue;if(e.overdue)notifyOnce(`overdue-${e.kind}-${e.debtId||e.regularPaymentId||e.label}`,"Проверь обязательный платёж",`${e.label}: не закрыто ${rub(e.amount)}`,force);else if(days>=0&&days<=2)notifyOnce(`due-${e.kind}-${e.debtId||e.regularPaymentId||e.label}-${localDateKey(e.date)}`,"Скоро обязательный платёж",`${e.label}: ${rub(e.amount)}, срок ${fmtDate(e.date)}`,force)}const remain=Math.max(0,S.settings.monthlyDebtGoal-monthPayments()),daysLeft=new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate();if(S.settings.monthlyDebtGoal>0&&remain>0&&daysLeft<=5)notifyOnce(`monthgoal-${localMonthKey()}`,"Финансовый квест месяца",`До цели осталось ${rub(remain)} и ${daysLeft} дн.`,force);for(const d of (S.crmDeals||[]).filter(x=>!["Выиграно","Проиграно"].includes(x.stage)&&x.nextDate)){const days=daysBetween(now,parseLocal(d.nextDate));if(days<0)notifyOnce(`crm-overdue-${d.id}`,"CRM: просрочен следующий шаг",`${d.name}: ${d.nextStep||"следующий шаг не указан"}`,force);else if(days<=1)notifyOnce(`crm-due-${d.id}-${d.nextDate}`,"CRM: следующий шаг",`${d.name}: ${d.nextStep||"проверь сделку"} • ${days===0?"сегодня":"завтра"}`,force)}}

let pwaRegistration=null;

function pwaUpdateMessage(remote=""){
  const suffix=remote?` ${remote}`:"";
  const box=$("versionStatus");
  if(box)box.textContent=`Life RPG ${APP_VERSION} • обновление${suffix} готовится • закрой и снова открой приложение`;
  toast(`Обновление${suffix} будет применено после перезапуска приложения`)
}

async function checkForAppUpdate(){
  try{
    const resp=await fetch(`./core.js?check=${Date.now()}`,{cache:"no-store"});
    if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
    const txt=await resp.text(),m=txt.match(/const\s+APP_VERSION\s*=\s*["\']([^"\']+)["\']/),remote=m?.[1]||"";
    if(pwaRegistration)await pwaRegistration.update();
    if(remote&&remote!==APP_VERSION){pwaUpdateMessage(remote);return}
    if(pwaRegistration?.waiting){pwaUpdateMessage(remote||APP_VERSION);return}
    toast(`Life RPG ${APP_VERSION} — актуальная версия`)
  }catch(e){toast("Не удалось проверить обновление")}
}

function setupPwa(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      // Never reload automatically. A forced reload here can loop while GitHub Pages
      // and Workbox are converging on a new release. The next normal launch uses it.
      const box=$("versionStatus");
      if(box)box.textContent=`Life RPG ${APP_VERSION} • обновление установлено • перезапусти приложение`;
    });
    window.addEventListener("load",async()=>{
      try{
        pwaRegistration=await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});
        const mixed=window.__LIFE_RPG_HTML_VERSION__&&window.__LIFE_RPG_HTML_VERSION__!==APP_VERSION;
        $("versionStatus").textContent=mixed
          ?`Life RPG ${APP_VERSION} • оболочка обновляется • данные v${STATE_VERSION}`
          :`Life RPG ${APP_VERSION} • PWA готова • данные v${STATE_VERSION} • ${window.LifePlatform?.status?.()||"platform fallback"}`;
        if(pwaRegistration.waiting)pwaUpdateMessage();
        // Delayed check avoids competing with initial IndexedDB/UI startup.
        setTimeout(()=>pwaRegistration?.update().catch(()=>{}),30000);
        setInterval(()=>pwaRegistration?.update().catch(()=>{}),21600000)
      }catch(e){$("versionStatus").textContent=`Life RPG ${APP_VERSION} • service worker не запущен`}
    },{once:true})
  }
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installBtn").hidden=false});
  $("installBtn").addEventListener("click",async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("installBtn").hidden=true})
}
