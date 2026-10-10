// Browser adapter. Native speech callbacks confirm delivery attempts, not audible hardware output.
export function createSignalSpeaker(browser, onState = () => {}) {
  let generation = 0;
  let current = null;
  const supported = Boolean(browser?.speechSynthesis && typeof browser?.SpeechSynthesisUtterance === 'function');
  function stop() {
    generation += 1;
    current = null;
    if (supported) browser.speechSynthesis.cancel();
    onState('idle');
  }
  function play(text) {
    if (!supported || !text) { onState('unsupported'); return false; }
    const ticket = ++generation;
    const synthesis = browser.speechSynthesis;
    try {
      synthesis.cancel();
      const utterance = new browser.SpeechSynthesisUtterance(text);
      current = utterance; // Retain it until completion (some engines collect unreferenced utterances).
      utterance.lang = 'th-TH';
      utterance.rate = 0.9;
      utterance.pitch = 1.03;
      utterance.voice = synthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith('th')) || null;
      const settle = state => {
        if (ticket !== generation) return;
        current = null;
        onState(state);
      };
      utterance.onstart = () => { if (ticket === generation) onState('speaking'); };
      utterance.onend = () => settle('idle');
      utterance.onerror = event => settle(event.error === 'not-allowed' ? 'blocked' : 'failed');
      onState('starting');
      synthesis.speak(utterance);
      return true;
    } catch { if (ticket === generation) { current = null; onState('failed'); } return false; }
  }
  return { play, stop, supported, get pending() { return current !== null; } };
}
