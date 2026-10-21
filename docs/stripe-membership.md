# Stripe membership and Nugaom Assistant

## Packages

| Package | THB / month | AI answers / Bangkok day |
| --- | ---: | ---: |
| Starter | 99 | 10 |
| Pro | 299 | 50 |
| Ultimate | 599 | 150 |

`src/billing/plans.mjs` is the single editable entitlement definition: approved amount, AI limit, scan batch limit and feature flags. All three packages initially include `manualDailyScan`, `autoPickFeed`, `aiQuestions`, and `communityPosting`. Daily-scan requests retain the existing maximum of eight symbols; the separate Swing on-demand endpoint retains its six-symbol infrastructure bound. The automatic scanner rotates its market universe independently of AI questions. Market notification polling works while a market page is open; this release does not add an offline push service.

AI quota is reserved atomically on the server before a provider request. A successful answer consumes one question; a confirmed provider failure releases its reservation. Pending requests temporarily reserve one slot. Scans, indicator calculations, billing and signal notifications never call the AI reservation path. The paid daily cap is strict: existing credits are not spent automatically. Existing trial/manual memberships keep their prior credit policy. Quota resets at 00:00 Asia/Bangkok; `/api/assistant` and `/api/account` expose `aiQuota.resetAt`. Upgrading retains today's used count and raises the limit. No one receives an extra reset by changing package.

## Configure Stripe (start in test mode)

1. In Stripe Dashboard, select a dedicated sandbox and create three Products named Starter, Pro and Ultimate.
2. Add one **THB, recurring, every month, fixed per-unit** Price to each product: 99, 299 and 599 baht respectively. These are 9900, 29900 and 59900 in the API's minor units. Do not select yearly or metered pricing. Copy each `price_...` ID, not the product's `prod_...` ID.
3. Set these server environment variables in the private `.env.local` file or the deployment secret manager. Keep existing values in that file intact:

```dotenv
APP_ORIGIN=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=price_replace_with_starter
STRIPE_PRICE_PRO_MONTHLY=price_replace_with_pro
STRIPE_PRICE_ULTIMATE_MONTHLY=price_replace_with_ultimate
STRIPE_PORTAL_CONFIGURATION_ID=
```

Enter the actual secret values privately. Do not commit them, add a `NEXT_PUBLIC_` prefix or send them through chat. `.env.example` contains blank values only. Use a restricted sandbox key (`rk_test_`) with only Customers, Checkout Sessions and Customer Portal write access, plus Products, Prices, Subscriptions and Invoices read access. CLI OAuth authorization is separate from the application API key.

4. For localhost, sign in to the official Stripe CLI yourself and forward the relevant events:

```sh
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,invoice.paid,invoice.payment_failed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed --forward-to http://localhost:3000/api/billing/webhook
```

Use that listener's webhook signing secret in `STRIPE_WEBHOOK_SECRET`. A Dashboard webhook signing secret and a local CLI listener secret are separate. Restart the app after setting environment variables.

5. Enable Stripe Customer Portal. Restrict selectable products/prices to these three packages; enable payment method updates, invoices and cancellation at period end. Configure upgrades/downgrades and proration deliberately. The application waits for a paid invoice matching the new Price before granting an upgrade.
6. Open `/account`, sign in through LINE, choose a package, and complete the test checkout yourself. The account page displays Stripe test mode. After the signed webhook arrives, check the plan name, paid-through date, scanner access and AI limit. Returning to `?billing=success` alone grants no entitlement.
7. Verify first payment, renewal, failure, end-of-period cancellation, immediate cancellation and plan change with Stripe test tools. Confirm that the correct member receives rights and another member does not. No real checkout has been completed during the automated fixture tests.

## Authorization and payment state

The LINE session resolves the internal member ID. Checkout uses that server identity and a server allowlist of Price IDs. A browser cannot supply its own amount, customer, member ID or entitlement. Stripe Customers are bound uniquely to member and test/live mode. Open checkout retries reuse a persistent idempotency key; an existing active, past-due or incomplete Stripe subscription redirects the member toward management rather than creating another subscription.

The webhook verifies the original request bytes with the Stripe SDK and a signed timestamp. It looks up the already bound customer and reads current subscription state from Stripe. An active subscription with a paid invoice line for the configured monthly Price grants rights until that item's paid period end. A subscription update alone does not authorize an unpaid upgrade. Duplicate events are recorded atomically; older events cannot overwrite newer subscription state. Cancellation at period end retains already paid time. Terminal cancellation/paused/unpaid states remove Stripe entitlement. A past-due renewal cannot extend the paid-through date. Existing manual dates and trial records are preserved independently.

Scanner endpoints and the assistant read `membershipFor(currentMember())` on the server. The Radar feed now also checks membership. Free symbol search and charts remain accessible. Daily AI reservations refresh member/Stripe entitlement from storage and use a transactional database quota guard, covering concurrent requests and direct API calls. `AI_QUOTA_EXHAUSTED` returns HTTP 429 with the current quota and reset timestamp. The UI displays that timestamp and an upgrade link.

Run the complete source suite with `npm test`. Its discovery excludes copied applications under build staging directories.

## Deployment and remaining acceptance

- SQLite automatically applies migrations 11 and 12 at startup. D1 deployments must apply both additive migrations before releasing the new worker. They add billing tables and replace the AI quota guard; customer histories and manual membership dates are not rewritten.
- Use the same environment and database for the app and its authenticated APIs. No raw Stripe payment/card details are stored in the application database.
- Node and local D1 fixtures cover billing and quota behavior. Each environment must verify its own Stripe credentials, CLI forwarding, Portal configuration and a genuine test checkout before operational acceptance. Browser drag/touch/keyboard visual acceptance is pending when local browser control is unavailable.
- Before accepting live payments, configure a real HTTPS origin and webhook endpoint, switch all keys/Prices/signing secrets to the same live account/environment, and exercise refund/dispute handling and reconciliation policy. This implementation currently handles subscription/invoice/checkout events; it does not automatically reconcile refunds or disputes. Test and live customer records are separated.
- The admin membership directory, filters, summary and member detail use the same paid entitlement, including the configured test/live mode. Billing records preserve Stripe state without changing manual membership dates. The cloud secret uploader includes Stripe variables for the web worker only.

## Mascot

The assistant is mounted once in the root layout, including `/account`. Its small SVG character uses subtle breathing, blinking and a hand movement. Drag with mouse/touch; use arrow keys while focused to move and Home to reset. A drag does not open chat. Position is saved as a viewport-relative value in local storage and clamped after resize; the chat is positioned within the current viewport. Reduced-motion settings disable the character animation. An illustration and drag position contain no member credentials.

## Official references

- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/events/manage-webhook-endpoints
- https://docs.stripe.com/customer-management

The installed Stripe SDK is 23.0.0, API version `2026-09-30.endive`. Configure the webhook endpoint's API version consistently and revalidate the invoice/subscription fields when upgrading the SDK.

A dedicated Billing Portal configuration can be selected using `STRIPE_PORTAL_CONFIGURATION_ID=bpc_...`. It is passed by the server when opening the portal, keeping Nugaom settings separate from the account default. Checkout labels include a stable eight-letter suffix per persisted attempt so retries remain idempotent. Asynchronous Checkout completion still requires a verified paid subscription invoice before access is granted.

Stripe Tax is not enabled by this setup. Confirm the business tax registration and applicable tax treatment before enabling automatic tax for live subscriptions.
