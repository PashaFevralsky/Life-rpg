# Life RPG 10.0.0 — All Systems

Life RPG 10.0.0 turns the non-finance sections into deeper operating systems while preserving the stable finance engine and state schema v16.

## What changed

### Reliability Core
- Cross-domain integrity diagnostics for Finance, Work/CRM, Tennis and Knowledge.
- Safe pre-action snapshots before destructive non-finance operations.
- Universal trash/restore for Work logs, Tennis sessions, Reading sessions and CRM deals.
- Safe derived-data repair for reading progress/queue, CRM probability and Tennis Elo.
- Deeper Zod validation for backups, reading-list packages, statement packages and AI actions.
- Full-render smoke test across all five primary sections.
- Mobile Playwright E2E added to GitHub Actions after Vite build and before Pages deploy.

### Work OS
- CRM forecast: factual sales + weighted current-month pipeline.
- Pipeline coverage and gap to monthly plan.
- Sales Decision Engine with overdue, missing-next-step, stale and incomplete-deal priorities.
- CRM timeline/history.
- Contacts/participants field and lost-reason field.
- Won CRM deal can be booked into factual Work sales once.
- Linked CRM realization cannot be duplicated.
- Work entries can be edited.
- Work/CRM destructive operations use snapshots/trash.

### Tennis OS
- Individual matches inside a session.
- Match parser: `Opponent | Rating | W/L | Score | Note`.
- Internal Elo changes only on matches with a known opponent rating.
- Unknown opponent rating no longer assumes equal Elo.
- Official rating stored separately from internal Elo.
- Technical exposure and focus recommendation.
- Sessions can be edited.
- Deletion is restorable and Elo is recalculated chronologically.

### Knowledge OS
- Reading queue remains linear but now supports pause, resume, postpone and archive.
- Queue order can be changed.
- Reading notes support chapter, tags, thesis and application.
- Knowledge review queue and review interval.
- Reading pace and estimated reading-days remaining.
- Reading sessions can be edited.
- Books are archived instead of destructively deleted.
- Orphaned/invalid reading relations are covered by diagnostics.

### Life OS 2
- Daily Engine uses CRM actions, Tennis priority, current book and knowledge review queue.
- Life Systems Score is explainable across Finance, Work, Tennis, Knowledge and System integrity.
- Data-verifiable daily quests are synchronized from factual records instead of relying only on manual checkboxes.
- AI context export now includes Work/CRM, Tennis, Knowledge, Life Systems Score and diagnostics in addition to Finance.

## Compatibility
- APP_VERSION: 10.0.0
- STATE_VERSION: 16
- No IndexedDB migration required.
- Do not re-import the annual bank statement.

## Deployment
GitHub Actions runs tests -> Vite build -> Chromium/Pixel 7 Playwright E2E -> GitHub Pages deploy.

On a phone, upload the root files as usual. Because `.github/workflows/deploy-pages.yml` already exists in the repository, update its contents from the root file `DEPLOY-PAGES-WORKFLOW.yml` so the new E2E step is enabled.
