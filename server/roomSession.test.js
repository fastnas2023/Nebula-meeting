const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanupRoomSession,
  isTargetUserInRoom,
  listRoomUsers,
  parseJoinRoomArgs,
} = require('./roomSession');

test('parseJoinRoomArgs ignores legacy client-controlled userId', () => {
  const parsed = parseJoinRoomArgs(['room-1', 'spoofed-id', 'Alice', 'secret', 'Weekly Sync', 'client-1']);
  assert.deepEqual(parsed, {
    roomId: 'room-1',
    username: 'Alice',
    password: 'secret',
    roomName: 'Weekly Sync',
    clientKey: 'client-1',
    roomSessionToken: null,
  });
});

test('parseJoinRoomArgs supports current payload shape', () => {
  const parsed = parseJoinRoomArgs(['room-1', 'Alice', 'secret', 'Weekly Sync', 'client-1']);
  assert.deepEqual(parsed, {
    roomId: 'room-1',
    username: 'Alice',
    password: 'secret',
    roomName: 'Weekly Sync',
    clientKey: 'client-1',
    roomSessionToken: null,
  });
});

test('parseJoinRoomArgs supports signed room session tokens', () => {
  const parsed = parseJoinRoomArgs(['room-1', 'Alice', 'secret', 'Weekly Sync', 'client-1', 'payload.signature']);
  assert.deepEqual(parsed, {
    roomId: 'room-1',
    username: 'Alice',
    password: 'secret',
    roomName: 'Weekly Sync',
    clientKey: 'client-1',
    roomSessionToken: 'payload.signature',
  });
});

test('listRoomUsers only returns matching room members', () => {
  const sockets = new Map([
    ['s1', { userData: { roomId: 'room-1', userId: 's1', participantId: 'p1', username: 'Alice', joinedAt: 10 } }],
    ['s2', { userData: { roomId: 'room-2', userId: 's2', participantId: 'p2', username: 'Bob', joinedAt: 20 } }],
    ['s3', { userData: { roomId: 'room-1', userId: 's3', participantId: 'p3', username: 'Carol', joinedAt: 30 } }],
  ]);

  const users = listRoomUsers('room-1', new Set(['s1', 's2', 's3']), sockets);
  assert.deepEqual(users, [
    { userId: 's1', participantId: 'p1', username: 'Alice', joinedAt: 10 },
    { userId: 's3', participantId: 'p3', username: 'Carol', joinedAt: 30 },
  ]);
});

test('isTargetUserInRoom validates same-room target membership', () => {
  const sockets = new Map([
    ['s1', { userData: { roomId: 'room-1', userId: 's1' } }],
    ['s2', { userData: { roomId: 'room-2', userId: 's2' } }],
  ]);

  assert.equal(isTargetUserInRoom(sockets, 'room-1', 's1'), true);
  assert.equal(isTargetUserInRoom(sockets, 'room-1', 's2'), false);
  assert.equal(isTargetUserInRoom(sockets, 'room-1', 'missing'), false);
});

test('cleanupRoomSession removes leaver and transfers creator on explicit leave', async () => {
  const socketA = {
    id: 's1',
    userData: { roomId: 'room-1', userId: 's1', participantId: 'p1', username: 'Alice', joinedAt: 10 },
    leaveCalls: [],
    async leave(roomId) {
      this.leaveCalls.push(roomId);
      io.sockets.adapter.rooms.set(
        roomId,
        new Set([...io.sockets.adapter.rooms.get(roomId)].filter((id) => id !== this.id)),
      );
    },
  };

  const socketB = {
    id: 's2',
    userData: { roomId: 'room-1', userId: 's2', participantId: 'p2', username: 'Bob', joinedAt: 20 },
  };

  const io = {
    emitted: [],
    to(roomId) {
      return {
        emit: (event, payload) => {
          io.emitted.push({ roomId, event, payload });
        },
      };
    },
    sockets: {
      adapter: {
        rooms: new Map([['room-1', new Set(['s1', 's2'])]]),
      },
      sockets: new Map([
        ['s1', socketA],
        ['s2', socketB],
      ]),
    },
  };

  const rooms = {
    'room-1': {
      creator: 's1',
      creatorParticipantId: 'p1',
      creatorName: 'Alice',
      createdAt: 123,
      roomName: 'Weekly Sync',
    },
  };
  const roomRoles = {
    'room-1': {
      s1: 'creator',
      s2: 'participant',
    },
  };
  const roomParticipantRoles = {
    'room-1': {
      p1: 'creator',
      p2: 'participant',
    },
  };

  const markRoomEmpty = (allRooms, roomId, now) => {
    allRooms[roomId].emptySince = now;
  };
  const markRoomNonEmpty = (allRooms, roomId) => {
    allRooms[roomId].emptySince = null;
  };
  const pickNewCreatorSocketId = () => ({ userId: 's2', participantId: 'p2', username: 'Bob', joinedAt: 20 });

  const result = await cleanupRoomSession({
    socket: socketA,
    io,
    rooms,
    roomRoles,
    roomParticipantRoles,
    markRoomEmpty,
    markRoomNonEmpty,
    pickNewCreatorSocketId,
    leaveSocketRoom: true,
    now: 999,
  });

  assert.equal(result.cleaned, true);
  assert.deepEqual(socketA.leaveCalls, ['room-1']);
  assert.equal(socketA.userData, null);
  assert.equal(rooms['room-1'].creator, 's2');
  assert.equal(rooms['room-1'].creatorParticipantId, 'p2');
  assert.equal(roomRoles['room-1'].s1, undefined);
  assert.equal(roomRoles['room-1'].s2, 'creator');
  assert.equal(roomParticipantRoles['room-1'].p1, undefined);
  assert.equal(roomParticipantRoles['room-1'].p2, 'creator');
  assert.deepEqual([...io.sockets.adapter.rooms.get('room-1')], ['s2']);
  assert.ok(io.emitted.some((entry) => entry.event === 'room-info' && entry.payload.creator === 's2'));
  assert.ok(io.emitted.some((entry) => entry.event === 'user-disconnected' && entry.payload === 's1'));
});
