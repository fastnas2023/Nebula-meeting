const crypto = require('crypto');

const DEFAULT_SECRET = `dev-room-auth-${process.pid}-${Date.now()}`;

function getRoomSessionSecret() {
  return process.env.ROOM_SESSION_SECRET || DEFAULT_SECRET;
}

function base64urlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function base64urlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function createParticipantId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function signPayload(encodedPayload) {
  return crypto
    .createHmac('sha256', getRoomSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
}

function createRoomSessionToken({ roomId, participantId, clientKey, username }) {
  const payload = {
    roomId,
    participantId,
    clientKey: typeof clientKey === 'string' ? clientKey : null,
    username: typeof username === 'string' ? username.slice(0, 120) : 'Anonymous',
    issuedAt: Date.now(),
  };

  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyRoomSessionToken(token) {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (!trimmed) return null;

  const [encodedPayload, signature] = trimmed.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.roomId !== 'string' || typeof payload.participantId !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  createParticipantId,
  createRoomSessionToken,
  verifyRoomSessionToken,
};
