"""Read-only Sandbox OHLCV adapter. No trading/account SDK is imported."""
import json
import logging
import math
import os
import re
import sys
import time
import warnings
from datetime import datetime, timezone

warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL")
logging.disable(logging.CRITICAL)  # SDK debug logs may contain signed headers.
DATA_CLIENT = None


def emit(payload):
    print(json.dumps(payload, allow_nan=False), flush=True)


def numeric(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError, OverflowError):
        return None


def epoch(value):
    try:
        if isinstance(value, str) and "T" in value:
            # Python 3.9 doesn't accept Webull's +0000 offset in fromisoformat.
            for pattern in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z"):
                try:
                    return int(datetime.strptime(value, pattern).timestamp())
                except ValueError:
                    pass
            return None
        value = numeric(value)
        return int(value / 1000) if value and value > 1_000_000_000_000 else None
    except (TypeError, ValueError, OverflowError):
        return None


def main(request):
    global DATA_CLIENT
    if os.environ.get("WEBULL_REGION_ID", "us") != "us" or os.environ.get("WEBULL_ENVIRONMENT", "sandbox") != "sandbox":
        emit({"error": "SANDBOX_US_REQUIRED"})
        return
    if not os.environ.get("WEBULL_APP_KEY") or not os.environ.get("WEBULL_APP_SECRET"):
        emit({"error": "NOT_CONFIGURED"})
        return
    symbols = request.get("symbols", [])
    if not isinstance(symbols, list) or not 1 <= len(symbols) <= 5 or len(set(symbols)) != len(symbols) or not all(isinstance(s, str) and re.fullmatch(r"[A-Z][A-Z0-9.-]{0,11}", s) for s in symbols):
        emit({"error": "INVALID_SYMBOLS"})
        return
    from webull.data.common.category import Category
    from webull.data.common.timespan import Timespan
    if DATA_CLIENT is None:
        from webull.core.client import ApiClient
        from webull.core.retry.retry_policy import NO_RETRY_POLICY
        from webull.core.http.initializer.config.config_operation import ConfigOperation
        from webull.data.data_client import DataClient
        client = ApiClient(os.environ["WEBULL_APP_KEY"], os.environ["WEBULL_APP_SECRET"], "us", connect_timeout=5, timeout=12)
        client.add_endpoint("us", "api.sandbox.webull.com")
        client._retry_policy = NO_RETRY_POLICY  # The parent owns pacing and bounded retry.
        client.set_stream_logger(logging.CRITICAL, stream=sys.stderr)
        response = ConfigOperation(client).get_config()
        if response.status_code != 200:
            emit({"error": "AUTH_UNAVAILABLE", "httpStatus": response.status_code})
            return
        if response.json().get("token_check_enabled") is True:
            emit({"error": "MOBILE_APPROVAL_REQUIRED"})
            return
        DATA_CLIENT = DataClient(client)
    data = DATA_CLIENT
    started = time.monotonic()
    response = data.market_data.get_batch_history_bar(symbols, Category.US_STOCK.name, Timespan.M1.name,
        count=1200, trading_sessions=["RTH"])
    if response.status_code != 200:
        emit({"error": "BARS_UNAVAILABLE", "httpStatus": response.status_code})
        return
    payload = response.json()
    groups = payload.get("result", []) if isinstance(payload, dict) else []
    if not isinstance(groups, list):
        emit({"error": "INVALID_RESPONSE"})
        return
    records = []
    now = time.time()
    for symbol in symbols:
        matches = [group for group in groups if isinstance(group, dict) and group.get("symbol") == symbol]
        rows = matches[0].get("result", []) if len(matches) == 1 else []
        if not isinstance(rows, list):
            rows = []
        bars = {}
        conflicts = set()
        rejected = 0
        for row in rows[:1201]:
            if not isinstance(row, dict):
                rejected += 1
                continue
            stamp = epoch(row.get("time"))
            values = [numeric(row.get(key)) for key in ("open", "high", "low", "close", "volume")]
            if not stamp or stamp < 946684800 or stamp % 60 or any(value is None for value in values):
                rejected += 1
                continue
            o, h, l, c, v = values
            if stamp + 60 > now:  # Never export the live, unfinished minute.
                continue
            if min(o, h, l, c) <= 0 or v < 0 or h < max(o, c, l) or l > min(o, c) or row.get("trading_session") not in (None, "RTH"):
                rejected += 1
                continue
            bar = {"time": stamp, "open": o, "high": h, "low": l, "close": c, "volume": v}
            if stamp in bars and bars[stamp] != bar:
                conflicts.add(stamp)
            bars[stamp] = bar
        for stamp in conflicts:
            bars.pop(stamp, None)
        clean = [bars[stamp] for stamp in sorted(bars)][-1200:]
        delay = numeric(matches[0].get("delay_minutes")) if len(matches) == 1 else None
        records.append({"symbol": symbol, "bars": clean, "received": len(rows), "rejected": rejected,
            "delayMinutes": delay if delay is not None and 0 <= delay <= 1440 else None,
            "conflicts": len(conflicts), "status": "available" if clean else "unavailable"})
    emit({"source": "Webull SDK", "environment": "sandbox", "region": "us", "timeframe": "1m",
        "requestedBars": 1200, "receivedAt": datetime.now(timezone.utc).isoformat(),
        "responseMs": round((time.monotonic() - started) * 1000), "records": records})


def failure(exc):
    # Never print raw exceptions, HTTP bodies, or signed request headers.
    status = getattr(exc, "http_status", None)
    code = str(getattr(exc, "error_code", "SDK_FAILURE"))
    emit({"error": "SDK_REQUEST_FAILED", "httpStatus": status if isinstance(status, int) else None,
        "providerCode": code if re.fullmatch(r"[A-Za-z0-9_.-]{1,80}", code) else "SDK_FAILURE"})


if "--worker" in sys.argv:
    # Reuse one SDK client throughout a round. Reinitializing per batch would also
    # repeat configuration/auth requests and exhaust their separate rate limits.
    for line in sys.stdin:
        try:
            main(json.loads(line[:4096]))
        except Exception as exc:
            failure(exc)
else:
    try:
        main(json.loads(sys.stdin.read(4096)))
    except Exception as exc:
        failure(exc)
