import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSignalSpeaker,
  formatForThaiSpeech,
  speakableThaiTicker,
  buildStockSupportResistanceSpeech,
  buildMorningBriefSpeech,
  buildEveningHomeworkSpeech,
  buildDrMorningBriefSpeech,
  buildDrEveningHomeworkSpeech,
  buildDrSupportResistanceSpeech,
  isEveningHomeworkUnlocked,
} from './speech.mjs';

function fixture() {
  const spoken = [], states = [];
  const browser = { SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: { cancel() {}, getVoices: () => [{ lang: 'en-US' }, { lang: 'th-TH', name: 'Thai test voice' }], speak: item => spoken.push(item) } };
  return { browser, spoken, states, speaker: createSignalSpeaker(browser, state => states.push(state)) };
}
test('speech adapter uses Thai voice and tracks the native start/end callbacks', () => {
  const { speaker, spoken, states } = fixture();
  assert.equal(speaker.play('พีทีที เข้าเงื่อนไขแล้ว'), true);
  assert.equal(spoken[0].voice.lang, 'th-TH');
  assert.equal(speaker.pending, true);
  spoken[0].onstart(); spoken[0].onend();
  assert.deepEqual(states, ['starting', 'speaking', 'idle']);
  assert.equal(speaker.pending, false);
});
test('browser permission denial is visible and a direct retry can recover', () => {
  const { speaker, spoken, states } = fixture();
  speaker.play('เข้าเงื่อนไขแล้ว'); spoken[0].onerror({ error: 'not-allowed' });
  assert.equal(states.at(-1), 'blocked');
  speaker.play('เข้าเงื่อนไขแล้ว'); spoken[1].onstart();
  assert.equal(states.at(-1), 'speaking');
});
test('late callbacks from cancelled speech do not overwrite the next announcement', () => {
  const { speaker, spoken, states } = fixture();
  speaker.play('รายการแรก'); speaker.play('รายการถัดไป');
  spoken[1].onstart(); spoken[0].onerror({ error: 'interrupted' }); spoken[0].onend();
  assert.equal(states.at(-1), 'speaking');
  speaker.stop(); spoken[1].onerror({ error: 'canceled' });
  assert.equal(states.at(-1), 'idle');
});
test('unavailable or failing speech never claims successful playback', () => {
  const states = [], unsupported = createSignalSpeaker({}, state => states.push(state));
  assert.equal(unsupported.play('ทดสอบ'), false);
  assert.equal(states.at(-1), 'unsupported');
  const { browser, states: failures, speaker } = fixture();
  browser.speechSynthesis.speak = () => { throw new Error('device unavailable'); };
  assert.equal(speaker.play('ทดสอบ'), false);
  assert.equal(failures.at(-1), 'failed');
});
test('formatForThaiSpeech cleans news tags, tickers and converts market abbreviations to spoken Thai', () => {
  const input = '[มีคลิป] สัญญาณ DELTA.BK ฝั่ง SHORT TP1 2R EMA20/50 กำไร 3.5% | ข่าวหุ้นธุรกิจออนไลน์';
  const output = formatForThaiSpeech(input);
  assert.ok(!output.includes('[มีคลิป]'));
  assert.ok(!output.includes('| ข่าวหุ้นธุรกิจออนไลน์'));
  assert.ok(output.includes('ชอร์ต'));
  assert.ok(output.includes('ทีพี หนึ่ง'));
  assert.ok(output.includes('สองอาร์'));
  assert.ok(output.includes('อีเอ็มเอ 20 และ 50'));
  assert.ok(output.includes('เปอร์เซ็นต์'));
});
test('Audio-enabled browser uses audio stream and falls back to speech synthesis on error', () => {
  const audioInstances = [];
  class MockAudio {
    constructor(src) {
      this.src = src;
      this.onplay = null;
      this.onended = null;
      this.onerror = null;
      audioInstances.push(this);
    }
    play() {
      return Promise.resolve();
    }
    pause() {}
  }
  const spoken = [], states = [];
  const browser = {
    Audio: MockAudio,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: { cancel() {}, getVoices: () => [{ lang: 'th-TH' }], speak: item => spoken.push(item) },
  };
  const speaker = createSignalSpeaker(browser, state => states.push(state));
  assert.equal(speaker.play('ทดสอบเสียงนิวรัล'), true);
  assert.equal(audioInstances.length, 1);
  assert.ok(audioInstances[0].src.includes('/api/tts?text='));
  audioInstances[0].onplay();
  assert.equal(states.at(-1), 'speaking');
  audioInstances[0].onended();
  assert.equal(states.at(-1), 'idle');

  // Test fallback on audio error
  assert.equal(speaker.play('ทดสอบเสียงล้มเหลว'), true);
  assert.equal(audioInstances.length, 2);
  audioInstances[1].onerror(new Error('Network error'));
  assert.equal(spoken.length, 1);

  // Test mobile unlock reuses persistent Audio element
  speaker.unlock();
  assert.equal(audioInstances.length, 3);
  assert.equal(speaker.play('แจ้งเตือนบนมือถือ'), true);
  assert.equal(audioInstances.length, 3);
  assert.ok(audioInstances[2].src.includes('/api/tts?text='));
});

test('Thai retail 3 core questions speech builders generate clear Thai voice scripts', () => {
  assert.equal(speakableThaiTicker('CPALL'), 'ซีพีออลล์');
  assert.equal(speakableThaiTicker('PTT.BK'), 'พีทีที');
  assert.equal(speakableThaiTicker('NVDA80'), 'เอ็นวีดีเอ ดีอาร์');

  const sampleRows = [
    { symbol: 'CPALL', price: 62.5, stage: 2, templatePass: true, volumeBreakout: true, pullback: false, score: 8, status: 'available', plan: { entry: 61.5, stopLoss: 59.0, minimumTarget: 66.5, stopPercent: 4.0 } },
    { symbol: 'ADVANC', price: 285.0, stage: 2, templatePass: true, volumeBreakout: false, pullback: true, score: 7, status: 'available', plan: { entry: 280.0, stopLoss: 270.0, minimumTarget: 300.0, stopPercent: 3.5 } },
    { symbol: 'GULF', price: 58.25, stage: 2, templatePass: false, volumeBreakout: true, pullback: false, score: 6, status: 'available', plan: { entry: 57.5, stopLoss: 55.0, minimumTarget: 62.5, stopPercent: 4.3 } },
  ];

  const srSpeech = buildStockSupportResistanceSpeech(sampleRows[0]);
  assert.ok(srSpeech.includes('ซีพีออลล์'));
  assert.ok(srSpeech.includes('แนวรับ'));
  assert.ok(srSpeech.includes('แนวต้าน'));
  assert.ok(srSpeech.includes('จุดคัทลอส'));

  const morningSpeech = buildMorningBriefSpeech(sampleRows, 'ตลาดเอื้อ');
  assert.ok(morningSpeech.includes('โพยหุ้นเด่นเช้านี้เล่นอะไรดี'));
  assert.ok(morningSpeech.includes('ซีพีออลล์'));

  // Evening homework time gate test (during market open vs unlocked)
  const lockedTime = new Date('2026-11-12T10:30:00+07:00');
  const unlockedTime = new Date('2026-11-12T18:00:00+07:00');
  assert.equal(isEveningHomeworkUnlocked(lockedTime).unlocked, false);
  assert.equal(isEveningHomeworkUnlocked(unlockedTime).unlocked, true);

  const lockedSpeech = buildEveningHomeworkSpeech(sampleRows, 'ตลาดเอื้อ', { now: lockedTime });
  assert.ok(lockedSpeech.includes('ตลาดกำลังเปิดทำการ'));
  assert.ok(lockedSpeech.includes('17:30'));

  const eveningSpeech = buildEveningHomeworkSpeech(sampleRows, 'ตลาดเอื้อ', { now: unlockedTime, morningPicks: [sampleRows[0]] });
  assert.ok(eveningSpeech.includes('การบ้านหุ้นเย็นนี้เตรียมเฝ้าพรุ่งนี้'));
  assert.ok(!eveningSpeech.includes('ซีพีออลล์')); // Verified: de-duplicated against morning pick!
  assert.ok(eveningSpeech.includes('สายต้นน้ำขาขึ้น') || eveningSpeech.includes('สายย่อรับแนวรับ') || eveningSpeech.includes('สายวอลุ่มเข้าจ่อเบรก'));

  const drSample = [
    { symbol: 'NVDA80', thbPrice: 24.5, fairThb: 24.4, support: 23.8, target1: 26.2, target2: 27.6, stop: 22.9 },
    { symbol: 'AAPL80', thbPrice: 18.2, fairThb: 18.1, support: 17.6, target1: 19.4, target2: 20.5, stop: 17.0 },
    { symbol: 'MSFT80', thbPrice: 15.0, fairThb: 14.9, support: 14.5, target1: 16.0, target2: 17.0, stop: 14.0 },
    { symbol: 'GOOG80', thbPrice: 19.0, fairThb: 18.9, support: 18.2, target1: 20.5, target2: 21.8, stop: 17.5 },
  ];
  assert.ok(buildDrMorningBriefSpeech(drSample).includes('รอบเก้าโมงครึ่ง'));
  const drLockedSpeech = buildDrEveningHomeworkSpeech(drSample, { now: lockedTime });
  assert.ok(drLockedSpeech.includes('17:30'));

  const drEveningSpeech = buildDrEveningHomeworkSpeech(drSample, { now: unlockedTime, drMorningPicks: [drSample[0]] });
  assert.ok(drEveningSpeech.includes('รอบห้าโมงครึ่ง'));
  assert.ok(buildDrSupportResistanceSpeech(drSample[0]).includes('เอ็นวีดีเอ ดีอาร์'));
});

test('window singleton lock stops previous speaker when another menu starts speaking', () => {
  const paused = [];
  class MockAudio {
    constructor(src) {
      this.src = src;
    }
    play() {
      return Promise.resolve();
    }
    pause() {
      paused.push(this.src);
    }
  }
  const sharedBrowser = { Audio: MockAudio };
  const statesA = [];
  const statesB = [];
  const speakerA = createSignalSpeaker(sharedBrowser, s => statesA.push(s));
  const speakerB = createSignalSpeaker(sharedBrowser, s => statesB.push(s));

  speakerA.play('เมนูหุ้นไทยกำลังพูด');
  assert.equal(sharedBrowser.__activeSignalSpeaker, speakerA);

  speakerB.play('เมนูดีอาร์กำลังพูด');
  assert.equal(sharedBrowser.__activeSignalSpeaker, speakerB);
  assert.equal(statesA.at(-1), 'idle');
  assert.equal(paused.length, 1);
});
