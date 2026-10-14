// Client-only preset generation: the plaintext upload key never enters a download URL.
function safeLine(value) {
  if (typeof value !== "string" || !value || /[\x00-\x1f\x7f]/.test(value)) throw Error("ค่าตั้งไม่ถูกต้อง");
  return value;
}
export function connectorEndpoint(origin, local = false) {
  safeLine(origin);
  const url = new URL(origin);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    !(url.protocol === "https:" || (local && url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) throw Error("ต้องใช้ HTTPS สำหรับลูกค้า");
  return `${url.origin}/api/forex/mt5`;
}
export function makePreset({ endpoint, server, token, channel }) {
  safeLine(endpoint); safeLine(server);
  const url = new URL(endpoint);
  if (url.pathname !== "/api/forex/mt5" || connectorEndpoint(url.origin, true) !== endpoint)
    throw Error("Endpoint ไม่ถูกต้อง");
  if (channel ? !/^[a-f0-9]{32}$/.test(channel) : !/^[A-Za-z0-9_-]{43}$/.test(token ?? ""))
    throw Error("กุญแจไม่ถูกต้อง");
  return [`Endpoint=${endpoint}`, `LocalFiles=${Boolean(channel)}`, `LocalChannel=${channel ?? ""}`,
    `BridgeToken=${channel ? "" : token}`, `ExpectedServer=${server}`, "AutoDetectServerTime=true",
    "ServerUtcOffsetMinutes=10000", "PollSeconds=5", ""].join("\r\n");
}
export function utf16Preset(text) {
  const bytes = new Uint8Array(2 + text.length * 2);
  const view = new DataView(bytes.buffer); view.setUint16(0, 0xfeff, true);
  for (let i = 0; i < text.length; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), true);
  return bytes;
}

export function makeRelayConfig(pairing) {
  if (!pairing.endpoint?.startsWith("https://")) throw Error("ตัวส่งไฟล์สำหรับลูกค้าต้องใช้เว็บ HTTPS");
  makePreset({ endpoint: pairing.endpoint, server: pairing.server, token: pairing.token });
  if (!/^[a-f0-9]{32}$/.test(pairing.relay_channel ?? "") || !Number.isFinite(Date.parse(pairing.expires_at)))
    throw Error("ค่าตั้งไม่ถูกต้อง");
  return JSON.stringify({ endpoint: pairing.endpoint, server: pairing.server, token: pairing.token,
    channel: pairing.relay_channel, expires_at: pairing.expires_at }, null, 2);
}
