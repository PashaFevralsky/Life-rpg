# Life RPG 14.0.1 — Audit Hotfix

Applied automatically after the post-14.0.0 full-system audit.

Fixes:
- strict bank statement transaction kinds;
- exact timestamp semantics for verified balance anchors;
- Finance Rebuild refund roundtrip;
- reservation expiry and undo safety;
- unknown debt-rate safety gates;
- Life Ops outdoor training + edit/delete/import invalidation;
- Android system backup disabled;
- Android external CDN OCR disabled (manual/JSON/CSV entry remains);
- Android RC version bumped to 14.0.1.

The earlier suspected AI-import dateKey defect was rechecked and was not a defect: the source uses valid JavaScript object shorthand {dateKey,date}.
