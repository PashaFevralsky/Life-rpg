# Life RPG 14.0.2 — Real-device UI Hotfix

Scope: Android UI only. State schema remains v18.

Observed on 14.0.1 RC:
- final content could sit too close to / beneath fixed bottom navigation;
- top action controls had inconsistent icon geometry.

Changes:
- larger Android bottom content clearance;
- stronger scroll padding and scroll margin;
- 48×48 px top action controls;
- 20×20 px vector icon geometry;
- stronger Android UI E2E checks;
- Android RC target 14.0.2;
- previous 14.0.1 audit regression made forward-compatible.
