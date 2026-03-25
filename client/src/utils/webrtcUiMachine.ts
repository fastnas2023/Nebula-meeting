export type UiMode = 'welcome' | 'setup' | 'meeting';
export type MeetingPhase = 'welcome' | 'setup' | 'joining' | 'meeting' | 'reconnecting' | 'leaving' | 'kicked' | 'room-closed';
export type SignalingState = 'connected' | 'disconnected';
export type ConnectionStatus = 'new' | 'checking' | 'connected' | 'failed' | 'disconnected' | 'closed';

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

export type UiEffect =
  | { type: 'toast'; level: ToastLevel; i18nKey: string; params?: Record<string, unknown> }
  | { type: 'navigate'; to: 'back' }
  | { type: 'persistUrlRoomId'; roomId: string }
  | { type: 'socketEmit'; event: string; payload?: unknown };

export type UiState = {
  uiMode: UiMode;
  meetingPhase: MeetingPhase;
  signalingState: SignalingState;
  connectionStatus: ConnectionStatus;

  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSharing: boolean;
  isRecording: boolean;

  isChatOpen: boolean;
  unreadCount: number;

  roomId: string;
  pendingRoomId: string | null;

  isJoining: boolean;
  remoteCount: number;
  lastFailureReason: 'permissionDenied' | 'deviceNotFound' | 'httpsRequired' | 'unknown' | null;
};

export function createInitialUiState(): UiState {
  return {
    uiMode: 'welcome',
    meetingPhase: 'welcome',
    signalingState: 'connected',
    connectionStatus: 'new',
    isAudioEnabled: true,
    isVideoEnabled: true,
    isSharing: false,
    isRecording: false,
    isChatOpen: false,
    unreadCount: 0,
    roomId: '',
    pendingRoomId: null,
    isJoining: false,
    remoteCount: 0,
    lastFailureReason: null,
  };
}

export type UiEvent =
  | { type: 'user.enterWelcome'; urlRoomId?: string | null }
  | { type: 'user.typeRoomId'; roomId: string }
  | { type: 'user.clickContinue' }
  | { type: 'user.confirmJoinStart' }
  | { type: 'media.joinSuccess' }
  | { type: 'media.joinFailure'; reason: 'permissionDenied' | 'deviceNotFound' | 'unknown' }
  | { type: 'user.leaveMeeting' }
  | { type: 'socket.connected' }
  | { type: 'socket.disconnected' }
  | { type: 'socket.connectError' }
  | { type: 'peer.connectionState'; state: ConnectionStatus; peerId: string }
  | { type: 'peer.iceState'; state: 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed'; peerId: string; isInitiator: boolean }
  | { type: 'room.remoteCountChanged'; count: number }
  | { type: 'room.closed' }
  | { type: 'room.kicked'; isSelf: boolean }
  | { type: 'user.toggleAudio' }
  | { type: 'user.toggleVideo' }
  | { type: 'user.openChat'; open: boolean }
  | { type: 'chat.messageReceived'; isChatOpen: boolean; isFromSelf: boolean }
  | { type: 'user.startShareRequested' }
  | { type: 'share.confirmed' }
  | { type: 'share.stopped' }
  | { type: 'record.startRequested' }
  | { type: 'record.started' }
  | { type: 'record.stopped' }
  | { type: 'record.failed' };

export function reduceUi(state: UiState, event: UiEvent): { state: UiState; effects: UiEffect[] } {
  const effects: UiEffect[] = [];

  switch (event.type) {
    case 'user.enterWelcome': {
      if (state.uiMode !== 'welcome') return { state, effects };
      if (event.urlRoomId && event.urlRoomId !== state.roomId) {
        return { state: { ...state, pendingRoomId: event.urlRoomId }, effects };
      }
      return { state, effects };
    }

    case 'user.typeRoomId':
      return { state: { ...state, roomId: event.roomId }, effects };

    case 'user.clickContinue': {
      if (!state.roomId) {
        effects.push({ type: 'toast', level: 'error', i18nKey: 'enter_room_id_error' });
        return { state, effects };
      }
      return { state: { ...state, uiMode: 'setup', meetingPhase: 'setup' }, effects };
    }

    case 'user.confirmJoinStart': {
      if (state.uiMode !== 'setup') return { state, effects };
      return { state: { ...state, isJoining: true, meetingPhase: 'joining' }, effects };
    }

    case 'media.joinSuccess': {
      if (state.uiMode !== 'setup') return { state, effects };
      effects.push({ type: 'persistUrlRoomId', roomId: state.roomId });
      effects.push({ type: 'socketEmit', event: 'join-room', payload: { roomId: state.roomId } });
      return { state: { ...state, uiMode: 'meeting', meetingPhase: 'meeting', isJoining: false, lastFailureReason: null }, effects };
    }

    case 'media.joinFailure': {
      const key = event.reason === 'permissionDenied' || event.reason === 'deviceNotFound' ? 'device_access_error' : 'device_access_error';
      effects.push({ type: 'toast', level: 'error', i18nKey: key });
      return { state: { ...state, uiMode: 'setup', meetingPhase: 'setup', isJoining: false, lastFailureReason: event.reason }, effects };
    }

    case 'user.leaveMeeting':
      effects.push({ type: 'navigate', to: 'back' });
      return { state: { ...state, uiMode: 'welcome', meetingPhase: 'leaving', remoteCount: 0, isSharing: false, isRecording: false }, effects };

    case 'socket.connected':
      return {
        state: {
          ...state,
          signalingState: 'connected',
          meetingPhase: state.meetingPhase === 'reconnecting' ? 'meeting' : state.meetingPhase,
        },
        effects,
      };

    case 'socket.disconnected':
      effects.push({ type: 'toast', level: 'error', i18nKey: 'disconnected_signaling' });
      return {
        state: {
          ...state,
          signalingState: 'disconnected',
          meetingPhase: state.uiMode === 'meeting' ? 'reconnecting' : state.meetingPhase,
        },
        effects,
      };

    case 'socket.connectError':
      effects.push({ type: 'toast', level: 'error', i18nKey: 'signaling_error' });
      return { state: { ...state, signalingState: 'disconnected' }, effects };

    case 'peer.connectionState': {
      const next = { ...state, connectionStatus: event.state };
      if (event.state === 'failed' || event.state === 'closed') {
        effects.push({ type: 'toast', level: 'error', i18nKey: 'connection_lost', params: { targetId: event.peerId } });
      }
      return { state: next, effects };
    }

    case 'peer.iceState': {
      if (event.state === 'disconnected') {
        effects.push({ type: 'toast', level: 'warning', i18nKey: 'connection_unstable', params: { targetId: event.peerId } });
      }
      return { state, effects };
    }

    case 'room.remoteCountChanged':
      return { state: { ...state, remoteCount: Math.max(0, event.count) }, effects };

    case 'room.closed':
      effects.push({ type: 'toast', level: 'error', i18nKey: 'room_closed' });
      effects.push({ type: 'navigate', to: 'back' });
      return { state: { ...state, uiMode: 'welcome', meetingPhase: 'room-closed', remoteCount: 0 }, effects };

    case 'room.kicked':
      if (event.isSelf) {
        effects.push({ type: 'toast', level: 'error', i18nKey: 'you_were_kicked' });
        effects.push({ type: 'navigate', to: 'back' });
        return { state: { ...state, uiMode: 'welcome', meetingPhase: 'kicked', remoteCount: 0 }, effects };
      }
      effects.push({ type: 'toast', level: 'info', i18nKey: 'user_kicked_msg' });
      return { state, effects };

    case 'user.toggleAudio':
      return { state: { ...state, isAudioEnabled: !state.isAudioEnabled }, effects };

    case 'user.toggleVideo':
      return { state: { ...state, isVideoEnabled: !state.isVideoEnabled }, effects };

    case 'user.openChat':
      return { state: { ...state, isChatOpen: event.open, unreadCount: event.open ? 0 : state.unreadCount }, effects };

    case 'chat.messageReceived':
      if (event.isFromSelf) return { state, effects };
      if (event.isChatOpen) return { state, effects };
      return { state: { ...state, unreadCount: state.unreadCount + 1 }, effects };

    case 'user.startShareRequested':
      return { state, effects };

    case 'share.confirmed':
      return { state: { ...state, isSharing: true }, effects };

    case 'share.stopped':
      return { state: { ...state, isSharing: false }, effects };

    case 'record.startRequested':
      return { state, effects };

    case 'record.started':
      return { state: { ...state, isRecording: true }, effects };

    case 'record.stopped':
      return { state: { ...state, isRecording: false }, effects };

    case 'record.failed':
      effects.push({ type: 'toast', level: 'error', i18nKey: 'recording_error' });
      return { state: { ...state, isRecording: false }, effects };

    default:
      return { state, effects };
  }
}
