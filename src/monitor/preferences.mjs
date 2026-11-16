const KEY='nugaom-monitor-sound-v1';
export const SOUND_PREFERENCE_KEY=KEY;
export const SOUND_CHANGE_EVENT='nugaom:sound-preference';

const subscribers = new Set();

export function soundPreference(storage) {
  try {
    return storage?.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSoundPreference(storage, enabled) {
  try {
    storage?.setItem(KEY, enabled ? 'on' : 'off');
  } catch {}
  for (const callback of subscribers) {
    try {
      callback(Boolean(enabled));
    } catch {}
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(SOUND_CHANGE_EVENT, { detail: { enabled } }));
    } catch {}
  }
}

export function subscribeSoundPreference(callback) {
  if (typeof callback !== 'function') return () => {};
  subscribers.add(callback);

  const storageHandler = (event) => {
    if (event.type === 'storage' && event.key === KEY) {
      let storage;
      try { storage = window.localStorage; } catch {}
      callback(soundPreference(storage));
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }

  return () => {
    subscribers.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
}
