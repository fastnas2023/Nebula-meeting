export const SESSION_KEYS = {
  shouldRejoin: 'webrtc.shouldRejoin',
  roomId: 'webrtc.roomId',
  nickname: 'webrtc.nickname',
} as const;

export function markShouldRejoin(storage: Storage, roomId: string, nickname: string | null) {
  try {
    storage.setItem(SESSION_KEYS.shouldRejoin, '1');
    storage.setItem(SESSION_KEYS.roomId, roomId);
    if (nickname) storage.setItem(SESSION_KEYS.nickname, nickname);
  } catch {}
}

export function clearRejoin(storage: Storage) {
  try {
    storage.removeItem(SESSION_KEYS.shouldRejoin);
    storage.removeItem(SESSION_KEYS.roomId);
    storage.removeItem(SESSION_KEYS.nickname);
  } catch {}
}

export function readRejoin(storage: Storage): { shouldRejoin: boolean; roomId: string | null; nickname: string | null } {
  try {
    const should = storage.getItem(SESSION_KEYS.shouldRejoin) === '1';
    const roomId = storage.getItem(SESSION_KEYS.roomId);
    const nickname = storage.getItem(SESSION_KEYS.nickname);
    return { shouldRejoin: should, roomId, nickname };
  } catch {
    return { shouldRejoin: false, roomId: null, nickname: null };
  }
}

