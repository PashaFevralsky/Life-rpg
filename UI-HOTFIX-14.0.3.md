# Life RPG 14.0.3 — Semantic Mobile Header Cleanup

Scope: Android UI only. State schema remains v18.

Observed on 14.0.2 RC:
- four top-bar actions crowded the identity block;
- Command Palette and Global Search duplicated search intent;
- the visible plus was installBtn (PWA install), not Quick Add;
- backup already exists under More / Settings.

Changes:
- keep Global Search (#ux128SearchBtn);
- add real Quick Add (#ux7HeaderQuickAddBtn) opening the existing Quick Sheet;
- hide Command Palette button from Android Today header;
- hide PWA install button from Android Today header;
- hide top-bar backup button on Android; backup remains in More / Settings;
- preserve 48×48 controls with 20×20 icons;
- give profile subtitle more horizontal room;
- Android RC target bumped to 14.0.3;
- previous 14.0.2 regression made forward-compatible.
