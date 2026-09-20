# Life RPG 8.0.2 — modular PWA with operational safety and mobile UX cleanup.

Life RPG is a local-first personal operating system for finance, work/CRM, table tennis, reading/knowledge and gamification.

## Architecture

Version 8.0 replaced the former monolithic `app.js` runtime with classic browser modules that share one global application context and require no build step:

- `core.js` — utilities and constants
- `state.js` — state normalization, IndexedDB, backups
- `finance.js` — accounts, cash-flow, debts, projections, assets
- `imports.js` — CSV/OCR/statement import and reconciliation
- `work.js` — work log and CRM
- `tennis.js` — sessions, internal Elo and tennis analytics
- `knowledge.js` — books, reading and knowledge base
- `gamification.js` — quests, XP, achievements, rewards and life analytics
- `pwa.js` — PWA update flow and notifications
- `ui.js` — rendering, navigation and UX shell
- `bootstrap.js` — startup only

`app.js` is intentionally only a compatibility shim and contains no application logic.

## Data

Data remains local in IndexedDB. State schema remains **v16**, so upgrading from 7.2 does not require another data migration.

## Tests

Run `npm test` if Node.js is available. The test suite has no third-party dependencies.

## 8.0.2 UX cleanup

8.0.2 keeps the 8.0.1 safety fixes and focuses on daily mobile usability.

## UX 8.0.2
- Быстрые действия Работа/Тренировка открывают нужную форму.
- В финансах банковская сверка и импорт вынесены в отдельную вкладку «Банк».
- Рабочая запись, тренировка и настройки используют раскрывающиеся группы вместо стены полей.
- Основные touch-targets на мобильном не меньше 44 px.
