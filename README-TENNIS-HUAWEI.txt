Life RPG — Tennis Huawei import

Replace these 3 files in the repository root:
- tennis-huawei.js (new)
- bootstrap.js
- vite.config.mjs

No state migration. APP_VERSION remains 12.0.1 and STATE_VERSION remains 18.
The new module stores structured watch data in settings.growthOS.tennisWearables.
Screenshots themselves are not persisted.

Workflow:
1. Tennis → Training.
2. Huawei Health → Import screenshot.
3. Verify OCR fields.
4. Set subjective RPE 1–10.
5. Create a new session + watch data, or attach metrics to an existing session.
