# Life RPG 14.0.4 — audited interface hotfix

Scope: interface and accessibility only. State schema remains v18.

Changes:
- dynamic Search / Recent / other late-created sheets receive dialog semantics on open;
- internal section tabs retain tab semantics, gain aria-controls / tabpanel linkage, roving tabindex and Arrow/Home/End keyboard navigation;
- inactive bottom-navigation text contrast is raised above WCAG AA 4.5:1 against Android nav background;
- Quick Add is reduced to eight entry-oriented actions across the full PWA runtime and Android;
- Training OS no longer injects "ОФП / кардио" into Quick Add; it remains in More / Overview and Life OS routing;
- Share Hub no longer injects "Share Inbox" into Quick Add; it remains in More / Settings and the native/share flows;
- Search stays in the header, Recent moves to More / Overview, Import stays in More / Settings, Inbox remains on Today, and "Can I spend?" remains in Money;
- Android target becomes 14.0.4 RC without state migration.

Acceptance:
- full npm regression;
- production build and dist audit;
- full Playwright E2E;
- Android UI E2E including dynamic dialog semantics, keyboard tabs and Quick Add cardinality;
- Android source gates and release gate on the next RC build.
