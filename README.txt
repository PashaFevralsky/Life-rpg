Life RPG 12.0.2 — UX Clarity Pass

REPLACE in repository root:
- ui.js
- mobile-layout.css
- layout-all.e2e.test.js

No state migration. No finance/work/tennis business logic changes.
APP_VERSION stays 12.0.2, STATE_VERSION stays 18.

What changes:
- Finance / Work / Tennis / More overview screens show primary cards first.
- Secondary overview cards are collapsed by default under a small "Детали · N" control.
- The detail preference is stored only in localStorage UI preferences.
- Non-overview tabs behave exactly as before.
- Today is intentionally unchanged.
- Mobile layout E2E also verifies the clarity toggle and all 360/390/412/430 px geometry.
