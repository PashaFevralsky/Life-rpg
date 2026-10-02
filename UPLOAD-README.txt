LIFE RPG 14.0 — RELEASE HARDENING STAGE 1

Это крупный переход с автоматических Beta-сборок на Android RC.

Загрузить все файлы из архива, сохраняя пути.

Корень репозитория:
- android-release-config.json
- android-toolchain.lock.json
- android-release-prepare.mjs
- android-release-patch.mjs
- android-release-gate.test.js
- release-readiness-14.0.test.js
- android-life-ops-native-entry.js
- android-life-ops-native.vite.mjs
- ANDROID-ACCEPTANCE-14.0.md
- RELEASE-14.0.md
- android-safe-area.css

.github/workflows:
- android-rc.yml — новый workflow
- android-beta.yml — заменить старый; legacy beta станет manual-only

Secrets, keystore, capacitor.config.json, финансовые данные НЕ менять.

После загрузки последнего файла workflow «Build Life RPG Android RC»
запустится автоматически.

Ожидаемый первый APK:
Life-RPG-14.0.0-rc.N.apk

Важно:
- STATE_VERSION остаётся 18.
- Android native Share Target сознательно отключён в RC.
- PWA/GitHub Pages пока остаётся 13.9.1.
- После реальной приёмки RC исходный web/PWA release будет синхронно поднят до 14.0.0 Stable.
