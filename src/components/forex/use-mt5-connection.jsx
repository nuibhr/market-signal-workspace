"use client";
import { useEffect, useRef, useState } from "react";
import { createMt5Reader, mt5Json, staleMt5Data } from "./mt5-client.mjs";
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
  const mounted = useRef(false), actionController = useRef(null), reader = useRef(null);
  if (!reader.current) reader.current = createMt5Reader({ onData(result) {
    if (mounted.current) { setData(result); setError(null); }
  } });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; reader.current.invalidate(); actionController.current?.abort(); };
  }, []);
  useEffect(() => {
    reader.current.select(symbol, frame);
    let timer, disposed = false;
    const poll = async () => {
      // A status read started before revoke/pair must not restore the old connection.
      if (actionPending.current) { timer = setTimeout(poll, 1000); return; }
      try {
        const result = await reader.current.refresh();
        if (!disposed && (!result || result.capabilities.enabled))
          timer = setTimeout(poll, 5000);
      } catch (error) {
        if (disposed) return;
        setError(error.name === 'TimeoutError' ? 'โหลดสถานะ MT5 ใช้เวลานานเกินไป กำลังลองใหม่' : error.message);
        // Keep last snapshot visible, but never keep its quotes labelled fresh after a failed poll.
        setData(staleMt5Data);
        timer = setTimeout(poll, 10000);
      }
    };
    poll();
    return () => {
      disposed = true;
      reader.current.invalidate();
      clearTimeout(timer);
    };
  }, [symbol, frame]);
  const action = async (action, server) => {
    if (actionPending.current) return null;
    actionPending.current = true;
    reader.current.invalidate();
    const controller = new AbortController();
    actionController.current = controller;
    setBusy(true);
    setError(null);
    const post = async (requestedAction, requestedServer) => {
      const response = await mt5Json("/api/forex/mt5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: requestedAction,
          ...(requestedServer ? { server: requestedServer } : {}),
        }),
        signal: controller.signal,
      });
      const result = response.data;
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
        await reader.current.refresh();
      } catch {
        // Pairing returns a one-time key: don't discard it if the status fetch fails.
        if (mounted.current) {
          setData(staleMt5Data);
          setError("ดำเนินการแล้ว แต่โหลดสถานะไม่ได้ กรุณาเก็บกุญแจที่แสดงไว้");
        }
      }
      return mounted.current ? result : null;
    } catch (error) {
      if (mounted.current) {
        setData(staleMt5Data);
        setError(error.name === 'TimeoutError' || error instanceof TypeError || error instanceof SyntaxError
          ? 'ยังยืนยันผลไม่ได้ กรุณาตรวจสถานะการเชื่อมต่อก่อนสร้างกุญแจใหม่ การสร้างใหม่จะยกเลิกกุญแจเดิม'
          : error.message);
      }
      return null;
    } finally {
      actionPending.current = false;
      actionController.current = null;
      if (mounted.current) setBusy(false);
    }
  };
  return { ...data, error, busy, action };
}
