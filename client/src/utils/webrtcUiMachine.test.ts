import { describe, expect, it } from 'vitest';
import type { UiState } from './webrtcUiMachine';
import { createInitialUiState, reduceUi } from './webrtcUiMachine';

describe('webrtcUiMachine', () => {
  it('welcome → setup requires roomId', () => {
    let s = createInitialUiState();
    const r1 = reduceUi(s, { type: 'user.clickContinue' });
    expect(r1.state.uiMode).toBe('welcome');
    expect(r1.effects.some(e => e.type === 'toast')).toBe(true);

    s = reduceUi(s, { type: 'user.typeRoomId', roomId: 'room-123' }).state;
    const r2 = reduceUi(s, { type: 'user.clickContinue' });
    expect(r2.state.uiMode).toBe('setup');
  });

  it('setup → meeting on join success emits join-room and persists URL', () => {
    let s = createInitialUiState();
    s = reduceUi(s, { type: 'user.typeRoomId', roomId: 'room-123' }).state;
    s = reduceUi(s, { type: 'user.clickContinue' }).state;
    s = reduceUi(s, { type: 'user.confirmJoinStart' }).state;

    const r = reduceUi(s, { type: 'media.joinSuccess' });
    expect(r.state.uiMode).toBe('meeting');
    expect(r.state.isJoining).toBe(false);
    expect(r.effects.some(e => e.type === 'persistUrlRoomId')).toBe(true);
    expect(r.effects.some(e => e.type === 'socketEmit' && e.event === 'join-room')).toBe(true);
  });

  it('socket disconnect shows toast and updates signaling state', () => {
    const s = createInitialUiState();
    const r = reduceUi(s, { type: 'socket.disconnected' });
    expect(r.state.signalingState).toBe('disconnected');
    expect(r.effects).toContainEqual({ type: 'toast', level: 'error', i18nKey: 'disconnected_signaling' });
  });

  it('peer connection failed shows toast', () => {
    const s = { ...createInitialUiState(), uiMode: 'meeting' as const };
    const r = reduceUi(s, { type: 'peer.connectionState', state: 'failed', peerId: 'p1' });
    expect(r.state.connectionStatus).toBe('failed');
    expect(r.effects.some(e => e.type === 'toast' && e.i18nKey === 'connection_lost')).toBe(true);
  });

  it('chat unread increments only when closed and from others', () => {
    let s: UiState = { ...createInitialUiState(), uiMode: 'meeting' };
    s = reduceUi(s, { type: 'user.openChat', open: false }).state;
    s = reduceUi(s, { type: 'chat.messageReceived', isChatOpen: false, isFromSelf: false }).state;
    expect(s.unreadCount).toBe(1);
    s = reduceUi(s, { type: 'chat.messageReceived', isChatOpen: false, isFromSelf: true }).state;
    expect(s.unreadCount).toBe(1);
    s = reduceUi(s, { type: 'user.openChat', open: true }).state;
    expect(s.unreadCount).toBe(0);
  });

  it('kicked self navigates back', () => {
    const s: UiState = { ...createInitialUiState(), uiMode: 'meeting' };
    const r = reduceUi(s, { type: 'room.kicked', isSelf: true });
    expect(r.effects.some(e => e.type === 'navigate' && e.to === 'back')).toBe(true);
    expect(r.effects.some(e => e.type === 'toast' && e.i18nKey === 'you_were_kicked')).toBe(true);
  });
});
