# Thailand-first audit — 25 October 2026

Phase 0 evidence and proposals for extending the existing platform.
Application baseline: `b2f8cb233f397cf1c0452982d9a0e2d87a15f8d7`.
This documentation package changes no runtime configuration, database, billing, or strategy behavior.

- [System audit, product gaps, roadmap and monetization proposals](audit.md)
- [Architecture, change impact, compatibility, approval and rollback plan](architecture-and-change-plan.md)
- [Offline financial calculator](financial-calculator.html)
- [Financial assumptions and capacity estimates](cost-model.json)
- [Feature inventory](feature-inventory.json)
- [Protected source baseline](baseline.json)
- [Audit verification and outstanding tests](verification.json)
- [Recorded automated regression result](evidence/regression-suite-summary.json)

The proposed tiers, quotas and scan frequencies are not active settings.
Preserve existing business rules, trading strategies, Entry/TP/SL calculations,
strategy versions, signal history, broker integrations, authentication, customer data,
working features and US stock support. Prioritize Thai stocks, DR and Forex through
incremental additions. Review existing behavior, exact change, untouched scope,
backward compatibility, regression coverage and rollback before each implementation;
obtain explicit approval for breaking changes. Prefer feature flags and reversible,
additive migrations.

The 458 passing automated tests are an earlier recorded result, not a new test run.
Final production browser acceptance was blocked when automatic approval review reported
workspace credits exhausted. The 100–5,000 user capacity figures are assumptions;
load benchmarks have not been run. Readiness remains conditional on the audit's gates.

Evidence files are historical snapshots with their original timestamps. Repository copies
exclude credentials, session cookies and raw private account data. Aggregate Bigdata
account credit balances were omitted; the per-request consumption and cost remain.
The raw regression log stays outside the repository; its hash and summary are included.
