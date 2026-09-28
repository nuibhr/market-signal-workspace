import { completedCandles } from '../analysis/pivots.mjs';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function bangkokParts(value = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { day: `${values.year}-${values.month}-${values.day}`, minutes: Number(values.hour) * 60 + Number(values.minute) };
}

export function thaiSession(now = Date.now()) {
  const { day, minutes } = bangkokParts(now);
  const weekday = new Date(`${day}T12:00:00+07:00`).getUTCDay();
  const businessDay = weekday >= 1 && weekday <= 5;
  return { day, candidateWindow: businessDay && minutes >= 615 && minutes < 675,
    monitorWindow: businessDay && minutes >= 600 && minutes < 1020 };
}

function event(type, bar, price, detail = null) {
  return { type, barTime: bar?.time ?? null, price: finite(price) ? price : null, detail };
}

/** Only later closed bars can change a saved plan. Prices here are indicative, not broker fills. */
export function advancePick(pick, oneHourBars, fifteenMinuteBars, now = Date.now()) {
  const next = { ...pick };
  const events = [];
  const hours = completedCandles(oneHourBars, '1h', now).sort((a, b) => a.time - b.time);
  const quarters = completedCandles(fifteenMinuteBars, '15m', now).sort((a, b) => a.time - b.time);
  const plan = pick.plan;
  if (!plan?.tradeAllowed || !finite(plan.entry) || !finite(plan.stopLoss) || !finite(plan.tp1)) return { pick: next, events };

  if (next.status === 'WAITING_FOR_ENTRY') {
    const { day, minutes } = bangkokParts(now);
    if (day > next.sessionDay || day === next.sessionDay && minutes >= 750) {
      next.status = 'EXPIRED';
      events.push(event('EXPIRED', null, null, 'ไม่เข้าเงื่อนไขก่อนจบภาคเช้า'));
    }
    const publishedMs = Date.parse(next.publishedAt);
    const fresh = next.status === 'WAITING_FOR_ENTRY' ? hours.filter(bar => (bar.time * 1000 + HOUR) > publishedMs
      && bar.time > (plan.referenceCandles?.oneHourTimestamp ?? 0)) : [];
    for (const bar of fresh) {
      const crossed = plan.side === 'LONG' ? bar.close > plan.trigger.price : bar.close < plan.trigger.price;
      if (!crossed) continue;
      if (now - (bar.time * 1000 + HOUR) > 20 * MINUTE) {
        next.status = 'EXPIRED';
        events.push(event('ENTRY_SKIPPED', bar, bar.close, 'พบแท่งยืนยันช้าเกิน 20 นาที ไม่ส่งสัญญาณเข้าเก่าย้อนหลัง'));
        break;
      }
      const risk = Math.abs(plan.entry - plan.stopLoss);
      const actualRisk = Math.abs(bar.close - plan.stopLoss);
      const reward = plan.side === 'LONG' ? plan.tp1 - bar.close : bar.close - plan.tp1;
      if (risk <= 0 || actualRisk <= 0 || reward / actualRisk < 1.8 || Math.abs(bar.close - plan.entry) > risk * 0.2) {
        next.status = 'EXPIRED';
        events.push(event('ENTRY_SKIPPED', bar, bar.close, 'ราคาเลยจุดเข้าหรือ R:R หลังแท่งปิดต่ำกว่าเกณฑ์'));
        break;
      }
      next.status = 'OPEN';
      next.entryPrice = bar.close;
      next.enteredAt = new Date((bar.time * 1000) + HOUR).toISOString();
      next.lastChecked15m = bar.time + 3600 - 900;
      events.push(event('ENTRY', bar, bar.close, 'ราคาอ้างอิงจากแท่ง 1H ที่ปิดแล้ว'));
      break;
    }
  }

  if (next.status === 'OPEN') {
    const enteredMs = Date.parse(next.enteredAt);
    let lastChecked = next.lastChecked15m ?? Math.floor(enteredMs / 1000) - 900;
    const fresh = quarters.filter(bar => bar.time * 1000 >= enteredMs && bar.time > lastChecked);
    for (const bar of fresh) {
      // Missing bars can conceal a target or stop touch. Leave the outcome for review.
      if (bar.time - lastChecked > 1800 && !normalThaiBreak(lastChecked, bar.time)) {
        next.status = 'REVIEW';
        events.push(event('DATA_GAP', bar, null, 'ข้อมูลแท่ง 15m ขาดช่วง ตรวจผลย้อนหลังด้วยมือ'));
        break;
      }
      const target = plan.side === 'LONG' ? bar.high >= plan.tp1 : bar.low <= plan.tp1;
      const stop = plan.side === 'LONG' ? bar.low <= plan.stopLoss : bar.high >= plan.stopLoss;
      if (target && stop) {
        next.status = 'AMBIGUOUS';
        events.push(event('AMBIGUOUS', bar, null, 'แท่งเดียวแตะทั้ง TP1 และ SL ไม่ทราบลำดับ'));
      } else if (target || stop) {
        next.status = target ? 'TARGET' : 'STOP';
        const threshold = target ? plan.tp1 : plan.stopLoss;
        const gapPrice = target
          ? plan.side === 'LONG' && bar.open >= threshold || plan.side === 'SHORT' && bar.open <= threshold
          : plan.side === 'LONG' && bar.open <= threshold || plan.side === 'SHORT' && bar.open >= threshold;
        next.exitPrice = gapPrice ? bar.open : threshold;
        next.exitedAt = new Date((bar.time + 900) * 1000).toISOString();
        events.push(event(target ? 'TARGET' : 'STOP', bar, next.exitPrice, gapPrice ? 'เปิดแท่งเลยระดับ ราคาอ้างอิงจาก open' : 'ราคาอ้างอิงจากระดับแผน'));
      }
      lastChecked = bar.time;
      next.lastChecked15m = lastChecked;
      if (next.status !== 'OPEN') break;
    }
    const { day, minutes } = bangkokParts(now);
    if (next.status === 'OPEN' && (day > next.sessionDay || day === next.sessionDay && minutes >= 1005)) {
      next.status = 'REVIEW';
      events.push(event('SESSION_END', null, null, 'ยังไม่ถึง TP1 หรือ SL เมื่อจบวัน ต้องตรวจสถานะก่อนนับผล'));
    }
  }
  return { pick: next, events };
}

function normalThaiBreak(previous, next) {
  const start = bangkokParts(previous * 1000);
  const end = bangkokParts(next * 1000);
  // Settrade's 15m series resumes at 13:45 for the afternoon pre-open; some
  // symbols may first trade in the 14:00 bar. Both are the ordinary SET break.
  return start.day === end.day && start.minutes === 735 && (end.minutes === 825 || end.minutes === 840);
}
