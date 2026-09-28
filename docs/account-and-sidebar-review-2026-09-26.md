# Nugaom AI Pick: account and sidebar review

Reviewed 26 September 2026 against the visible AlphaSigs hamburger and `/account#overview` reference, plus the local workspace. The reference is a navigation and information-hierarchy study; Nugaom uses its own visual identity, product scope, and membership rules.

## What the reference menu does

The three-line menu opens a long independent scroll area. Its top holds identity, an account code, multiple VIP upgrade entrances, an account entrance, and app installation. The middle groups work by intent: market analysis, trading system, markets, store, personal lab, news/economics, community, financial check, and learning. The bottom has notification and sound switches, shortcuts/favorites, contact/help, site theme/language, logout, and version/online status. The separate account page has a compact left subnavigation: overview, renewal, signal channels, EA feed, credits, AI credits, referrals, profile, and logout. Its main overview states trial status, remaining time, an account code, unlocked benefits, and a package CTA.

The useful pattern is **a stable workspace menu plus a separate account center**. Multiple upgrade and account buttons in the reference point to the same destination; reproducing all of them would add noise. The account page is useful because it keeps identity, trial countdown, renewal, and profile outside the scanning workspace.

## Adopted in Nugaom

| Reference element | Nugaom decision |
| --- | --- |
| Grouped hamburger with independent scroll | Keep the existing grouped sidebar and mobile drawer. |
| Account card at top | One entry to `/account`, showing the current server-reported tier. |
| Overview and renewal in account | Implemented as account sections, with the actual trial/paid expiry from server state. |
| Profile | Shows the LINE display name and masked brokerage account. |
| VIP upgrade entrances repeated in the menu | Removed duplicate launcher/card links; renewal has one primary home in the account center. |
| Credits, AI credits, EA feed, signal channels, referral rewards, marketplace | Omitted from account navigation because no ledger, delivery channel, broker bridge, referral accounting, or store exists yet. |
| Sound, notification and theme switches | Kept out of member settings until their underlying preferences persist and their effects work. |

## Member flow and server boundaries

1. LINE authorization code login uses state, nonce and PKCE. The callback verifies the ID token with LINE before creating a random server session. Cookies are HttpOnly and SameSite=Lax.
2. The customer submits broker name and portfolio number. Thai broker names are accepted. The number is normalized, HMAC hashed and discarded; only the hash and last four characters remain. The first submission starts 14 days of trial. The same portfolio hash cannot be attached to two existing member records. If an admin rejects a portfolio, scanning stops immediately; re-submission does not reset the trial clock.
3. An admin whose LINE user ID is configured in `ADMIN_LINE_IDS` compares the full account number with an independently obtained brokerage record. Exact-match verification enables renewal requests and monthly code redemption.
4. A verified customer can request manual renewal. The admin reviews payment outside this app and then approves one calendar month, or creates a random one-use code bound to that specific member. Code redemption is atomic and is recorded in the membership event log.
5. `/api/daily-scan` and `/api/ai-analysis` derive rights from the server session on every request. After trial or subscription expiry they deny the premium operation. Chart and quote endpoints remain public.

## Recheck of existing workspace

| System | Current result | Follow-up |
| --- | --- | --- |
| Symbol search, market tabs, chart interval selection, local watchlist | Kept; these have interaction and state. | Keep source/freshness labels visible. |
| Financial Check | Kept; client-side sizing calculation works with user inputs. | Add fees and lot-size rules per asset before treating numbers as broker-ready. |
| Daily scan rule engine | Server route, allowlist and entitlement gate exist. Current Settrade login may return `AUTH_FAILED` locally. | Repair provider access and confirm display rights before real daily use. |
| Scanner, Multi-TF and Volume Pulse | Existing modules are retained. Scanner opens a membership gate for nonmembers. | Move any future premium computation fully to server. |
| Local AI explanation | Restricted to members; local Ollama endpoint remains unavailable on production host. | Choose a production model/provider and usage budget. |
| Demo signal ledger, result statistics, automated notification, support chat | Still demonstration behavior and labeled `DEMO`; not represented as live service. | Implement an immutable server ledger, deterministic result grading, alert worker and real support inbox. |
| News, calendar and community | Information/placeholder surfaces only. | Connect licensed feeds and moderation before making live claims. |
| Account, 14-day trial, manual renewal and monthly code | Persistent local SQLite implementation. | Configure LINE and persistent production database; choose payment provider if automatic subscription billing is desired. |

## Removed duplicate entrances

The feature card launcher duplicated the same scanner/Multi-TF/volume/news tools already in the sidebar. The old static Guest membership modal duplicated the new account center. The sidebar upgrade card and second membership action duplicated the account card. The top-right profile, notification and contact shortcuts duplicated sidebar actions. The extra favorites item in My Lab duplicated Watchlist. The read-only settings panel was removed from My Lab because it contained no editable settings. The daily scan now shows a status badge and one contextual account link when locked. A second Scanner button in the daily scan footer was removed; the hero ticker now goes to the daily scan instead of an unrelated demo alert panel.

## Verification performed

The production build completed. An isolated temporary SQLite smoke check covered Thai broker text, trial creation, rejection, re-submission without a fresh trial, exact portfolio verification, one-use code redemption and manual renewal approval. On the running local app, a guest received HTTP 403 from the daily scan and admin endpoints, and the account button opened `/account`. The account center was also checked at a 390 px viewport without horizontal overflow. Live LINE login was not exercised because channel settings are absent in this environment.

## Before serving customers

The full LINE callback requires real channel credentials; the account page explains when these are missing. SQLite needs a persistent backed-up volume and should not be used on an ephemeral serverless filesystem. The manual payment path does not charge a customer or check a transfer automatically. Admins must verify brokerage ownership and payment from an authorized external source. Trial rules currently attach one account per stored portfolio hash but do not prove ownership before the trial starts; abuse controls, retention policy, and a durable database migration are required before a public launch. Market-data redistribution permission and upstream authentication must also be resolved.
