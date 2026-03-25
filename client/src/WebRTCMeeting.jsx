import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import io from 'socket.io-client';
import MeetingScreen from './components/webrtc/MeetingScreen';
import MeetingVideoGrid from './components/webrtc/MeetingVideoGrid';
import SetupScreen from './components/webrtc/SetupScreen';
import WelcomeScreen from './components/webrtc/WelcomeScreen';
import useMeetingMedia from './hooks/useMeetingMedia';
import useMeetingRoomActions from './hooks/useMeetingRoomActions';
import useMeetingSocketListeners from './hooks/useMeetingSocketListeners';
import { loadFullscreenTileId, loadSortRule, saveFullscreenTileId, saveSortRule, sortParticipantIds } from './utils/meetingState';
import { createInitialUiState, reduceUi } from './utils/webrtcUiMachine';
import { formatRecordingStats } from './utils/meetingRecording';
import { shouldCssFlipLocalPreview } from './utils/videoMirror';
import { markShouldRejoin, clearRejoin, readRejoin } from './utils/session';
import { getWithTtl, remove, setWithTtl } from './utils/ttlStorage';
import { getOrCreateClientId } from './utils/clientId';

// Use relative path for socket.io to leverage Vite proxy in dev and same-origin in prod
const socket = io();

function WebRTCMeeting({ onBack, addToast, username }) {
  const { t } = useTranslation();
  const clientId = useMemo(() => getOrCreateClientId(localStorage), []);
  const [lifecycleState, dispatchLifecycleEvent] = useReducer(
    (state, event) => reduceUi(state, event).state,
    undefined,
    createInitialUiState,
  );
  const [roomId, setRoomId] = useState('');
  const [entryMode, setEntryMode] = useState('join');
  const [joinRoomIdError, setJoinRoomIdError] = useState(false);
  const [activeRoomQuery, setActiveRoomQuery] = useState('');
  const generateNumericRoomId = () => {
      try {
          const arr = new Uint32Array(2);
          window.crypto.getRandomValues(arr);
          const n = ((arr[0] % 90000000) + 10000000).toString();
          return n;
      } catch (e) { void e; }
      return Math.floor(10000000 + Math.random() * 90000000).toString();
  };
  const [createRoomId, setCreateRoomId] = useState(() => generateNumericRoomId());
  const [createRoomName, setCreateRoomName] = useState('');
  const [_joined, setJoined] = useState(false);
  const [uiState, setUiState] = useState('welcome'); // 'welcome', 'setup', 'meeting'
  const [isSharing, setIsSharing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordModeOpen, setIsRecordModeOpen] = useState(false);
  const [recordingStats, setRecordingStats] = useState({ seconds: 0, bytes: 0 });
  const [remoteStreams, setRemoteStreams] = useState({});
  const [copied, setCopied] = useState(false);
  const [signalingState, setSignalingState] = useState('connected'); // connected, disconnected
  const [connectionStatus, setConnectionStatus] = useState('new'); // new, checking, connected, failed, disconnected
  const [participantConnectionStatus, setParticipantConnectionStatus] = useState({});
  const [participantStats, setParticipantStats] = useState({});
  const [deviceSetupIssue, setDeviceSetupIssue] = useState(null);

  // Device Setup State
  const [cameras, setCameras] = useState([]);
  const [mics, setMics] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicId, setSelectedMicId] = useState('');
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [nickname, setNickname] = useState(username || localStorage.getItem('username') || '');
  
  // Screen Share Preview State
  const [sharePreviewStream, setSharePreviewStream] = useState(null);
  const [isSharePreviewOpen, setIsSharePreviewOpen] = useState(false);
  const [isLowDataMode, setIsLowDataMode] = useState(false);
  const [resolution, setResolution] = useState('720p'); // 360p, 720p, 1080p
  const [frameRate, setFrameRate] = useState(30); // 15, 30, 60
  const [roomPassword, setRoomPassword] = useState(''); // New State for Password
  const appliedRoomCredsRef = useRef(null);
  const ROOM_CRED_TTL_MS = 2 * 60 * 60 * 1000;
  const roomCredKey = (id) => `webrtc.roomCreds.${id}`;
  const readRoomCreds = (id) => getWithTtl(sessionStorage, roomCredKey(id));
  const writeRoomCreds = (id, data) => setWithTtl(sessionStorage, roomCredKey(id), data, ROOM_CRED_TTL_MS);
  const roomSessionKey = (id) => `webrtc.roomSession.${id}`;
  const readRoomSession = (id) => {
    if (!id) return null;
    try {
      const raw = sessionStorage.getItem(roomSessionKey(id));
      return raw || null;
    } catch {
      return null;
    }
  };
  const writeRoomSession = (id, token) => {
    if (!id || !token) return;
    try {
      sessionStorage.setItem(roomSessionKey(id), token);
    } catch {}
  };
  const clearRoomSession = (id) => {
    if (!id) return;
    try {
      sessionStorage.removeItem(roomSessionKey(id));
    } catch {}
  };

  // Role Management State
  const [myRole, setMyRole] = useState('participant');
  const [roleDefinitions, setRoleDefinitions] = useState({});
  const [remoteRoles, setRemoteRoles] = useState({}); // { socketId: roleName }
  const [_roomCreator, setRoomCreator] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [activeRooms, setActiveRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomIdleTtlMs, setRoomIdleTtlMs] = useState(2 * 60 * 60 * 1000);
  const [isLeaveOptionsOpen, setIsLeaveOptionsOpen] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMirrored, setIsMirrored] = useState(true);
  const [fullscreenTileId, setFullscreenTileId] = useState(() => loadFullscreenTileId(localStorage));
  const [exitingFullscreenTileId, setExitingFullscreenTileId] = useState(null);
  const [sortRule, setSortRule] = useState(() => loadSortRule(localStorage));
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [participantMeta, setParticipantMeta] = useState({});
  const [roomSessionToken, setRoomSessionToken] = useState('');
  const [localJoinedAt, setLocalJoinedAt] = useState(() => Date.now());
  const [speakingByUserId, setSpeakingByUserId] = useState({});
  const chatScrollRef = useRef(null);
  const isChatOpenRef = useRef(isChatOpen);
  const fileInputRef = useRef(null);
  const fullscreenHostRef = useRef(null);
  const fullscreenExitTimerRef = useRef(null);
  const sortMenuRef = useRef(null);
  const meetingPhase = lifecycleState.meetingPhase;
  const roomSessionTokenRef = useRef('');
  const weakNetworkStrikeCountRef = useRef(0);
  const autoLowDataAppliedRef = useRef(false);

  useEffect(() => {
    roomSessionTokenRef.current = roomSessionToken;
  }, [roomSessionToken]);

  useEffect(() => {
      isChatOpenRef.current = isChatOpen;
      if (isChatOpen) {
          setUnreadCount(0);
          // Scroll to bottom when opened
          setTimeout(() => {
              if (chatScrollRef.current) {
                  chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
              }
          }, 100);
      }
  }, [isChatOpen]);

  useEffect(() => {
    if (uiState !== 'setup') return;
    if (!roomId) return;
    if (appliedRoomCredsRef.current === roomId) return;
    appliedRoomCredsRef.current = roomId;
    const cached = readRoomCreds(roomId);
    const cachedRoomSession = readRoomSession(roomId);
    setRoomSessionToken(typeof cachedRoomSession === 'string' ? cachedRoomSession : '');
    if (!cached) return;
    if (typeof cached.nickname === 'string' && cached.nickname) setNickname(cached.nickname);
    if (typeof cached.password === 'string' && cached.password && !roomPassword) setRoomPassword(cached.password);
  }, [uiState, roomId]);

  useEffect(() => {
    dispatchLifecycle({ type: 'user.typeRoomId', roomId });
  }, [roomId]);

  const activeFullscreenTileId = fullscreenTileId || exitingFullscreenTileId;
  

  const orderedTileIds = useMemo(() => {
      const localName = (nickname || '').trim() || (t('you') || 'You');
      const inputs = [
          { id: 'local', name: localName, joinedAt: localJoinedAt, isSpeaking: !!speakingByUserId.local }
      ];

      const remoteIds = new Set([
        ...Object.keys(remoteStreams),
        ...Object.keys(participantMeta),
        ...Object.keys(participantConnectionStatus),
      ]);

      remoteIds.forEach((userId) => {
          const meta = participantMeta[userId];
          const name = meta?.name || t('user_label', { userId: userId.slice(0, 4) });
          const joinedAt = typeof meta?.joinedAt === 'number' ? meta.joinedAt : Number.MAX_SAFE_INTEGER;
          inputs.push({
              id: userId,
              name,
              joinedAt,
              isSpeaking: !!speakingByUserId[userId],
          });
      });

      return sortParticipantIds(inputs, sortRule);
  }, [nickname, t, localJoinedAt, speakingByUserId, remoteStreams, participantMeta, participantConnectionStatus, sortRule]);

  const exitFullscreen = () => {
      if (!activeFullscreenTileId) return;
      if (fullscreenExitTimerRef.current) {
          clearTimeout(fullscreenExitTimerRef.current);
          fullscreenExitTimerRef.current = null;
      }
      setExitingFullscreenTileId(activeFullscreenTileId);
      setFullscreenTileId(null);
      saveFullscreenTileId(localStorage, null);
      fullscreenExitTimerRef.current = setTimeout(() => {
          setExitingFullscreenTileId(null);
          fullscreenExitTimerRef.current = null;
      }, 280);
  };

  const enterFullscreen = (tileId) => {
      if (!tileId) return;
      if (fullscreenExitTimerRef.current) {
          clearTimeout(fullscreenExitTimerRef.current);
          fullscreenExitTimerRef.current = null;
      }
      setExitingFullscreenTileId(null);
      setFullscreenTileId(tileId);
      saveFullscreenTileId(localStorage, tileId);
  };

  const toggleFullscreen = (tileId) => {
      if (!tileId) return;
      if (activeFullscreenTileId === tileId) {
          exitFullscreen();
          return;
      }
      enterFullscreen(tileId);
  };

  const applySortRule = (rule) => {
      setSortRule(rule);
      saveSortRule(localStorage, rule);
  };

  useEffect(() => {
      if (!isSortMenuOpen) return;
      const onPointerDown = (e) => {
          const el = sortMenuRef.current;
          if (el && e.target instanceof Node && !el.contains(e.target)) {
              setIsSortMenuOpen(false);
          }
      };
      document.addEventListener('pointerdown', onPointerDown);
      return () => {
          document.removeEventListener('pointerdown', onPointerDown);
      };
  }, [isSortMenuOpen]);

  useEffect(() => {
      if (!fullscreenTileId) return;
      const onKeyDown = (e) => {
          if (e.key === 'Escape') {
              exitFullscreen();
          }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => {
          window.removeEventListener('keydown', onKeyDown);
      };
  }, [fullscreenTileId]);

  useEffect(() => {
      if (!fullscreenTileId) return;
      if (fullscreenTileId === 'local') return;
      if (remoteStreams[fullscreenTileId]) return;
      exitFullscreen();
  }, [fullscreenTileId, remoteStreams]);

  useEffect(() => {
    // Re-attach local stream to video element when it changes or when we enter meeting view
    if (uiState === 'meeting' && localVideoRef.current && localStreamRef.current) {
        // Ensure tracks are enabled if state says so
        if (isVideoEnabled) {
            localStreamRef.current.getVideoTracks().forEach(t => t.enabled = true);
        }
        if (isAudioEnabled) {
            localStreamRef.current.getAudioTracks().forEach(t => t.enabled = true);
        }

        if (localVideoRef.current.srcObject !== localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    }
  }, [uiState, isVideoEnabled, isAudioEnabled]);

  useEffect(() => {
    if (uiState !== 'meeting') return;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    if (!speakingAudioContextRef.current) {
      speakingAudioContextRef.current = new AudioContextCtor();
    }
    const ctx = speakingAudioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch((e) => { void e; });
    }

    const desiredIds = new Set(['local', ...Object.keys(remoteStreams)]);
    const detectors = speakingDetectorRef.current;

    const stopDetector = (id) => {
      const d = detectors[id];
      if (!d) return;
      if (d.intervalId) clearInterval(d.intervalId);
      try { d.source?.disconnect(); } catch (e) { void e; }
      try { d.analyser?.disconnect(); } catch (e) { void e; }
      delete detectors[id];
    };

    Object.keys(detectors).forEach(id => {
      if (!desiredIds.has(id)) stopDetector(id);
    });

    const ensureDetector = (id, stream, enabled) => {
      if (!enabled) {
        stopDetector(id);
        if (speakingValueRef.current[id]) {
          speakingValueRef.current[id] = false;
          setSpeakingByUserId(prev => ({ ...prev, [id]: false }));
        }
        return;
      }

      const audioTrack = stream?.getAudioTracks?.()[0];
      if (!audioTrack) {
        stopDetector(id);
        return;
      }

      if (detectors[id]) return;

      const audioStream = new MediaStream([audioTrack]);
      const source = ctx.createMediaStreamSource(audioStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const intervalId = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i += 1) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const speakingNow = avg > 22;
        if (speakingValueRef.current[id] !== speakingNow) {
          speakingValueRef.current[id] = speakingNow;
          setSpeakingByUserId(prev => ({ ...prev, [id]: speakingNow }));
        }
      }, 200);

      detectors[id] = { source, analyser, intervalId };
    };

    ensureDetector('local', localStreamRef.current, !!isAudioEnabled);
    Object.entries(remoteStreams).forEach(([id, stream]) => {
      ensureDetector(id, stream, true);
    });
  }, [uiState, remoteStreams, isAudioEnabled]);

  // 网络与可见性监听：不中断 UI，不跳回主页；恢复时尝试 ICE restart
  useEffect(() => {
    const onOnline = () => {
      addToast(t('signal_ok'), 'info');
      Object.entries(peersRef.current).forEach(([peerId, pc]) => {
        if (pc.connectionState !== 'connected') {
          pc.createOffer({ iceRestart: true })
            .then(offer => pc.setLocalDescription(offer))
            .then(() => socket.emit('offer', { target: peerId, sdp: pc.localDescription, sender: socket.id }))
            .catch(() => {});
        }
      });
    };
    const onOffline = () => addToast(t('offline'), 'warning');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onOnline();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [t]);

  useEffect(() => {
    if (uiState === 'meeting') return;
    const detectors = speakingDetectorRef.current;
    Object.keys(detectors).forEach(id => {
      const d = detectors[id];
      if (d?.intervalId) clearInterval(d.intervalId);
      try { d?.source?.disconnect?.(); } catch (e) { void e; }
      try { d?.analyser?.disconnect?.(); } catch (e) { void e; }
      delete detectors[id];
    });
    speakingValueRef.current = {};
    setSpeakingByUserId({});
  }, [uiState]);

  useEffect(() => {
    // 启动阶段：支持刷新后自动回到会议
    if (uiState !== 'welcome') return;

    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get('roomId');
    const { shouldRejoin, roomId: ssRoom, nickname: ssName } = readRejoin(sessionStorage);

    if (urlRoomId) {
      setPendingRoomId(urlRoomId);
      return;
    }

    if (shouldRejoin && ssRoom) {
      const target = ssRoom;
      if (ssName && !nickname) setNickname(ssName);
      setRoomId(target || '');
      (async () => {
        try {
          await confirmJoin();
        } catch (e) { void e; }
      })();
      return;
    }

    // 正常欢迎页逻辑：拉活跃房间
    fetchActiveRooms();
    const interval = setInterval(fetchActiveRooms, 5000);
    return () => clearInterval(interval);
  }, [uiState]);

  const [pendingRoomId, setPendingRoomId] = useState(null);
  const autoJoinAfterConfirmRef = useRef(false);

  const confirmReturnRoom = () => {
      if (pendingRoomId) {
          // Analytics: Track "Return to Room" conversion
          console.log('[Analytics] User returned to room:', pendingRoomId);
          autoJoinAfterConfirmRef.current = true;
          setRoomId(pendingRoomId);
          setUiState('setup');
          setPendingRoomId(null);
      }
  };

  const cancelReturnRoom = () => {
      // Analytics: Track "Cancel Return"
      console.log('[Analytics] User cancelled return to room');
      setPendingRoomId(null);
      try { clearRejoin(sessionStorage); } catch (e) { void e; }
      // Clear URL param
      const url = new URL(window.location);
      url.searchParams.delete('roomId');
      window.history.replaceState({}, '', url);
      // Refresh rooms list
      fetchActiveRooms();
  };

  useEffect(() => {
    if (uiState !== 'setup') return;
    if (!autoJoinAfterConfirmRef.current) return;
    autoJoinAfterConfirmRef.current = false;
    (async () => {
      try {
        await confirmJoin();
      } catch (e) { void e; }
    })();
  }, [uiState]);

  const fetchActiveRooms = () => {
    setIsLoadingRooms(true);
    fetch('/api/rooms')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActiveRooms(data);
        } else {
          setActiveRooms(Array.isArray(data?.rooms) ? data.rooms : []);
          if (typeof data?.roomIdleTtlMs === 'number') setRoomIdleTtlMs(data.roomIdleTtlMs);
        }
        setIsLoadingRooms(false);
      })
      .catch(err => {
        console.error('Failed to load rooms:', err);
        setIsLoadingRooms(false);
      });
  };

  const localVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const peersRef = useRef({}); // { socketId: RTCPeerConnection }
  const localStreamRef = useRef(null); // Combined stream (video + audio)
  const audioStreamRef = useRef(null); // Separate audio stream from mic
  const videoStreamRef = useRef(null); // Separate video stream from camera
  const screenStreamRef = useRef(null); // Separate video stream from screen share
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStopCleanupRef = useRef(null);
  const recordingStatsIntervalRef = useRef(null);
  const volumeIntervalRef = useRef(null);
  const isJoiningRef = useRef(false);
  const speakingAudioContextRef = useRef(null);
  const speakingDetectorRef = useRef({});
  const speakingValueRef = useRef({});
  const hasJoinedMeetingRef = useRef(false);
  const hasLeftRoomRef = useRef(false);

  const hasPermission = (permissionName) => {
    if (!roleDefinitions || !roleDefinitions[myRole]) return false;
    return roleDefinitions[myRole].permissions[permissionName] === true;
  };

  const dispatchLifecycle = (event) => {
    dispatchLifecycleEvent(event);
  };

  // 依赖 refs 的镜像判定需放在 refs 初始化之后
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const localVideoFacingMode = useMemo(() => {
      const track = uiState === 'setup'
          ? videoStreamRef.current?.getVideoTracks?.()[0]
          : (isSharing ? screenStreamRef.current?.getVideoTracks?.()[0] : localStreamRef.current?.getVideoTracks?.()[0]);
      const mode = track?.getSettings?.()?.facingMode;
      return typeof mode === 'string' ? mode : undefined;
  }, [uiState, selectedCameraId, isLowDataMode, resolution, frameRate, isSharing, isVideoEnabled]);
  const shouldFlipLocalVideoCss = shouldCssFlipLocalPreview({
      userAgent,
      facingMode: localVideoFacingMode,
      userMirrorEnabled: isMirrored,
      isScreenShare: isSharing,
  });

  useEffect(() => {
    if (uiState === 'meeting') {
      isJoiningRef.current = false;
    }
  }, [uiState]);

  useEffect(() => {
    fetch('/api/roles')
      .then((res) => res.json())
      .then((data) => {
        setRoleDefinitions(data);
      })
      .catch((error) => console.error('Failed to load roles:', error));
  }, []);

  const {
    setLowDataModeEnabled,
    prepareJoinMedia,
    toggleLowDataMode,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    confirmScreenShare,
    cancelScreenShare,
    stopScreenShare,
    startRecording,
    stopRecording,
    startCompositeRecording,
    openRecordingMode,
    cleanupMediaResources,
  } = useMeetingMedia({
    uiState,
    selectedCameraId,
    selectedMicId,
    isLowDataMode,
    setIsLowDataMode,
    resolution,
    frameRate,
    isVideoEnabled,
    setIsVideoEnabled,
    isAudioEnabled,
    setIsAudioEnabled,
    isSharing,
    setIsSharing,
    setIsRecording,
    isRecording,
    setIsRecordModeOpen,
    setRecordingStats,
    sharePreviewStream,
    setSharePreviewStream,
    isSharePreviewOpen,
    setIsSharePreviewOpen,
    activeFullscreenTileId,
    orderedTileIds,
    remoteStreams,
    addToast,
    t,
    hasPermission,
    setDeviceSetupIssue,
    setMessages,
    setCameras,
    setMics,
    setVolumeLevel,
    previewVideoRef,
    localVideoRef,
    localStreamRef,
    audioStreamRef,
    videoStreamRef,
    screenStreamRef,
    mediaRecorderRef,
    recordedChunksRef,
    recordingStopCleanupRef,
    recordingStatsIntervalRef,
    volumeIntervalRef,
    isJoiningRef,
    peersRef,
    socket,
    speakingAudioContextRef,
    speakingDetectorRef,
    speakingValueRef,
    setSpeakingByUserId,
  });

  useMeetingSocketListeners({
    socket,
    t,
    addToast,
    chatScrollRef,
    isChatOpenRef,
    peersRef,
    localStreamRef,
    audioStreamRef,
    setMyRole,
    setRemoteRoles,
    setRoomCreator,
    setIsCreator,
    setIsAudioEnabled,
    setIsVideoEnabled,
    setParticipantMeta,
    setSpeakingByUserId,
    setRemoteStreams,
    setMessages,
    setUnreadCount,
    setSignalingState,
    setConnectionStatus,
    setParticipantConnectionStatus,
    setParticipantStats,
    dispatchLifecycle,
    onForcedExit: () => exitToHome(),
    onSocketReconnected: rejoinCurrentRoom,
    handleRoomSession: ({ token }) => {
      if (!token || !roomId) return;
      setRoomSessionToken(token);
      writeRoomSession(roomId, token);
    },
  });

  useEffect(() => {
    if (uiState !== 'meeting') {
      weakNetworkStrikeCountRef.current = 0;
      autoLowDataAppliedRef.current = false;
      return;
    }

    const unstablePeerCount = Object.values(participantConnectionStatus).filter(
      (status) => status === 'reconnecting' || status === 'failed' || status === 'disconnected',
    ).length;
    const poorPeerCount = Object.values(participantStats).filter(
      (stats) => stats?.quality === 'poor' || stats?.frozen === true,
    ).length;
    const shouldDegrade = unstablePeerCount > 0 || poorPeerCount > 0;

    if (!shouldDegrade) {
      weakNetworkStrikeCountRef.current = 0;
      return;
    }

    weakNetworkStrikeCountRef.current += 1;
    if (weakNetworkStrikeCountRef.current < 2 || isLowDataMode) return;

    void setLowDataModeEnabled(true, { showToast: false }).then((applied) => {
      if (!applied) return;
      if (!autoLowDataAppliedRef.current) {
        autoLowDataAppliedRef.current = true;
        addToast(t('auto_low_data_mode_on') || 'Weak network detected. Low data mode enabled automatically.', 'warning');
        appendSystemMessage(
          t('auto_low_data_mode_on') || 'Weak network detected. Low data mode enabled automatically.',
          'warning',
        );
      }
    });
  }, [uiState, participantStats, participantConnectionStatus, isLowDataMode, setLowDataModeEnabled, t]);

  const {
    emitJoinRoom,
    leaveCurrentRoom,
    requestHighQuality,
    handleKickUser,
    handleMuteUser,
    handleUpdateRole,
    sendMessage,
    handleFileSelect,
    closeAllPeerConnections,
  } = useMeetingRoomActions({
    socket,
    t,
    addToast,
    hasPermission,
    roomId,
    peersRef,
    setMessages,
  });

  const appendSystemMessage = (content, tone = 'notice') => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'system',
        tone,
        content,
        timestamp: Date.now(),
        senderId: 'system',
        senderName: 'System',
      },
    ]);
  };

  const rejoinCurrentRoom = () => {
    if (!hasJoinedMeetingRef.current || hasLeftRoomRef.current || !roomId) return;

    closeAllPeerConnections();
    setRemoteStreams({});
    setRemoteRoles({});
    setParticipantConnectionStatus({});
    setParticipantStats({});
    setConnectionStatus('checking');
    appendSystemMessage(t('reconnecting_status') || 'Reconnecting to the meeting network...', 'warning');

    emitJoinRoom({
      roomId,
      nickname,
      roomPassword,
      createRoomName,
      clientId,
      roomSessionToken: roomSessionTokenRef.current || readRoomSession(roomId),
    });
  };

  const joinRoom = (id) => {
    const targetId = typeof id === 'string' ? id : roomId;
    if (targetId) {
      setJoinRoomIdError(false);
      if (typeof id === 'string') setRoomId(id);
      setUiState('setup');
      dispatchLifecycle({ type: 'user.clickContinue' });
    } else {
        setJoinRoomIdError(true);
        addToast(t('enter_room_id_error'), "error");
    }
  };

  const confirmJoin = async () => {
    try {
      const nick = (nickname || '').trim();
      const pwd = (roomPassword || '').trim();
      if (roomId) {
        if (nick || pwd) {
          writeRoomCreds(roomId, { nickname: nick || null, password: pwd || null });
        } else {
          remove(sessionStorage, roomCredKey(roomId));
        }
      }
    } catch (e) { void e; }
    try {
        dispatchLifecycle({ type: 'user.confirmJoinStart' });
        await prepareJoinMedia();
        
        // Update URL + SessionStorage：支持刷新恢复
        const url = new URL(window.location);
        url.searchParams.set('roomId', roomId);
        window.history.pushState({}, '', url);
        try { markShouldRejoin(sessionStorage, roomId, nickname || null); } catch (e) { void e; }

        // Now switch UI
        setUiState('meeting');
        setJoined(true);
        setLocalJoinedAt(Date.now());
        hasJoinedMeetingRef.current = true;
        hasLeftRoomRef.current = false;
        dispatchLifecycle({ type: 'media.joinSuccess' });
        
        // Emit join after stream is ready so tracks can be added to peer connection immediately
        if (nickname.trim()) {
            localStorage.setItem('username', nickname.trim());
        }
        emitJoinRoom({
          roomId,
          nickname,
          roomPassword,
          createRoomName,
          clientId,
          roomSessionToken: roomSessionTokenRef.current,
        });

    } catch (e) {
        console.error("Error getting user media on join:", e);
        addToast(t('device_access_error'), "error");
        isJoiningRef.current = false;
        dispatchLifecycle({ type: 'media.joinFailure', reason: deviceSetupIssue?.reason || 'unknown' });
        // Do not switch to meeting state if media fails
    }
  };

  const handleCreateMeeting = () => {
      const id = createRoomId;
      if (!id) return;
      setRoomId(id);
      setEntryMode('join');
      setJoinRoomIdError(false);
      setUiState('setup');
  };

  const regenerateCreateRoomId = () => {
      setCreateRoomId(generateNumericRoomId());
  };

  const copyText = async (text) => {
      try {
          await navigator.clipboard.writeText(text);
          addToast(t('copied') || 'Copied', 'success');
      } catch (e) { void e; }
  };

  const handleCloseRoom = () => {
    if (isCreator) {
        setIsLeaveOptionsOpen(true);
    } else {
        if (window.confirm(t('confirm_leave_room') || 'Leave the room?')) {
            exitToHome();
        }
    }
  };

  const leaveAndTransferHost = () => {
      setIsLeaveOptionsOpen(false);
      exitToHome();
  };

  const closeRoomForEveryone = () => {
      setIsLeaveOptionsOpen(false);
      socket.emit('close-room');
      exitToHome();
  };

  useEffect(() => {
      if (!isLeaveOptionsOpen) return;
      const onKeyDown = (e) => {
          if (e.key === 'Escape') setIsLeaveOptionsOpen(false);
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLeaveOptionsOpen]);

  const copyRoomId = () => {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const cleanupMeetingResources = () => {
      hasJoinedMeetingRef.current = false;
      isJoiningRef.current = false;
      cleanupMediaResources();
      closeAllPeerConnections();

      saveFullscreenTileId(localStorage, null);
      setFullscreenTileId(null);
      setExitingFullscreenTileId(null);
      setRemoteStreams({});
      setRemoteRoles({});
      setParticipantMeta({});
      setSpeakingByUserId({});
      setParticipantConnectionStatus({});
      setParticipantStats({});
      setMessages([]);
      setUnreadCount(0);
      setIsChatOpen(false);
      setNewMessage('');
      setIsSharing(false);
      setIsRecording(false);
      setRecordingStats({ seconds: 0, bytes: 0 });
      setIsRecordModeOpen(false);
      setSharePreviewStream(null);
      setIsSharePreviewOpen(false);
      setIsLeaveOptionsOpen(false);
      setMyRole('participant');
      setRoomCreator(null);
      setIsCreator(false);
      setRoomSessionToken('');
      setJoined(false);
  };

  const exitToHome = () => {
      dispatchLifecycle({ type: 'user.leaveMeeting' });
      if (hasJoinedMeetingRef.current && !hasLeftRoomRef.current) {
          leaveCurrentRoom();
          hasLeftRoomRef.current = true;
      }
      cleanupMeetingResources();
      clearRoomSession(roomId);
      try { clearRejoin(sessionStorage); } catch (e) { void e; }
      onBack();
  };

  const normalizedQuery = (activeRoomQuery || '').trim().toLowerCase();
  const visibleRooms = normalizedQuery
    ? activeRooms.filter((room) => {
        const id = String(room?.roomId || '').toLowerCase();
        const creator = String(room?.creatorName || '').toLowerCase();
        return id.includes(normalizedQuery) || creator.includes(normalizedQuery);
      })
    : activeRooms;
  if (uiState === 'welcome') {
      return (
        <WelcomeScreen
          t={t}
          pendingRoomId={pendingRoomId}
          confirmReturnRoom={confirmReturnRoom}
          cancelReturnRoom={cancelReturnRoom}
          exitToHome={exitToHome}
          entryMode={entryMode}
          setEntryMode={setEntryMode}
          roomId={roomId}
          setRoomId={setRoomId}
          setJoinRoomIdError={setJoinRoomIdError}
          joinRoomIdError={joinRoomIdError}
          joinRoom={joinRoom}
          createRoomId={createRoomId}
          setCreateRoomId={setCreateRoomId}
          regenerateCreateRoomId={regenerateCreateRoomId}
          createRoomName={createRoomName}
          setCreateRoomName={setCreateRoomName}
          copyText={copyText}
          handleCreateMeeting={handleCreateMeeting}
          activeRooms={activeRooms}
          visibleRooms={visibleRooms}
          roomIdleTtlMs={roomIdleTtlMs}
          fetchActiveRooms={fetchActiveRooms}
          isLoadingRooms={isLoadingRooms}
          activeRoomQuery={activeRoomQuery}
          setActiveRoomQuery={setActiveRoomQuery}
          onJoinActiveRoom={(room) => {
            const nextRoomId = room.roomId;
            setRoomId(nextRoomId);
            setJoinRoomIdError(false);
            setEntryMode('join');
            setUiState('setup');
            const cached = readRoomCreds(nextRoomId);
            setRoomPassword(typeof cached?.password === 'string' ? cached.password : '');
          }}
        />
      );
  }

  if (uiState === 'setup') {
      return (
        <SetupScreen
          t={t}
          previewVideoRef={previewVideoRef}
          meetingPhase={meetingPhase}
          deviceSetupIssue={deviceSetupIssue}
          isVideoEnabled={isVideoEnabled}
          shouldFlipLocalVideoCss={shouldFlipLocalVideoCss}
          toggleAudio={toggleAudio}
          toggleVideo={toggleVideo}
          volumeLevel={volumeLevel}
          nickname={nickname}
          setNickname={setNickname}
          roomPassword={roomPassword}
          setRoomPassword={setRoomPassword}
          cameras={cameras}
          selectedCameraId={selectedCameraId}
          setSelectedCameraId={setSelectedCameraId}
          mics={mics}
          selectedMicId={selectedMicId}
          setSelectedMicId={setSelectedMicId}
          isLowDataMode={isLowDataMode}
          toggleLowDataMode={toggleLowDataMode}
          resolution={resolution}
          setResolution={setResolution}
          frameRate={frameRate}
          setFrameRate={setFrameRate}
          confirmJoin={confirmJoin}
          setUiState={setUiState}
          isAudioEnabled={isAudioEnabled}
        />
      );
  }

  return (
    <MeetingScreen
      t={t}
      fullscreenHostRef={fullscreenHostRef}
      activeFullscreenTileId={activeFullscreenTileId}
      fullscreenTileId={fullscreenTileId}
      roomId={roomId}
      copied={copied}
      copyRoomId={copyRoomId}
      myRole={myRole}
      isCreator={isCreator}
      handleCloseRoom={handleCloseRoom}
      meetingPhase={meetingPhase}
      signalingState={signalingState}
      remoteStreams={remoteStreams}
      connectionStatus={connectionStatus}
      isChatOpen={isChatOpen}
      setIsChatOpen={setIsChatOpen}
      messages={messages}
      socketId={socket.id}
      chatScrollRef={chatScrollRef}
      fileInputRef={fileInputRef}
      handleFileSelect={handleFileSelect}
      newMessage={newMessage}
      setNewMessage={setNewMessage}
      sendMessage={(event) => sendMessage(event, newMessage, setNewMessage)}
      videoGrid={(
        <MeetingVideoGrid
          t={t}
          orderedTileIds={orderedTileIds}
          isChatOpen={isChatOpen}
          activeFullscreenTileId={activeFullscreenTileId}
          fullscreenTileId={fullscreenTileId}
          fullscreenHostRef={fullscreenHostRef}
          focusedTileId={isSharing ? 'local' : null}
          isAudioEnabled={isAudioEnabled}
          isMirrored={isMirrored}
          setIsMirrored={setIsMirrored}
          toggleFullscreen={toggleFullscreen}
          localVideoRef={localVideoRef}
          localStreamRef={localStreamRef}
          isSharing={isSharing}
          isVideoEnabled={isVideoEnabled}
          shouldFlipLocalVideoCss={shouldFlipLocalVideoCss}
          remoteStreams={remoteStreams}
          participantMeta={participantMeta}
          remoteRoles={remoteRoles}
          participantConnectionStatus={participantConnectionStatus}
          participantStats={participantStats}
          hasPermission={hasPermission}
          handleUpdateRole={handleUpdateRole}
          handleKickUser={handleKickUser}
          handleMuteUser={handleMuteUser}
          requestHighQuality={requestHighQuality}
          roomId={roomId}
        />
      )}
      isAudioEnabled={isAudioEnabled}
      toggleAudio={toggleAudio}
      isVideoEnabled={isVideoEnabled}
      toggleVideo={toggleVideo}
      isSharing={isSharing}
      stopScreenShare={stopScreenShare}
      startScreenShare={startScreenShare}
      isRecording={isRecording}
      stopRecording={stopRecording}
      openRecordingMode={openRecordingMode}
      formatRecordingStats={formatRecordingStats}
      recordingStats={recordingStats}
      isLowDataMode={isLowDataMode}
      toggleLowDataMode={toggleLowDataMode}
      sortMenuRef={sortMenuRef}
      setIsSortMenuOpen={setIsSortMenuOpen}
      isSortMenuOpen={isSortMenuOpen}
      applySortRule={applySortRule}
      sortRule={sortRule}
      unreadCount={unreadCount}
      exitToHome={exitToHome}
      isSharePreviewOpen={isSharePreviewOpen}
      sharePreviewStream={sharePreviewStream}
      cancelScreenShare={cancelScreenShare}
      confirmScreenShare={confirmScreenShare}
      isRecordModeOpen={isRecordModeOpen}
      startRecording={startRecording}
      startCompositeRecording={startCompositeRecording}
      setIsRecordModeOpen={setIsRecordModeOpen}
      isLeaveOptionsOpen={isLeaveOptionsOpen}
      setIsLeaveOptionsOpen={setIsLeaveOptionsOpen}
      leaveAndTransferHost={leaveAndTransferHost}
      closeRoomForEveryone={closeRoomForEveryone}
    />
  );
}

export default WebRTCMeeting;
