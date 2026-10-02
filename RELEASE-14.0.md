# Life RPG 14.0 — Release Hardening

Цель: перейти от серии Android Beta к контролируемому RC → Stable.

## Что меняется на Stage 1

- Новый Android RC workflow, отдельный от legacy beta.
- Android RC получает versionName `14.0.0-rc.N`.
- versionCode рассчитывается детерминированно и выше линии 13.9.1 beta.
- State schema остаётся v18: миграции пользовательских данных нет.
- Перед Android release выполняются:
  - полный `npm test`;
  - production build;
  - dist audit;
  - Playwright mobile E2E;
  - Android release gate;
  - signed release APK;
  - `apksigner verify`.
- В APK сохраняются native Local Notifications и Android safe-area.
- PWA Service Worker не входит в Android RC; при обновлении старые регистрации/cache удаляются без очистки IndexedDB.
- Незавершённый native Android Share Target исключён из RC. Он не считается функцией 14.0.
- Legacy Beta workflow больше не запускается автоматически.

## Что остаётся до Stable

1. Перезаполнить финансовые данные актуальным импортом.
2. Провести Data Integrity audit и сверку Money Engine/Autopilot.
3. Закрыть полный UI audit на реальном Android.
4. Пройти `ANDROID-ACCEPTANCE-14.0.md`.
5. Собрать минимум один RC и обновить его поверх предыдущей версии.
6. После PASS — перевести release config в stable, синхронно bump исходников web/PWA до 14.0.0 и создать постоянный GitHub Release.

Никакая новая крупная функция до Stable не добавляется.


## Stage 2 — Finance Rebuild

RC получает отдельный Finance Rebuild модуль с форматом `life-rpg-finance-rebuild-v1`.

Применение пакета:
1. preview и валидация;
2. блокировка при критических ошибках;
3. Recovery snapshot;
4. атомарная замена только финансового контура;
5. импорт исторических транзакций относительно verified baseline;
6. Finance Integrity Audit;
7. Money Autopilot используется только после устранения блокеров.

Web/PWA 13.9.1 пока не получает этот модуль.


## Stage 3 — Android UI hardening

В Android RC добавлен финальный UI-слой `android-ui-14.css`, загружаемый после safe-area.
Он не меняет доменную логику и не затрагивает PWA 13.9.1.

Release gate теперь проверяет UI уже на подготовленном Android `dist`:
- 360 / 390 / 412 / 430 px;
- все пять разделов и все их views;
- отсутствие page-level horizontal overflow;
- fixed bottom navigation clearance;
- sticky section chrome;
- deterministic tabs;
- modal geometry на 360x480;
- скрытие глобального FAB там, где он дублирует основные действия.
