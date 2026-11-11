import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignalSpeaker, formatForThaiSpeech } from './speech.mjs';

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
});
