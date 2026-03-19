const test = require('node:test');
const assert = require('node:assert/strict');
const { sweepRooms, markRoomEmpty, markRoomNonEmpty } = require('./roomCleanup');

test('sweepRooms deletes rooms after ttl when empty', () => {
  const rooms = { r1: { createdAt: 1 }, r2: { createdAt: 2 } };
  const roomRoles = { r1: { u1: 'creator' }, r2: { u2: 'participant' } };
  const size = (id) => (id === 'r1' ? 0 : 1);
  const deleted = sweepRooms({ rooms, roomRoles, adapterRoomSize: size, now: 10_000, ttlMs: 1000 });
  assert.deepEqual(deleted, []);
  assert.equal(typeof rooms.r1.emptySince, 'number');
  assert.equal(rooms.r2.emptySince, null);

  const deleted2 = sweepRooms({ rooms, roomRoles, adapterRoomSize: () => 0, now: 20_500, ttlMs: 1000 });
  assert.ok(deleted2.includes('r1'));
  assert.equal(rooms.r1, undefined);
  assert.equal(roomRoles.r1, undefined);
  assert.equal(typeof rooms.r2.emptySince, 'number');

  const deleted3 = sweepRooms({ rooms, roomRoles, adapterRoomSize: () => 0, now: 22_000, ttlMs: 1000 });
  assert.ok(deleted3.includes('r2'));
  assert.equal(rooms.r2, undefined);
  assert.equal(roomRoles.r2, undefined);
});

test('markRoomNonEmpty clears emptySince', () => {
  const rooms = { r1: { emptySince: 123 } };
  markRoomNonEmpty(rooms, 'r1');
  assert.equal(rooms.r1.emptySince, null);
});

test('markRoomEmpty is idempotent', () => {
  const rooms = { r1: { emptySince: 100 } };
  markRoomEmpty(rooms, 'r1', 200);
  assert.equal(rooms.r1.emptySince, 100);
});
