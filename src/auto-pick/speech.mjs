// Browser adapter with dual-tier Thai TTS:
// Tier 1: Neural Studio Thai TTS (/api/tts via Edge-TTS / Hugging Face MMS-TTS)
// Tier 2: Browser SpeechSynthesis (th-TH) instant zero-delay fallback
// Text verbalizer: Translates market abbreviations and numbers into natural spoken Thai.

export function formatForThaiSpeech(text) {
  if (typeof text !== 'string') return '';
  return text
    // Strip bracketed news tags
    .replace(/\[\s*(?:มีคลิป|คลิป|ชมคลิป|ด่วน|LIVE|สด|อัปเดต|update).*?\]/gi, '')
    .replace(/\(\s*(?:มีคลิป|คลิป|ชมคลิป|ด่วน|LIVE|สด|อัปเดต|update).*?\)/gi, '')
    // Strip publisher trailing pipes
    .replace(/\|\s*(?:ข่าวหุ้นธุรกิจ|ข่าวหุ้นธุรกิจออนไลน์|Kaohoon|InfoQuest|อินโฟเควสท์|CNBC).*$/gi, '')
    // Trading abbreviations to spoken Thai
    .replace(/\bTP1\b/gi, 'ทีพี หนึ่ง')
    .replace(/\bTP2\b/gi, 'ทีพี สอง')
    .replace(/\bTP\b/gi, 'ทีพี')
    .replace(/\bSL\b/gi, 'สต็อปลอส')
    .replace(/\b2R\b/gi, 'สองอาร์')
    .replace(/\b1R\b/gi, 'หนึ่งอาร์')
    .replace(/\b3R\b/gi, 'สามอาร์')
    .replace(/\bEMA\s*20\/50\b/gi, 'อีเอ็มเอ 20 และ 50')
    .replace(/\bEMA\s*20\b/gi, 'อีเอ็มเอ 20')
    .replace(/\bEMA\s*50\b/gi, 'อีเอ็มเอ 50')
    .replace(/\bEMA\s*200\b/gi, 'อีเอ็มเอ 200')
    .replace(/\b15m\b/gi, '15 นาที')
    .replace(/\b4H\b/gi, '4 ชั่วโมง')
    .replace(/\bD1\b/gi, 'เดย์')
    .replace(/\bSHORT\b/g, 'ชอร์ต')
    .replace(/\bLONG\b/g, 'ลอง')
    .replace(/\bSET50\b/gi, 'เซ็ต 50')
    .replace(/\bTFEX\b/gi, 'ทีเฟกซ์')
    .replace(/\bDR\b/g, 'ดีอาร์')
    // Strip ticker suffixes
    .replace(/([A-Za-z0-9]+)\.BK\b/g, '$1')
    // Punctuation and symbols
    .replace(/%/g, ' เปอร์เซ็นต์ ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createSignalSpeaker(browser, onState = () => {}, options = {}) {
  let generation = 0;
  let current = null;
  let currentAudio = null;
  let sharedAudio = null;

  const hasSynthesis = Boolean(browser?.speechSynthesis && typeof browser?.SpeechSynthesisUtterance === 'function');
  const AudioCtor = browser?.Audio || (typeof Audio !== 'undefined' ? Audio : null);
  const hasAudio = Boolean(AudioCtor && options.useAudio !== false);
  const supported = hasSynthesis || hasAudio;

  function unlock() {
    if (hasAudio && !sharedAudio) {
      try {
        const a = new AudioCtor('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        a.playsInline = true;
        a.volume = 0;
        const p = a.play?.();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            if (currentAudio !== a) {
              try { a.pause(); a.currentTime = 0; } catch {}
              a.volume = 1;
            }
          }).catch(() => {
            a.volume = 1;
          });
        } else {
          a.volume = 1;
        }
        sharedAudio = a;
      } catch {}
    }
    if (hasSynthesis && !current) {
      try {
        const u = new browser.SpeechSynthesisUtterance('');
        u.volume = 0;
        u.lang = 'th-TH';
        browser.speechSynthesis.speak?.(u);
      } catch {}
    }
  }

  function stop() {
    generation += 1;
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch {}
      currentAudio = null;
    }
    current = null;
    if (hasSynthesis) {
      try {
        browser.speechSynthesis.cancel();
      } catch {}
    }
    onState('idle', { reason: 'stopped' });
  }

  function playSynthesis(text, ticket) {
    if (!hasSynthesis) {
      if (ticket === generation) {
        current = null;
        onState('failed');
      }
      return false;
    }
    const synthesis = browser.speechSynthesis;
    try {
      synthesis.cancel();
      const utterance = new browser.SpeechSynthesisUtterance(text);
      current = utterance;
      utterance.lang = 'th-TH';
      utterance.rate = 0.9;
      utterance.pitch = 1.03;
      utterance.voice = synthesis.getVoices?.().find(voice => voice.lang.toLowerCase().startsWith('th')) || null;
      const settle = (state, reason) => {
        if (ticket !== generation) return;
        current = null;
        onState(state, { reason });
      };
      utterance.onstart = () => { if (ticket === generation) onState('speaking'); };
      utterance.onend = () => settle('idle', 'ended');
      utterance.onerror = event => settle(event.error === 'not-allowed' ? 'blocked' : 'failed');
      onState('starting');
      synthesis.speak(utterance);
      return true;
    } catch {
      if (ticket === generation) {
        current = null;
        onState('failed');
      }
      return false;
    }
  }

  function playAudio(text, ticket) {
    try {
      const url = `/api/tts?text=${encodeURIComponent(text)}`;
      let audio;
      if (sharedAudio) {
        audio = sharedAudio;
        try { audio.pause(); } catch {}
        audio.volume = 1;
        audio.src = url;
        audio.load?.();
      } else {
        audio = new AudioCtor(url);
        audio.playsInline = true;
      }
      currentAudio = audio;
      current = audio;

      let started = false;
      const settle = (state, reason) => {
        if (ticket !== generation) return;
        if (currentAudio === audio) currentAudio = null;
        current = null;
        onState(state, { reason });
      };

      audio.onplay = () => {
        if (ticket !== generation) return;
        started = true;
        onState('speaking');
      };

      audio.onended = () => settle('idle', 'ended');

      audio.onerror = () => {
        if (ticket !== generation) return;
        if (currentAudio === audio) currentAudio = null;
        if (hasSynthesis && !started) {
          playSynthesis(text, ticket);
        } else {
          settle('failed', 'audio_error');
        }
      };

      onState('starting');
      const p = audio.play?.();
      if (p && typeof p.catch === 'function') {
        p.catch(err => {
          if (ticket !== generation) return;
          if (hasSynthesis && !started && err?.name !== 'NotAllowedError') {
            playSynthesis(text, ticket);
          } else if (err?.name === 'NotAllowedError') {
            settle('blocked', 'not-allowed');
          } else if (hasSynthesis && !started) {
            playSynthesis(text, ticket);
          } else {
            settle('failed', err?.message || 'play_error');
          }
        });
      }
      return true;
    } catch {
      if (hasSynthesis) {
        return playSynthesis(text, ticket);
      }
      if (ticket === generation) {
        current = null;
        onState('failed');
      }
      return false;
    }
  }

  function play(text) {
    if (!supported || !text) {
      onState('unsupported');
      return false;
    }
    const spokenText = formatForThaiSpeech(text);
    if (!spokenText) {
      onState('unsupported');
      return false;
    }
    const ticket = ++generation;

    const preferAudio = hasAudio && options.engine !== 'synthesis';
    if (preferAudio) {
      return playAudio(spokenText, ticket);
    }
    return playSynthesis(spokenText, ticket);
  }

  return {
    play,
    stop,
    unlock,
    supported,
    get pending() {
      return current !== null;
    },
  };
}
