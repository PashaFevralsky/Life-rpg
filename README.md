# Life RPG 13.7.5

Local-first Personal OS / PWA designed for mobile use.

- Current release: **13.7.5**
- State schema: **v18**
- Production deploy: `.github/workflows/deploy-pages.yml`
- Storage: IndexedDB with localStorage fallback, snapshots, Recovery Center and Safe Mode
- PWA: Vite + Workbox, offline shell, Android Share Target

## Development checks

```bash
npm ci
npm test
npm run build
node dist-audit.test.js
npx playwright install chromium
npm run test:e2e
```

GitHub Pages runs the same production gate before deployment.

## Repository structure

Runtime/source files and regression tests live in the repository root.
`READING-LIST-27.json` is part of the application runtime.

Generated directories are intentionally not versioned:

- `node_modules/`
- `dist/`
- `test-results/`
- `playwright-report/`

Historical audits, changelogs, release manifests and test reports are stored in `docs/history/`.
Device/setup notes that are still potentially useful are stored in `docs/guides/`.
