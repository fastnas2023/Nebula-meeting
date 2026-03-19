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

const app = express();
app.use(cors());
app.use(express.json()); // Enable JSON body parsing

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
  const { managerRole, updates } = req.body; // In real app, managerRole comes from Auth token

  try {
    const updatedRole = roleManager.updateRole(managerRole, targetRole, updates);
    res.json(updatedRole);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
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
  maxHttpBufferSize: 1e8 // 100 MB
});

// Store room state if needed, but for now we rely on socket.io rooms
// Room metadata: { roomId: { creator: userId, createdAt: timestamp } }
const rooms = {};

// In-memory role mapping: { roomId: { userId: roleName } }
const roomRoles = {};

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

  socket.on('join-room', (roomId, userId, username, password, roomName, clientKey) => {
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

    const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    if (roomSize === 0) {
      rooms[roomId].creator = userId;
      rooms[roomId].creatorName = username;
      assignedRole = 'creator';
    } else if (rooms[roomId].creator === userId) {
      assignedRole = 'creator';
    }
    
    console.log(`Assigning role ${assignedRole} to user ${userId} in room ${roomId}`);

    // Store role
    roomRoles[roomId][userId] = assignedRole;

    const joinedAt = Date.now();
    socket.userData = { roomId, userId, username, joinedAt };

    socket.join(roomId);
    markRoomNonEmpty(rooms, roomId);

    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    const users = [];
    if (roomSockets) {
      for (const socketId of roomSockets) {
        const s = io.sockets.sockets.get(socketId);
        if (s && s.userData && s.userData.roomId === roomId) {
          users.push({
            userId: s.userData.userId,
            username: s.userData.username || 'Anonymous',
            joinedAt: s.userData.joinedAt || Date.now(),
          });
        }
      }
    }

    socket.emit('room-users', users);
    socket.to(roomId).emit('user-connected', { userId, username: username || 'Anonymous', joinedAt });
    
    // Emit assigned role to the user
    socket.emit('role-assigned', assignedRole);
    
    // Emit room info including creator
    socket.emit('room-info', {
      creator: rooms[roomId].creator,
      createdAt: rooms[roomId].createdAt,
      isCreator: rooms[roomId].creator === userId,
      roomName: rooms[roomId].roomName || null,
    });

  });

  // Role Management Signaling
  socket.on('update-role', ({ targetUserId, newRole }) => {
    console.log(`[Role] update-role request from ${socket.id} for ${targetUserId} to ${newRole}`);
    const { roomId, userId } = socket.userData || {};
    if (!roomId || !userId) {
        console.log(`[Role] update-role failed: missing userData`, socket.userData);
        return;
    }

    // Verify requester is admin or creator
    const requesterRole = roomRoles[roomId]?.[userId];
    console.log(`[Role] requester ${userId} role: ${requesterRole}`);
    
    if (requesterRole !== 'admin' && requesterRole !== 'creator') {
      socket.emit('error', 'Unauthorized: Only admins/creators can change roles');
      return;
    }

    // Update state
    if (roomRoles[roomId]) {
      roomRoles[roomId][targetUserId] = newRole;
    }

    // Broadcast update to room (so everyone updates UI)
    io.to(roomId).emit('role-updated', { userId: targetUserId, newRole });
  });

  socket.on('kick-user', ({ targetUserId }) => {
    console.log(`[Role] kick-user request from ${socket.id} for ${targetUserId}`);
    const { roomId, userId } = socket.userData || {};
    if (!roomId || !userId) {
        console.log(`[Role] kick-user failed: missing userData`, socket.userData);
        return;
    }

    const requesterRole = roomRoles[roomId]?.[userId];
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
    const { roomId, userId } = socket.userData || {};
    if (!roomId || !userId) {
        console.log(`[Role] mute-user failed: missing userData`, socket.userData);
        return;
    }

    const requesterRole = roomRoles[roomId]?.[userId];
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

  socket.on('close-room', () => {
    console.log(`[Role] close-room request from ${socket.id}`);
    const { roomId, userId } = socket.userData || {};
    if (!roomId || !userId) return;

    // Only Creator can close room
    if (rooms[roomId]?.creator !== userId) {
        socket.emit('error', 'Unauthorized: Only creator can close the room');
        return;
    }

    // Broadcast room closed event
    io.to(roomId).emit('room-closed');
    
    // Cleanup
    delete rooms[roomId];
    delete roomRoles[roomId];
    
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

  socket.on('disconnect', () => {
    const { roomId, userId } = socket.userData || {};
    
    if (roomId && userId) {
      console.log(`User ${userId} disconnected from room ${roomId}`);
      
      // Handle Creator Departure
      if (rooms[roomId] && rooms[roomId].creator === userId) {
        console.log(`Creator ${userId} left room ${roomId}. Transferring ownership...`);
        
        // Get remaining users in the room
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (roomSockets && roomSockets.size > 0) {
          const pick = pickNewCreatorSocketId(roomSockets, io.sockets.sockets, userId);
          if (pick) {
            rooms[roomId].creator = pick.userId;
            rooms[roomId].creatorName = pick.username;
            if (!roomRoles[roomId]) roomRoles[roomId] = {};
            roomRoles[roomId][pick.userId] = 'creator';

            console.log(`Transferred ownership to ${pick.userId} (${pick.username})`);

            io.to(roomId).emit('room-info', {
              creator: pick.userId,
              creatorName: pick.username,
              createdAt: rooms[roomId].createdAt,
              roomName: rooms[roomId].roomName || null,
            });
            io.to(roomId).emit('role-updated', { userId: pick.userId, newRole: 'creator' });
          } else {
            markRoomEmpty(rooms, roomId, Date.now());
          }
        } else {
          markRoomEmpty(rooms, roomId, Date.now());
        }
      }

      // Clean up role data
      if (roomRoles[roomId]) {
        delete roomRoles[roomId][userId];
        if (Object.keys(roomRoles[roomId]).length === 0) delete roomRoles[roomId];
      }

      console.log(`Broadcasting user-disconnected for ${userId} to room ${roomId}`);
      io.to(roomId).emit('user-disconnected', userId);
      const size = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      if (size === 0) {
        markRoomEmpty(rooms, roomId, Date.now());
      } else {
        markRoomNonEmpty(rooms, roomId);
      }
    } else {
      console.log('User disconnected (not in room):', socket.id);
    }
  });
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
