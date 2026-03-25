function parseJoinRoomArgs(args) {
  const [roomId, arg2, arg3, arg4, arg5, arg6] = args;
  const looksLikeSessionToken = typeof arg6 === 'string' && arg6.includes('.');

  if (looksLikeSessionToken) {
    return {
      roomId,
      username: arg2,
      password: arg3,
      roomName: arg4,
      clientKey: arg5,
      roomSessionToken: arg6,
    };
  }

  // Backward-compatible parsing: older clients sent a client-controlled userId
  // as the second argument. We ignore it and always derive identity from socket.id.
  if (args.length >= 6) {
    return {
      roomId,
      username: arg3,
      password: arg4,
      roomName: arg5,
      clientKey: arg6,
      roomSessionToken: null,
    };
  }

  return {
    roomId,
    username: arg2,
    password: arg3,
    roomName: arg4,
    clientKey: arg5,
    roomSessionToken: null,
  };
}

function listRoomUsers(roomId, roomSockets, socketsMap, now = Date.now()) {
  const users = [];
  if (!roomSockets) return users;

  for (const socketId of roomSockets) {
    const socket = socketsMap.get(socketId);
    if (socket && socket.userData && socket.userData.roomId === roomId) {
      users.push({
        userId: socket.userData.userId,
        participantId: socket.userData.participantId || socket.userData.userId,
        username: socket.userData.username || 'Anonymous',
        joinedAt: socket.userData.joinedAt || now,
      });
    }
  }

  return users;
}

function isTargetUserInRoom(socketsMap, roomId, targetUserId) {
  if (!roomId || !targetUserId) return false;
  const targetSocket = socketsMap.get(targetUserId);
  return !!(targetSocket && targetSocket.userData && targetSocket.userData.roomId === roomId);
}

async function cleanupRoomSession({
  socket,
  io,
  rooms,
  roomRoles,
  roomParticipantRoles,
  markRoomEmpty,
  markRoomNonEmpty,
  pickNewCreatorSocketId,
  leaveSocketRoom = false,
  cleanupParticipantRole = true,
  now = Date.now(),
}) {
  const { roomId, userId, participantId } = socket.userData || {};
  if (!roomId || !userId || !participantId) {
    return { cleaned: false, roomId: null, userId: null };
  }

  const roomSocketsBeforeLeave = io.sockets.adapter.rooms.get(roomId);
  let nextCreator = null;

  if (rooms[roomId] && rooms[roomId].creatorParticipantId === participantId && roomSocketsBeforeLeave && roomSocketsBeforeLeave.size > 0) {
    nextCreator = pickNewCreatorSocketId(roomSocketsBeforeLeave, io.sockets.sockets, userId);
  }

  if (leaveSocketRoom && typeof socket.leave === 'function') {
    await socket.leave(roomId);
  }

  if (rooms[roomId] && rooms[roomId].creatorParticipantId === participantId) {
    if (nextCreator) {
      rooms[roomId].creator = nextCreator.userId;
      rooms[roomId].creatorParticipantId = nextCreator.participantId || nextCreator.userId;
      rooms[roomId].creatorName = nextCreator.username;
      if (!roomRoles[roomId]) roomRoles[roomId] = {};
      if (!roomParticipantRoles[roomId]) roomParticipantRoles[roomId] = {};
      roomRoles[roomId][nextCreator.userId] = 'creator';
      roomParticipantRoles[roomId][rooms[roomId].creatorParticipantId] = 'creator';

      io.to(roomId).emit('room-info', {
        creator: nextCreator.userId,
        creatorParticipantId: rooms[roomId].creatorParticipantId,
        creatorName: nextCreator.username,
        createdAt: rooms[roomId].createdAt,
        roomName: rooms[roomId].roomName || null,
      });
      io.to(roomId).emit('role-updated', { userId: nextCreator.userId, newRole: 'creator' });
    } else if (rooms[roomId]) {
      markRoomEmpty(rooms, roomId, now);
    }
  }

  if (roomRoles[roomId]) {
    delete roomRoles[roomId][userId];
    if (Object.keys(roomRoles[roomId]).length === 0) delete roomRoles[roomId];
  }

  if (cleanupParticipantRole && roomParticipantRoles[roomId]) {
    delete roomParticipantRoles[roomId][participantId];
    if (Object.keys(roomParticipantRoles[roomId]).length === 0) delete roomParticipantRoles[roomId];
  }

  socket.userData = null;

  io.to(roomId).emit('user-disconnected', userId);
  const size = io.sockets.adapter.rooms.get(roomId)?.size || 0;
  if (size === 0) {
    markRoomEmpty(rooms, roomId, now);
  } else {
    markRoomNonEmpty(rooms, roomId);
  }

  return {
    cleaned: true,
    roomId,
    userId,
    nextCreatorId: nextCreator?.userId || null,
    size,
  };
}

module.exports = {
  cleanupRoomSession,
  isTargetUserInRoom,
  listRoomUsers,
  parseJoinRoomArgs,
};
