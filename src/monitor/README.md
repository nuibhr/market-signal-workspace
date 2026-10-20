# Alerts and recorded outcomes

Daytrade alerts are projections of committed `daytrade_forward` records. Entry,
exit, review and expiry retain the same `tradeId`. Swing alerts retain the
immutable event's `signalId` and cost-profile access rules. The “ดูไม้ / สถิติ”
action resolves that ID through the existing authorized feed, including records
older than the visible history limit. It never matches a trade just by symbol
or price, and never resolves a replay result as a forward trade.

The record dialog uses the same statistics functions as the existing journals:
Daytrade's full market/scope summary, or Swing's matching strategy/rule/cost
profile. A closed record counts once, regardless of the number of alerts.
Pending, open, partial runner, expired and REVIEW records do not contribute to
closed-trade win rate. Missing historical review timestamps are not invented.
Muting, delivery failure, refresh and news events never change these records.

Sound defaults to enabled on a new device. Explicit mute is stored locally and
shared across tabs. Browser speech permission is still enforced; the first
trusted interaction resumes the shared adapter. A blocked/failed delivery is
shown truthfully and can be retried with the sound control. Existing events on
first subscription form a silent baseline; new events are deduplicated through
the durable inbox. Speech and toasts run while a market page is open.

## News

`/api/news?alerts=1` uses public RSS headline feeds from
[InfoQuest](https://www.infoquest.co.th/feed) and
[CNBC](https://www.cnbc.com/id/100003114/device/rss/rss.html) when no usable paid
MarketDX configuration exists. These fixed sources are fetched without customer
identifiers or API credentials. The server coalesces visitors behind a shared
60-second cache, bounds XML response size, rejects entity declarations, and
returns only headline, publisher, publication time and original source link.
Articles' full text is never returned. A failed feed is shown as unavailable.

Fresh newly received RSS headlines (under 30 minutes old) produce news alerts.
A Breaking News label requires an explicit prefix in the publisher's headline;
other RSS items are labelled new market news, with no invented impact score.
First subscription is a silent baseline; repeat URLs/provider job IDs/tracking
parameters are deduplicated. Old/future/undated/stale stories are ineligible for
automatic speech. News has its own public inbox and never affects trade stats.
RSS publication and polling can be delayed, and do not guarantee every story.

With `MARKETDX_API_KEY` and confirmed production display rights, the alert feed
uses the existing MarketDX integration (up to 30 recent articles/country,
60-second cache). Its source breaking flags or impact score 4–5 qualify alerts.
The normal news panel retains its existing MarketDX-only four-article,
15-minute cache and production rights gate.
