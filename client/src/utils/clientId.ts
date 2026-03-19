export function getOrCreateClientId(storage: Storage, key = 'webrtc.clientId'): string {
  const existing = storage.getItem(key);
  if (existing && existing.length <= 128) return existing;

  let id = '';
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
    }
  } catch {}

  if (!id) {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      id = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    }
  }

  storage.setItem(key, id);
  return id;
}

