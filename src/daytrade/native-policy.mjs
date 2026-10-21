// Thai/DR 15m signals are paused while the delayed-feed experiment is reviewed.
// Keep collecting candles and following existing positions; never erase history.
export function nativeDaytradePolicy(market) {
  const paused=['thai','dr'].includes(market);
  return {status:paused?'research-paused':'active',allowNewSignals:!paused,
    reason:paused?'DELAYED_FEED_UNVALIDATED':null,
    message:paused?'พักเปิด Daytrade ใหม่: ฟีดหน่วงและผลทดสอบยังไม่ผ่าน · ติดตามไม้เดิมและเก็บประวัติครบ':''};
}
