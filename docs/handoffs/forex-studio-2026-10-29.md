# Forex Studio handoff — 29 October 2026

## Purpose and status

This is a local educational prototype for planning an XAU/USD example on a
chart, inspired by the owner's livestream/member workflow. It is not ready for
release, a live trading tool, or a member-to-member plan sharing system.

The owner has confirmed that there is no official staging environment/domain
and no approved evidence repository for market-data display rights. Both are
**Pending**. No real market data may be published until rights verification and
release approval are complete. Push to the existing Git branch was explicitly
requested; this does not itself authorize deploying or opening the gates.

Previous release and Trial decisions remain in
[`release-preparation-2026-10-28.md`](release-preparation-2026-10-28.md) and
[`deploy/staging/README.md`](../../deploy/staging/README.md). Trial enrollment
defaults off; the owner reported no existing Trial users.

## What changed

- `/forex` starts on Forex Live Studio; the existing scanner, chart and alerts
  tabs remain available. The old Pro Copy EA view is no longer mounted because
  it displays hard-coded performance, unsupported claims and fallback plans.
  Its source still exists; do not re-enable it without fixing those problems
  and the fallback signal-dispatch path.
- The Studio uses the existing TradingView Lightweight Charts dependency with
  generated XAU/USD bars, replay stepping and Entry/SL/TP price lines. Chart
  attribution is shown. Bars are synthetic, not historical or live prices.
- The form checks BUY/SELL ordering, positive values and risk percentage, then
  calculates risk amount, theoretical lots and reward/risk from user-entered
  USD balance and XAU/USD contract size. It excludes spread, fees, slippage,
  broker lot increments and other execution constraints; it is not a trade
  recommendation or an order.
- Users can save up to 20 plans to browser localStorage. They are not encrypted,
  not tied to a LINE identity, not synced, and may be visible to anyone using
  the same browser. They can be lost when browser data is cleared. The UI labels
  this scope. No plan is transmitted or shared with another account.
- A CSS character animates in the prototype and respects reduced-motion; it is
  decorative and not connected to an actual AI process.

## Verification

- `node --test src/components/forex/forex.test.mjs src/components/forex/studio-plan.test.mjs`:
  11 passed on 29 October. The tests cover BUY/SELL math and invalid inputs,
  chart line data, and existing Forex contracts; they do not validate clicks,
  visual presentation, replay controls or browser persistence.
- `npm run build`: passed after the current Studio changes.
- Isolated local fixture server `/forex`: HTTP 200, server-rendered form, demo
  label and local-save notice present; old hard-coded 68.4% absent in the
  initial response. This does not verify client interaction.
- Browser automation reported local browser use disabled in Work settings.
  Visual, mobile, keyboard and interactive QA remain pending. No live broker,
  provider, payment, LINE OAuth, production data or production deployment was
  tested. No database or provider configuration was changed.

## Next work

1. Validate the prototype in a permitted browser: chart resize and price lines,
   replay, invalid values, save/reload/delete, storage denial, keyboard,
   reduced motion and mobile layouts.
2. Design authenticated owner authoring and member-only viewing on the server:
   explicit publish/unpublish, version/time/source labels, entitlement checks,
   no-store responses, CSRF protection, isolated test accounts and audit logs.
   Local storage is not a sharing mechanism. Keep synthetic fixtures separate
   from actual prices and plans, and do not publish real data while gates remain
   open.
3. Add independently verified market-data sources only after the pending rights
   and staging gates close. Review provider freshness and permitted audiences.
4. Evaluate open-source CandleKit and Pixel Agents separately for functionality,
   maintenance, security and code/asset licensing. Neither is installed or
   incorporated in this change; the existing chart library is already used.
5. Run release readiness checks on the clean, exact release commit and complete
   approved staging, recovery and rollback validation before any deployment.
