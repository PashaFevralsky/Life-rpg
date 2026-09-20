# Life RPG 8.0.3 — final-audit release

Life RPG is a local-first personal operating system for finance, work/CRM, table tennis, reading/knowledge and gamification.

## Architecture

The 8.x runtime is split into classic browser modules and requires no build step:

- `core.js` — utilities and constants
- `state.js` — state normalization, IndexedDB, backups and diagnostics
- `finance.js` — accounts, cash-flow, debts, projections and assets
- `imports.js` — CSV/OCR/statement/ChatGPT import and reconciliation
- `work.js` — work log and CRM
- `tennis.js` — sessions, internal Elo and analytics
- `knowledge.js` — books, reading and knowledge base
- `gamification.js` — quests, XP, achievements and life analytics
- `pwa.js` — updates and notifications
- `ui.js` — rendering, navigation and UX shell
- `bootstrap.js` — startup only

`app.js` remains only a compatibility shim.

## Data

Data remains local in IndexedDB. State schema is still **v16**. Upgrading from 8.0.x does not require a data migration and does not intentionally reset existing data.

## 8.0.3 final audit

This release closes logic and data-integrity defects found after the 8.0.2 UX audit:

- overdue mandatory payments are included in cash-flow, safe-spend and autopilot calculations;
- fixed loans with a stale due date still project the next recurring payment;
- debt edits no longer pretend to be a bank balance verification when only metadata changes;
- payment undo locking is isolated to the same debt;
- import history uses the verification timestamp of the actual account, not one global account timestamp;
- negative calculated account balances are shown instead of silently clamped to zero;
- historical debt imports preserve their real amount and do not consume current reservations;
- weekly work targets set to zero disable the corresponding XP quest;
- encrypted backups use chunked base64 and support large local states;
- AI imports create a safety snapshot before mutations;
- Tesseract.js is pinned to `5.1.1` instead of a floating major tag;
- a new Data Diagnostics card checks the local IndexedDB state for dangerous inconsistencies.

## Tests

`npm test` runs four dependency-free suites:

- static checks
- regression tests
- operational tests
- final-audit boundary tests
