"use client";
import { useCallback, useEffect, useRef, useState } from "react";
const initial = {
  status: "disconnected",
  capabilities: { enabled: false, servers: [], local: false },
  authorized: false,
  snapshot: null,
  quotes: {},
  chart: null,
};
export default function useMt5Connection(symbol, frame) {
  const [data, setData] = useState(initial),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const refresh = useCallback(
    async (signal) => {
      const params = new URLSearchParams();
      if (symbol) params.set("symbol", symbol);
      if (frame) params.set("frame", frame);
      const response = await fetch(`/api/forex/mt5?${params}`, {
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw Error("ระบบรับข้อมูลไม่พร้อม กรุณาลองอีกครั้ง");
      const result = await response.json();
      setData(result);
      setError(null);
      return result;
    },
    [symbol, frame],
  );
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const result = await refresh(controller.signal);
        if (!controller.signal.aborted && result.capabilities.enabled)
          timer = setTimeout(poll, 5000);
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(error.message);
        // Keep last snapshot visible, but never keep its quotes labelled fresh after a failed poll.
        setData((previous) => ({
          ...previous,
          status: previous.snapshot ? "stale" : "error",
          chart: previous.chart ? { ...previous.chart, stale: true } : null,
          quotes: Object.fromEntries(
            Object.entries(previous.quotes).map(([key, value]) => [
              key,
              { ...value, stale: true },
            ]),
          ),
        }));
        timer = setTimeout(poll, 10000);
      }
    };
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh]);
  const action = async (action, server) => {
    if (actionPending.current) return null;
    actionPending.current = true;
    setBusy(true);
    setError(null);
    const post = async (requestedAction, requestedServer) => {
      const response = await fetch("/api/forex/mt5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: requestedAction,
          ...(requestedServer ? { server: requestedServer } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          {
            SIGN_IN_REQUIRED: "กรุณาเข้าสู่ระบบก่อนจับคู่",
            BROKER_NOT_ALLOWED: "Server นี้ยังไม่อยู่ในรายการที่อนุญาต",
            RATE_LIMITED: "สร้างกุญแจบ่อยเกินไป กรุณารอ",
            HTTPS_REQUIRED: "การจับคู่บนเซิร์ฟเวอร์ต้องใช้ HTTPS",
          }[result.error] || "ดำเนินการไม่สำเร็จ",
        );
      return result;
    };
    try {
      // Only the development API can advertise this loopback-only session.
      // Production pairing still requires the existing member authentication.
      if (
        ["pair", "local-file"].includes(action) &&
        !data.authorized &&
        data.capabilities.local
      )
        await post("local-session");
      const result = await post(action, server);
      try {
        await refresh();
      } catch {
        // Pairing returns a one-time key: don't discard it if the status fetch fails.
        setError("ดำเนินการแล้ว แต่โหลดสถานะไม่ได้ กรุณาเก็บกุญแจที่แสดงไว้");
      }
      return result;
    } catch (error) {
      setError(error.message);
      return null;
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  };
  return { ...data, error, busy, action };
}
