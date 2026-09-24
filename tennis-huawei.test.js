"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert");
const source=fs.readFileSync(require("path").join(__dirname,"tennis-huawei.js"),"utf8");
const sandbox={
  console,window:{},
  document:{readyState:"loading",addEventListener(){},getElementById(){return null},querySelector(){return null}},
  Number,Math,Date,String,Object,Array,Set,Map,Promise,
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
  validDateKey:s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||"")),
  growthData:()=>({tennisWearables:[]}),
  S:{tennis:[]}
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);vm.runInContext(source,sandbox);

const sample=`HUAWEI WATCH FIT 4 Pro
настольный теннис
23.09.2026, 20:08
1 730 ккал
Расход калорий при нагрузке
1 567 ккал
Длительность
01:39:20
Средний пульс
179 уд/мин
Максимум
196
Экстрим 75 мин
Анаэробный 21 мин
Аэробная 1 мин
Сжигание жира 0 мин
Разминка <1 мин
Стресс от аэробной тренировки
4,7
Стресс от анаэробной тренировки
5,0
Время на восстановление
75 ч
Начало/Конец
151/144`;

const x=JSON.parse(JSON.stringify(sandbox.tennisHuaweiParseText(sample)));
assert.equal(x.dateKey,"2026-09-23");
assert.equal(x.durationSec,5960);
assert.equal(x.totalCalories,1730);assert.equal(x.activeCalories,1567);
assert.equal(x.avgHr,179);assert.equal(x.maxHr,196);
assert.equal(x.extremeMin,75);assert.equal(x.anaerobicMin,21);assert.equal(x.aerobicMin,1);
assert.equal(x.fatBurnMin,0);assert.equal(x.warmupMin,0.5);
assert.equal(x.aerobicEffect,4.7);assert.equal(x.anaerobicEffect,5);
assert.equal(x.recoveryHours,75);assert.equal(x.recoveryStartHr,151);assert.equal(x.recoveryEndHr,144);
assert.equal(sandbox.tennisHuaweiDurationToSec("01:39:20"),5960);
assert.equal(sandbox.tennisHuaweiValidate({...x,avgHr:197,maxHr:196}),"Средний пульс не может быть выше максимального");
assert.equal(sandbox.tennisHuaweiValidate({...x,totalCalories:1000,activeCalories:1200}),"Активные ккал не могут быть выше общих");
assert.ok(source.includes('T.recognize(file,"rus+eng"'),"Huawei OCR language contract missing");
assert.ok(source.includes("tennisWearables"),"Structured wearable store missing");
assert.ok(!/FileReader|readAsDataURL|base64/i.test(source),"Screenshot bytes must not be persisted");
console.log("OK — Life RPG 12.0.2 Huawei tennis regression tests passed");
