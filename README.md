# Life RPG 8.0.1

Life RPG is a local-first personal operating system for finance, work/CRM, table tennis, reading/knowledge and gamification.

## Architecture

Version 8.0 introduced the former monolithic `app.js` runtime with classic browser modules that share one global application context and require no build step:

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

## 8.0.1 operational fixes

8.0.1 focuses on safe rollback/backup behavior, exact debt-payment undo, zero-value settings and forecast scenarios, activity-date validation, PWA update checking, and small Today/Work/Tennis/Reading consistency fixes.
