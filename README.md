# Life RPG 8.0.4 — reading queue

Life RPG is a local-first personal operating system for finance, work/CRM, table tennis, reading/knowledge and gamification.

## What changed in 8.0.4

- added a real linear reading queue;
- added safe `life-rpg-reading-list-v1` JSON import;
- imported books may have unknown page counts;
- queued books do not count as active reading;
- only a book explicitly started by the user becomes the current book;
- starting a queued book asks for the page count of the user's actual edition when it is unknown;
- duplicate books are skipped by normalized author + title;
- reading-list import creates a local safety snapshot before changing the library;
- existing finance, CRM, tennis and other state are untouched by reading-list import.

## Reading workflow

1. Import a reading-list JSON from `Ещё → Знания → Библиотека и очередь чтения`.
2. The list appears in its original order as `№1`, `№2`, ...
3. Tap `Начать` on the first book.
4. Enter the page count for the edition you are actually reading.
5. Record reading sessions as before.
6. When the current book is completed, start the next queued book.

## Architecture

Runtime modules remain unchanged in structure: `core.js`, `state.js`, `finance.js`, `imports.js`, `work.js`, `tennis.js`, `knowledge.js`, `gamification.js`, `pwa.js`, `ui.js`, `bootstrap.js`.

State schema remains **v16**. No data migration is required.

## Tests

`npm test` runs static, regression, operational, final-audit and reading-list tests.
