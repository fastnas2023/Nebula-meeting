function markRoomNonEmpty(rooms, roomId) {
  if (!rooms[roomId]) return;
  rooms[roomId].emptySince = null;
}

function markRoomEmpty(rooms, roomId, now) {
  if (!rooms[roomId]) return;
  if (typeof rooms[roomId].emptySince !== 'number') {
    rooms[roomId].emptySince = now;
  }
}

function sweepRooms({ rooms, roomRoles, adapterRoomSize, now, ttlMs }) {
  const deleted = [];
  for (const roomId of Object.keys(rooms)) {
    const size = adapterRoomSize(roomId);
    if (size > 0) {
      rooms[roomId].emptySince = null;
      continue;
    }
    markRoomEmpty(rooms, roomId, now);
    const emptySince = rooms[roomId].emptySince;
    if (typeof emptySince === 'number' && now - emptySince >= ttlMs) {
      delete rooms[roomId];
      if (roomRoles[roomId]) delete roomRoles[roomId];
      deleted.push(roomId);
    }
  }
  return deleted;
}

module.exports = { markRoomNonEmpty, markRoomEmpty, sweepRooms };

