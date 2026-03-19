const test = require('node:test');
const assert = require('node:assert/strict');
const { countRoomsByCreatorKey, pickNewCreatorSocketId, resolveCreatorKey } = require('./roomPolicy');

test('countRoomsByCreatorKey counts rooms', () => {
  const rooms = {
    a: { creatorKey: 'ip1' },
    b: { creatorKey: 'ip1' },
    c: { creatorKey: 'ip2' },
  };
  assert.equal(countRoomsByCreatorKey(rooms, 'ip1'), 2);
  assert.equal(countRoomsByCreatorKey(rooms, 'ip2'), 1);
  assert.equal(countRoomsByCreatorKey(rooms, 'ip3'), 0);
});

test('pickNewCreatorSocketId picks earliest joinedAt excluding leaver', () => {
  const sockets = new Map();
  sockets.set('s1', { userData: { userId: 'u1', username: 'A', joinedAt: 200 } });
  sockets.set('s2', { userData: { userId: 'u2', username: 'B', joinedAt: 100 } });
  sockets.set('s3', { userData: { userId: 'u3', username: 'C', joinedAt: 150 } });

  const pick = pickNewCreatorSocketId(new Set(['s1', 's2', 's3']), sockets, 'u2');
  assert.deepEqual(pick.userId, 'u3');
});

test('resolveCreatorKey prefers clientKey over ip', () => {
  const socket = { handshake: { address: 'ip1' } };
  assert.equal(resolveCreatorKey(socket, 'client-123'), 'client-123');
  assert.equal(resolveCreatorKey(socket, '   '), 'ip1');
});
