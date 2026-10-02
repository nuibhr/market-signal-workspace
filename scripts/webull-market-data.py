"""Bounded, read-only Webull SDK diagnostic. Credentials come from the parent env."""
import argparse
import json
import logging
import math
import os
import re
import sys
import threading
import time
import uuid
import warnings
from datetime import datetime, timezone
from importlib.metadata import version

# The SDK's default debug logger includes signed request headers. Never enable it.
warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL")
logging.disable(logging.CRITICAL)

HOSTS = {
    ("us", "prod"): ("api.webull.com", "data-api.webull.com"),
    ("us", "sandbox"): ("api.sandbox.webull.com", "data-api.sandbox.webull.com"),
    ("th", "prod"): ("api.webull.co.th", "data-api.webull.co.th"),
    ("th", "sandbox"): ("th-api.uat.webullbroker.com", "data-api.uat.webullbroker.com"),
}


def emit(**fields):
    print(json.dumps(fields, ensure_ascii=False, allow_nan=False), flush=True)


def safe_error(exc):
    code = str(getattr(exc, "error_code", "SDK_FAILURE"))
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,80}", code):
        code = "SDK_FAILURE"
    # No raw exceptions, provider body, account information, headers, or tokens.
    return {"code": code, "httpStatus": getattr(exc, "http_status", None),
            "errorType": type(exc).__name__}


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError, OverflowError):
        return None


def utc(value):
    try:
        if isinstance(value, str) and "T" in value:
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%f%z").isoformat()
        ms = number(value)
        if ms is None or ms < 1_000_000_000_000 or ms > time.time() * 1000 + 60_000:
            return None
        return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        return None


def api_client(region, host):
    from webull.core.client import ApiClient
    client = ApiClient(os.environ["WEBULL_APP_KEY"], os.environ["WEBULL_APP_SECRET"],
                       region, connect_timeout=5, timeout=10)
    client.add_endpoint(region, host)
    client.set_stream_logger(logging.CRITICAL, stream=sys.stderr)
    return client


def check_config(region, environment):
    from webull.core.http.initializer.config.config_operation import ConfigOperation
    host, _ = HOSTS[(region, environment)]
    started = time.monotonic()
    try:
        response = ConfigOperation(api_client(region, host)).get_config()
        config = response.json()
        if response.status_code != 200 or not isinstance(config, dict):
            emit(stage="config", region=region, environment=environment,
                 status="unavailable", httpStatus=response.status_code)
            return False
        required = config.get("token_check_enabled") is True
        emit(stage="config", region=region, environment=environment, httpHost=host,
             status="authenticated", twoFactorRequired=required,
             responseMs=round((time.monotonic() - started) * 1000))
        # A diagnostic must not silently create a five-minute mobile auth prompt.
        if required:
            emit(stage="authorization", status="unavailable", code="MOBILE_APPROVAL_REQUIRED")
            return False
        return True
    except Exception as exc:
        emit(stage="config", region=region, environment=environment, httpHost=host,
             status="unavailable", **safe_error(exc))
        return False


def probe_http(region, environment, symbol):
    from webull.data.data_client import DataClient
    from webull.data.common.category import Category
    from webull.data.common.timespan import Timespan
    host, _ = HOSTS[(region, environment)]
    client = DataClient(api_client(region, host))
    success = True
    for stage in ("snapshot", "bars"):
        started = time.monotonic()
        try:
            if stage == "snapshot":
                response = client.market_data.get_snapshot([symbol], Category.US_STOCK.name)
                payload = response.json()
                row = next((r for r in payload if r.get("symbol") == symbol), None) if isinstance(payload, list) else None
                if not row or not number(row.get("price")) or number(row["price"]) <= 0:
                    emit(stage=stage, symbol=symbol, status="unavailable", code="QUOTE_UNAVAILABLE")
                    success = False
                    continue
                observed = utc(row.get("last_trade_time"))
                age = round(time.time() - datetime.fromisoformat(observed).timestamp()) if observed else None
                emit(stage=stage, symbol=symbol, status="available", httpStatus=response.status_code,
                     price=number(row["price"]), bid=number(row.get("bid")), ask=number(row.get("ask")),
                     observedAt=observed, sourceAgeSeconds=age, environment=environment,
                     signalEligible=False, responseMs=round((time.monotonic() - started) * 1000))
            else:
                # Current SDK uses /bars/list; the old single-symbol /bars/get is retired.
                response = client.market_data.get_batch_history_bar(
                    [symbol], Category.US_STOCK.name, Timespan.M1.name, count=1200)
                payload = response.json()
                groups = payload.get("result", []) if isinstance(payload, dict) else []
                group = next((r for r in groups if r.get("symbol") == symbol), {})
                rows = group.get("result", [])
                closed = {}
                duplicates = set()
                for row in rows:
                    stamp = utc(row.get("time"))
                    values = [number(row.get(k)) for k in ("open", "high", "low", "close", "volume")]
                    if not stamp or any(v is None for v in values):
                        continue
                    opened = datetime.fromisoformat(stamp).timestamp()
                    o, h, l, c, vol = values
                    if opened + 60 > time.time() or min(o, h, l, c) <= 0 or vol < 0 or h < max(o, c, l) or l > min(o, c):
                        continue
                    if stamp in closed:
                        closed.pop(stamp)
                        duplicates.add(stamp)
                    elif stamp not in duplicates:
                        closed[stamp] = c
                stamps = sorted(closed)
                emit(stage=stage, symbol=symbol, status="available" if stamps else "unavailable",
                     httpStatus=response.status_code, requestedBars=1200, receivedBars=len(rows),
                     closedValidBars=len(stamps), timeframe="1m", oldestTime=stamps[0] if stamps else None,
                     latestTime=stamps[-1] if stamps else None, lastClose=closed[stamps[-1]] if stamps else None,
                     environment=environment, signalEligible=False,
                     responseMs=round((time.monotonic() - started) * 1000))
                success = success and bool(stamps)
        except Exception as exc:
            emit(stage=stage, symbol=symbol, status="unavailable", **safe_error(exc))
            success = False
    return success


def probe_stream(region, environment, symbol, seconds):
    from webull.data.data_streaming_client import DataStreamingClient
    from webull.data.common.category import Category
    from webull.data.common.subscribe_type import SubscribeType
    from webull.core.retry.retry_policy import NO_RETRY_POLICY
    http_host, mqtt_host = HOSTS[(region, environment)]
    client = DataStreamingClient(
        os.environ["WEBULL_APP_KEY"], os.environ["WEBULL_APP_SECRET"], region,
        "nugaom_probe_" + uuid.uuid4().hex, http_host=http_host, mqtt_host=mqtt_host,
        retry_policy=NO_RETRY_POLICY, tls_enable=True)
    client.api_client.set_stream_logger(logging.CRITICAL, stream=sys.stderr)
    state = {"connected": False, "subscribed": False, "messages": 0, "pricedMessages": 0}
    topics = set()
    stopped = threading.Event()

    def stop():
        stopped.set()
        client.disconnect()

    def connected(c, api, session):
        state["connected"] = True
        emit(stage="mqtt", status="connected", mqttHost=mqtt_host, tls=True)
        try:
            # QUOTE is bid/ask depth; SNAPSHOT and TICK provide actual last prices.
            c.subscribe([symbol], Category.US_STOCK.name,
                        [SubscribeType.QUOTE.name, SubscribeType.SNAPSHOT.name, SubscribeType.TICK.name])
        except Exception as exc:
            emit(stage="subscribe", status="unavailable", **safe_error(exc))
            c.disconnect()

    def subscribed(*args):
        state["subscribed"] = True
        emit(stage="subscribe", status="accepted", symbol=symbol)

    def message(c, topic, quote):
        # NOTICE, book depth, or connection acceptance alone do not prove price delivery.
        basic = getattr(quote, "basic", None)
        if getattr(basic, "symbol", None) != symbol:
            return
        state["messages"] += 1
        topics.add(topic)
        price = number(getattr(quote, "price", None))
        priced = price is not None and price > 0 and utc(getattr(basic, "timestamp", None)) is not None
        if priced:
            state["pricedMessages"] += 1
        if state["messages"] <= 6:
            emit(stage="message", topic=topic, symbol=symbol, price=price,
                 observedAt=utc(getattr(basic, "timestamp", None)), environment=environment,
                 signalEligible=False)
        if state["pricedMessages"] >= 3:
            stop()

    client.on_connect_success = connected
    client.on_subscribe_success = subscribed
    client.on_quotes_message = message
    deadline = threading.Timer(seconds, stop)
    deadline.daemon = True
    deadline.start()
    try:
        client.connect_and_loop_forever(logger_enable=False)
    except Exception as exc:
        # SDK can return MQTT_ERR_CONN_LOST when disconnecting inside its callback.
        if not stopped.is_set():
            emit(stage="mqtt", status="unavailable", **safe_error(exc))
    finally:
        deadline.cancel()
        client.disconnect()
    emit(stage="stream-summary", status="available" if state["pricedMessages"] else "unconfirmed",
         symbol=symbol, region=region, environment=environment, topics=sorted(topics),
         durationLimitSeconds=seconds, signalEligible=False, **state)
    return state["pricedMessages"] > 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["probe", "stream", "matrix"])
    parser.add_argument("--region", choices=["us", "th"], default=os.environ.get("WEBULL_REGION_ID", "us"))
    parser.add_argument("--environment", choices=["prod", "sandbox"], default=os.environ.get("WEBULL_ENVIRONMENT", "sandbox"))
    parser.add_argument("--symbol", default="AAPL")
    parser.add_argument("--seconds", type=int, default=30)
    args = parser.parse_args()
    if not all(os.environ.get(k, "").strip() for k in ("WEBULL_APP_KEY", "WEBULL_APP_SECRET")):
        emit(status="unavailable", code="SOURCE_NOT_CONFIGURED")
        return 1
    if not re.fullmatch(r"[A-Z][A-Z0-9.-]{0,11}", args.symbol) or not 5 <= args.seconds <= 60:
        emit(status="unavailable", code="INVALID_ARGUMENT")
        return 1
    emit(stage="sdk", version=version("webull-openapi-python-sdk"), readOnly=True)
    if args.mode == "matrix":
        successes = [check_config(region, env) for region, env in HOSTS]
        return 0 if any(successes) else 1
    if not check_config(args.region, args.environment):
        return 1
    if args.mode == "stream":
        return 0 if probe_stream(args.region, args.environment, args.symbol, args.seconds) else 1
    return 0 if probe_http(args.region, args.environment, args.symbol) else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        emit(status="stopped")
        sys.exit(130)
    except Exception as exc:
        emit(status="unavailable", **safe_error(exc))
        sys.exit(1)
