function getCreatorKey(socket) {
  const addr = socket?.handshake?.address || '';
  return String(addr);
}

function normalizeClientKey(clientKey) {
  if (typeof clientKey !== 'string') return null;
  const v = clientKey.trim();
  if (!v) return null;
  if (v.length > 128) return null;
  return v;
}

function resolveCreatorKey(socket, clientKey) {
  return normalizeClientKey(clientKey) || getCreatorKey(socket);
}

function countRoomsByCreatorKey(rooms, creatorKey) {
  let n = 0;
  for (const room of Object.values(rooms)) {
    if (room?.creatorKey === creatorKey) n += 1;
  }
  return n;
}

function pickNewCreatorSocketId(roomSocketIds, socketsMap, excludeUserId) {
  let best = null;
  for (const socketId of roomSocketIds || []) {
    const s = socketsMap.get(socketId);
    const userId = s?.userData?.userId;
    if (!userId || userId === excludeUserId) continue;
    const joinedAt = typeof s.userData.joinedAt === 'number' ? s.userData.joinedAt : Number.MAX_SAFE_INTEGER;
    if (!best || joinedAt < best.joinedAt) {
      best = { socketId, userId, joinedAt, username: s.userData.username || 'Unknown' };
    }
  }
  return best;
}

module.exports = { getCreatorKey, normalizeClientKey, resolveCreatorKey, countRoomsByCreatorKey, pickNewCreatorSocketId };
