# Cash-flow fix — 2026-10-05

Problem:
dailyCashFlow() recalculated the same remaining monthly living budget on every future day.
As the number of days left in the month decreased, the model repeatedly spent the same budget,
creating a harmonic overcount and false cash gaps.

Fix:
- added a stateful monthly living-budget allocator;
- each ruble of the remaining living budget can be projected only once;
- dailyCashFlow() and buildFinancialProjection() now use the same allocator;
- fixed daily-spend mode still respects its per-day cap;
- added regression tests for a 50,000 monthly envelope with 7,160 already spent,
  leaving exactly 42,840 to project once.
