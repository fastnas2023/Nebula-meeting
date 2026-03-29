const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const roleManager = require('./roleManager');
const { markRoomEmpty, markRoomNonEmpty, sweepRooms } = require('./roomCleanup');
const { resolveCreatorKey, countRoomsByCreatorKey, pickNewCreatorSocketId } = require('./roomPolicy');
const { cleanupRoomSession, isTargetUserInRoom, listRoomUsers, parseJoinRoomArgs } = require('./roomSession');
const { createParticipantId, createRoomSessionToken, verifyRoomSessionToken } = require('./roomAuth');

const app = express();
app.use(cors());
app.use(express.json()); // Enable JSON body parsing

const defaultRtcIceServers = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun.qq.com:3478',
      'stun:stun.aliyun.com:3478',
      'stun:stun.miwifi.com:3478',
    ],
  },
];

function splitEnvList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveRtcIceServers() {
  if (process.env.RTC_ICE_SERVERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.RTC_ICE_SERVERS_JSON);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (error) {
      console.error('Failed to parse RTC_ICE_SERVERS_JSON:', error);
    }
  }

  const stunUrls = splitEnvList(process.env.STUN_URLS);
  const turnUrls = splitEnvList(process.env.TURN_URLS || process.env.TURN_URL);
  const iceServers = [];

  iceServers.push({
    urls: stunUrls.length > 0 ? stunUrls : defaultRtcIceServers[0].urls,
  });

  if (turnUrls.length > 0 && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  return iceServers;
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// --- Role Management API ---

// Get all roles
app.get('/api/roles', (req, res) => {
  try {
    const roles = roleManager.getRoles();
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a role
app.post('/api/roles/:targetRole', (req, res) => {
  const { targetRole } = req.params;
  res.status(403).json({
    error: 'Role updates are disabled until authentication is implemented',
    targetRole,
  });
});

// Get audit logs
app.get('/api/logs', (req, res) => {
  try {
    const logs = roleManager.getLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get active rooms
app.get('/api/rooms', (req, res) => {
  try {
    const ttlMs = Number(process.env.ROOM_IDLE_TTL_MS) || 2 * 60 * 60 * 1000;
    sweepRooms({
      rooms,
      roomRoles,
      adapterRoomSize: (roomId) => io.sockets.adapter.rooms.get(roomId)?.size || 0,
      now: Date.now(),
      ttlMs,
    });
    const roomList = Object.entries(rooms).map(([roomId, data]) => {
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      return {
        roomId,
        creator: data.creator, // userId
        creatorName: data.creatorName || 'Unknown',
        roomName: data.roomName || null,
        createdAt: data.createdAt,
        isProtected: !!data.password, // Check if password exists
        userCount: roomSockets ? roomSockets.size : 0
      };
    });
    res.json({ rooms: roomList, roomIdleTtlMs: ttlMs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rtc-config', (req, res) => {
  res.json({
    iceServers: resolveRtcIceServers(),
  });
});

// ---------------------------

// Agora Token Endpoint
app.get('/rtctoken', (req, resp) => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const channelName = req.query.channel;
  
  if (!appId || !appCertificate) {
    return resp.status(500).json({ 'error': 'Agora environment variables not configured' });
  }

  if (!channelName) {
    return resp.status(400).json({ 'error': 'channel is required' });
  }

  // Simple Password Check
  const password = req.query.password;
  const serverPassword = process.env.MEETING_PASSWORD;
  if (serverPassword && password !== serverPassword) {
      return resp.status(401).json({ 'error': 'Invalid meeting password' });
  }

  let uid = req.query.uid;
  if (!uid || uid === '') {
    uid = 0;
  }
  
  let role = RtcRole.PUBLISHER;
  if (req.query.role === 'subscriber') {
    role = RtcRole.SUBSCRIBER;
  }
  
  let expireTime = req.query.expiry;
  if (!expireTime || expireTime === '') {
    expireTime = 3600;
  } else {
    expireTime = parseInt(expireTime, 10);
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;
  
  let token;
  try {
      token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, role, privilegeExpireTime);
      return resp.json({ 'rtcToken': token, 'appId': appId });
  } catch (err) {
      console.error(err);
      return resp.status(500).json({ 'error': 'Failed to generate token' });
  }
});

// Serve React App in Production
if (process.env.NODE_ENV === 'production') {
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
} else {
  // In development, we don't serve the React app (Vite does), 
  // BUT Playwright might be hitting the server port directly expecting the app if configured that way.
  // However, Playwright test uses http://localhost:5002.
  // The server only serves /api and /socket.io in dev mode.
  // The client is served by Vite on 5173.
  // We need to point Playwright to 5173 or serve static files in dev too (not recommended).
  // Let's redirect root to Vite dev server if hit directly in dev? Or just tell Playwright to use 5173.
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with your client URL
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8, // 100 MB
  pingInterval: Number(process.env.SOCKET_PING_INTERVAL_MS) || 25000,
  pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT_MS) || 60000,
});

// Store room state if needed, but for now we rely on socket.io rooms
// Room metadata: { roomId: { creator: userId, createdAt: timestamp } }
const rooms = {};

// In-memory role mapping: { roomId: { userId: roleName } }
const roomRoles = {};
const roomParticipantRoles = {};
const pendingReconnects = new Map();
const reconnectGraceMs = Number(process.env.ROOM_RECONNECT_GRACE_MS) || 15000;

function reconnectStateKey(roomId, participantId) {
  return `${roomId}:${participantId}`;
}

function clearPendingReconnect(roomId, participantId) {
  const key = reconnectStateKey(roomId, participantId);
  const pending = pendingReconnects.get(key);
  if (pending?.timeoutId) {
    clearTimeout(pending.timeoutId);
  }
  pendingReconnects.delete(key);
  return pending || null;
}

function scheduleReconnectCleanup(socket) {
  const { roomId, userId, participantId, username } = socket.userData || {};
  if (!roomId || !userId || !participantId) return;

  if (roomRoles[roomId]) {
    delete roomRoles[roomId][userId];
    if (Object.keys(roomRoles[roomId]).length === 0) delete roomRoles[roomId];
  }

  io.to(roomId).emit('user-reconnecting', {
    userId,
    participantId,
    username: username || 'Anonymous',
  });

  const key = reconnectStateKey(roomId, participantId);
  const timeoutId = setTimeout(async () => {
    const current = pendingReconnects.get(key);
    if (!current || current.socketId !== userId) return;
    pendingReconnects.delete(key);

    await cleanupRoomSession({
      socket,
      io,
      rooms,
      roomRoles,
      roomParticipantRoles,
      markRoomEmpty,
      markRoomNonEmpty,
      pickNewCreatorSocketId,
      leaveSocketRoom: false,
      cleanupParticipantRole: true,
      now: Date.now(),
    });
  }, reconnectGraceMs);

  pendingReconnects.set(key, {
    roomId,
    participantId,
    socketId: userId,
    timeoutId,
  });
}

const roomCleanupIntervalMs = Number(process.env.ROOM_CLEANUP_INTERVAL_MS) || 60 * 1000;
setInterval(() => {
  const ttlMs = Number(process.env.ROOM_IDLE_TTL_MS) || 2 * 60 * 60 * 1000;
  sweepRooms({
    rooms,
    roomRoles,
    adapterRoomSize: (roomId) => io.sockets.adapter.rooms.get(roomId)?.size || 0,
    now: Date.now(),
    ttlMs,
  });
}, roomCleanupIntervalMs);

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  const getRequesterRole = (roomId, participantId, userId) => {
    return roomParticipantRoles[roomId]?.[participantId] || roomRoles[roomId]?.[userId] || null;
  };

  socket.on('join-room', (...args) => {
    const { roomId, username, password, roomName, clientKey, roomSessionToken } = parseJoinRoomArgs(args);
    const userId = socket.id;
    const verifiedSession = verifyRoomSessionToken(roomSessionToken);
    const canReuseSession = verifiedSession
      && verifiedSession.roomId === roomId
      && (!clientKey || !verifiedSession.clientKey || verifiedSession.clientKey === clientKey);
    const participantId = canReuseSession ? verifiedSession.participantId : createParticipantId();
    const pendingReconnect = clearPendingReconnect(roomId, participantId);
    const previousSocketId = pendingReconnect?.socketId || null;
    // Leave previous rooms if any (optional, depending on use case)
    // Array.from(socket.rooms).forEach(room => {
    //   if (room !== socket.id) socket.leave(room);
    // });

    console.log(`User ${userId} (${username}) joining room ${roomId}`);
    
    // Check if room exists
    if (rooms[roomId]) {
        // Check Password if set
        if (rooms[roomId].password && rooms[roomId].password !== password) {
            console.log(`Invalid password for room ${roomId}`);
            socket.emit('error', 'Invalid Room Password');
            return;
        }
    } else {
      const creatorKey = resolveCreatorKey(socket, clientKey);
      const maxRooms = Number(process.env.ROOMS_PER_CREATOR_LIMIT) || 10;
      const created = countRoomsByCreatorKey(rooms, creatorKey);
      if (created >= maxRooms) {
        socket.emit('error', `Room creation limit reached (${maxRooms})`);
        return;
      }
      // Create new room
      console.log(`Creating new room ${roomId} with creator ${userId}`);
      rooms[roomId] = {
        creator: userId,
        creatorParticipantId: participantId,
        creatorName: username,
        createdAt: Date.now(),
        password: password || null, // Store password if provided
        roomName: typeof roomName === 'string' ? roomName.trim().slice(0, 60) : null,
        creatorKey
      };
    }

    // Determine Role
    let assignedRole = 'participant';
    if (!roomRoles[roomId]) {
      roomRoles[roomId] = {};
    }
    if (!roomParticipantRoles[roomId]) {
      roomParticipantRoles[roomId] = {};
    }

    const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    if (roomSize === 0) {
      rooms[roomId].creator = userId;
      rooms[roomId].creatorParticipantId = participantId;
      rooms[roomId].creatorName = username;
      assignedRole = 'creator';
    } else if (rooms[roomId].creatorParticipantId === participantId) {
      rooms[roomId].creator = userId;
      rooms[roomId].creatorName = username;
      assignedRole = 'creator';
    } else if (roomParticipantRoles[roomId][participantId]) {
      assignedRole = roomParticipantRoles[roomId][participantId];
    }
    
    console.log(`Assigning role ${assignedRole} to user ${userId} in room ${roomId}`);

    // Store role
    roomRoles[roomId][userId] = assignedRole;
    roomParticipantRoles[roomId][participantId] = assignedRole;

    if (previousSocketId && roomRoles[roomId]) {
      delete roomRoles[roomId][previousSocketId];
    }

    const joinedAt = Date.now();
    socket.userData = { roomId, userId, username, joinedAt, participantId, clientKey: clientKey || null };

    socket.join(roomId);
    markRoomNonEmpty(rooms, roomId);

    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    const users = listRoomUsers(roomId, roomSockets, io.sockets.sockets);

    socket.emit('room-users', users);
    socket.emit('room-session', {
      participantId,
      token: createRoomSessionToken({ roomId, participantId, clientKey: clientKey || null, username }),
      rejoined: !!previousSocketId,
    });

    if (previousSocketId && previousSocketId !== userId) {
      socket.to(roomId).emit('user-reconnected', {
        oldUserId: previousSocketId,
        newUserId: userId,
        participantId,
        username: username || 'Anonymous',
        joinedAt,
      });
    } else {
      socket.to(roomId).emit('user-connected', { userId, participantId, username: username || 'Anonymous', joinedAt });
    }
    
    // Emit assigned role to the user
    socket.emit('role-assigned', assignedRole);
    
    // Emit room info including creator
    socket.emit('room-info', {
      creator: rooms[roomId].creator,
      creatorParticipantId: rooms[roomId].creatorParticipantId,
      createdAt: rooms[roomId].createdAt,
      isCreator: rooms[roomId].creatorParticipantId === participantId,
      roomName: rooms[roomId].roomName || null,
    });

  });

  socket.on('leave-room', async () => {
    const { roomId, userId, participantId } = socket.userData || {};
    if (!roomId || !userId || !participantId) return;
    console.log(`User ${userId} leaving room ${roomId}`);
    clearPendingReconnect(roomId, participantId);
    await cleanupRoomSession({
      socket,
      io,
      rooms,
      roomRoles,
      roomParticipantRoles,
      markRoomEmpty,
      markRoomNonEmpty,
      pickNewCreatorSocketId,
      leaveSocketRoom: true,
      cleanupParticipantRole: true,
      now: Date.now(),
    });
  });

  // Role Management Signaling
  socket.on('update-role', ({ targetUserId, newRole }) => {
    console.log(`[Role] update-role request from ${socket.id} for ${targetUserId} to ${newRole}`);
    const { roomId, userId, participantId } = socket.userData || {};
    if (!roomId || !userId || !participantId) {
        console.log(`[Role] update-role failed: missing userData`, socket.userData);
        return;
    }

    // Verify requester is admin or creator
    const requesterRole = getRequesterRole(roomId, participantId, userId);
    console.log(`[Role] requester ${userId} role: ${requesterRole}`);
    
    if (requesterRole !== 'admin' && requesterRole !== 'creator') {
      socket.emit('error', 'Unauthorized: Only admins/creators can change roles');
      return;
    }

    // Update state
    const targetSocket = io.sockets.sockets.get(targetUserId);
    if (!targetSocket?.userData || targetSocket.userData.roomId !== roomId) {
      socket.emit('error', 'Target user is not in the same room');
      return;
    }
    const targetParticipantId = targetSocket.userData.participantId || targetUserId;
    if (!roomRoles[roomId]) roomRoles[roomId] = {};
    if (!roomParticipantRoles[roomId]) roomParticipantRoles[roomId] = {};
    roomRoles[roomId][targetUserId] = newRole;
    roomParticipantRoles[roomId][targetParticipantId] = newRole;

    // Broadcast update to room (so everyone updates UI)
    io.to(roomId).emit('role-updated', { userId: targetUserId, newRole });
  });

  socket.on('kick-user', ({ targetUserId }) => {
    console.log(`[Role] kick-user request from ${socket.id} for ${targetUserId}`);
    const { roomId, userId, participantId } = socket.userData || {};
    if (!roomId || !userId || !participantId) {
        console.log(`[Role] kick-user failed: missing userData`, socket.userData);
        return;
    }

    const requesterRole = getRequesterRole(roomId, participantId, userId);
    console.log(`[Role] requester ${userId} role: ${requesterRole}`);

    // Check permissions (Creator can kick anyone, Admin can kick participants)
    // For now, allow both to kick for simplicity, or restrict based on target role if needed
    if (requesterRole !== 'admin' && requesterRole !== 'creator') {
      socket.emit('error', 'Unauthorized: Insufficient permissions');
      return;
    }

    // Broadcast kick event to the room so everyone knows (and target client handles disconnect)
    io.to(roomId).emit('user-kicked', { targetUserId });
    console.log(`[Role] user-kicked emitted to room ${roomId}`);
  });

  socket.on('mute-user', ({ targetUserId, kind }) => { // kind: 'audio' | 'video'
    console.log(`[Role] mute-user request from ${socket.id} for ${targetUserId} (${kind})`);
    const { roomId, userId, participantId } = socket.userData || {};
    if (!roomId || !userId || !participantId) {
        console.log(`[Role] mute-user failed: missing userData`, socket.userData);
        return;
    }

    const requesterRole = getRequesterRole(roomId, participantId, userId);
    console.log(`[Role] requester ${userId} role: ${requesterRole}`);

    // Check permissions (Admin or Creator can mute)
    if (requesterRole !== 'admin' && requesterRole !== 'creator') {
      socket.emit('error', 'Unauthorized: Insufficient permissions');
      return;
    }

    // Broadcast mute event (target client will disable track)
    io.to(roomId).emit('user-muted', { targetUserId, kind });
    console.log(`[Role] user-muted emitted to room ${roomId}`);
  });

  // Chat Messaging
  socket.on('send-message', ({ roomId, message }) => {
    const { userId, username } = socket.userData || {};
    if (!roomId || !userId) return;

    const msgData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      senderId: userId,
      senderName: username || 'Anonymous',
      type: 'text',
      content: message,
      timestamp: new Date().toISOString()
    };

    io.to(roomId).emit('receive-message', msgData);
  });

  // File Transfer
  socket.on('send-file', ({ roomId, file }) => {
    const { userId, username } = socket.userData || {};
    if (!roomId || !userId) return;

    const msgData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      senderId: userId,
      senderName: username || 'Anonymous',
      type: 'file',
      file: file, // { name, size, type, data }
      timestamp: new Date().toISOString()
    };

    io.to(roomId).emit('receive-message', msgData);
  });

  socket.on('request-high-quality', ({ targetUserId }) => {
    const { roomId, userId, participantId } = socket.userData || {};
    if (!roomId || !userId || !participantId) {
      socket.emit('error', 'Unauthorized: Not currently in a room');
      return;
    }

    const requesterRole = getRequesterRole(roomId, participantId, userId);
    if (requesterRole !== 'admin' && requesterRole !== 'creator') {
      socket.emit('error', 'Unauthorized: Insufficient permissions');
      return;
    }

    if (!isTargetUserInRoom(io.sockets.sockets, roomId, targetUserId)) {
      socket.emit('error', 'Target user is not in the same room');
      return;
    }

    io.to(targetUserId).emit('request-high-quality');
  });

  socket.on('close-room', () => {
    console.log(`[Role] close-room request from ${socket.id}`);
    const { roomId, userId, participantId } = socket.userData || {};
    if (!roomId || !userId || !participantId) return;

    // Only Creator can close room
    if (rooms[roomId]?.creatorParticipantId !== participantId) {
        socket.emit('error', 'Unauthorized: Only creator can close the room');
        return;
    }

    // Broadcast room closed event
    io.to(roomId).emit('room-closed');
    
    // Cleanup
    delete rooms[roomId];
    delete roomRoles[roomId];
    delete roomParticipantRoles[roomId];
    
    // Disconnect all sockets in room? Or let client handle redirection.
    // Ideally, client receives 'room-closed' and redirects to home.
    
    // Force disconnect all sockets in the room after a short delay
    setTimeout(() => {
        io.in(roomId).disconnectSockets(true);
    }, 500);
  });

  // Signaling: Offer
  socket.on('offer', (payload) => {
    // Payload: { target, sdp, sender }
    io.to(payload.target).emit('offer', payload);
  });

  // Signaling: Answer
  socket.on('answer', (payload) => {
    // Payload: { target, sdp, sender }
    io.to(payload.target).emit('answer', payload);
  });

  // Signaling: ICE Candidate
  socket.on('ice-candidate', (payload) => {
    // Payload: { target, candidate, sender }
    io.to(payload.target).emit('ice-candidate', payload);
  });

  socket.on('disconnect', async (reason) => {
    const { roomId, userId, participantId } = socket.userData || {};

    if (roomId && userId && participantId) {
      console.log(`User ${userId} disconnected from room ${roomId} (${reason})`);
      scheduleReconnectCleanup(socket);
    } else {
      console.log(`User disconnected (not in room): ${socket.id} (${reason})`);
    }
  });
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
