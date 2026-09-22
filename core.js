"use strict";

/* Life RPG 11.0.0 — Core utilities and constants */

const APP_VERSION="11.0.0";

const STATE_VERSION=18;

const DB_NAME="life-rpg-db";

const DB_VERSION=7;

const START_DEBT=0;

const XP_PER_LEVEL=1000;

const $=id=>document.getElementById(id);

function localDateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}

function localMonthKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}

function isoWeekKey(d=new Date()){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));const w=Math.ceil((((x-y0)/86400000)+1)/7);return `${x.getUTCFullYear()}-W${String(w).padStart(2,"0")}`}

function parseLocal(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12)}

function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}

function daysBetween(a,b){return Math.floor((new Date(b.getFullYear(),b.getMonth(),b.getDate())-new Date(a.getFullYear(),a.getMonth(),a.getDate()))/86400000)}

function rub(n){return Math.round(Number(n)||0).toLocaleString("ru-RU")+" ₽"}

function compactRub(n){return new Intl.NumberFormat("ru-RU",{notation:"compact",maximumFractionDigits:1}).format(Number(n)||0)+" ₽"}

function pct(n,d=0){return `${(Number(n)||0).toFixed(d)}%`}

function clamp(n,a,b){return Math.max(a,Math.min(b,n))}

function uid(){return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`}

function escapeHtml(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

function fmtDate(s){const d=typeof s==="string"?parseLocal(s):s;return d.toLocaleDateString("ru-RU",{day:"2-digit",month:"short"})}

function monthDiff(a,b){return (b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth()}

function deepClone(x){return structuredClone(x)}

function daysInMonth(d=new Date()){return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}

function weekBounds(){const d=new Date(),day=(d.getDay()+6)%7,start=addDays(d,-day),end=addDays(start,6);return [localDateKey(start),localDateKey(end)]}

function inRange(dateKey,a,b){return dateKey>=a&&dateKey<=b}

function lastNDaysRange(n){const b=new Date(),a=addDays(b,-(n-1));return [localDateKey(a),localDateKey(b)]}

function validDateKey(s){return /^\d{4}-\d{2}-\d{2}$/.test(String(s||""))}

function validActivityDate(s){return validDateKey(s)&&s<=localDateKey()}

function finiteNumberOr(v,fallback=0){if(v==null||String(v).trim()==="")return fallback;const n=Number(v);return Number.isFinite(n)?n:fallback}

function moneyCents(v){const n=finiteNumberOr(v,0);if(!Number.isFinite(n))return 0;return Math.round((n+(n>=0?Number.EPSILON:-Number.EPSILON))*100)}

function moneyFromCents(c){const n=Number(c);return Number.isFinite(n)?Math.round(n)/100:0}

function moneySum(values){return moneyFromCents((values||[]).reduce((sum,v)=>sum+moneyCents(v),0))}

function moneyAdd(...values){return moneySum(values)}

function moneySub(first,...rest){return moneyFromCents(moneyCents(first)-rest.reduce((sum,v)=>sum+moneyCents(v),0))}

function bytesToBase64(bytes){bytes=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||0);let out="",chunk=32768;for(let i=0;i<bytes.length;i+=chunk)out+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(out)}

function base64ToBytes(s){return Uint8Array.from(atob(String(s||"")),c=>c.charCodeAt(0))}

function addMonthsDate(d,n){const x=new Date(d);const day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+n);x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()));return x}
