import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignalSpeaker } from './speech.mjs';

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
