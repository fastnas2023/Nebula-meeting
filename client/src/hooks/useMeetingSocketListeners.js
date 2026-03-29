import { useEffect, useRef } from 'react';

export const defaultRtcConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun.qq.com:3478',
        'stun:stun.aliyun.com:3478',
        'stun:stun.miwifi.com:3478',
      ],
    },
  ],
};

function createSystemMessage(content, tone = 'system') {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'system',
    tone,
    content,
    timestamp: Date.now(),
    senderId: 'system',
    senderName: 'System',
  };
}

export default function useMeetingSocketListeners({
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
  onForcedExit,
  onSocketReconnected,
  handleRoomSession,
  rtcConfiguration,
}) {
  const rtcConfigurationRef = useRef(defaultRtcConfiguration);

  useEffect(() => {
    const nextConfig = rtcConfiguration?.iceServers?.length
      ? rtcConfiguration
      : defaultRtcConfiguration;
    rtcConfigurationRef.current = nextConfig;
  }, [rtcConfiguration]);

  const appendSystemMessage = (content, tone = 'system') => {
    setMessages((prev) => [...prev, createSystemMessage(content, tone)]);
  };

  const clearPeerStats = (targetId, pc) => {
    if (pc?.__statsTimer) {
      clearInterval(pc.__statsTimer);
      pc.__statsTimer = null;
    }
    if (setParticipantStats) {
      setParticipantStats((prev) => {
        if (!prev[targetId]) return prev;
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    }
  };

  const classifyQuality = ({ rttMs, packetLossPct, bitrateKbps, frozen }) => {
    if (frozen || packetLossPct >= 8 || rttMs >= 650 || bitrateKbps <= 120) return 'poor';
    if (packetLossPct >= 3 || rttMs >= 300 || bitrateKbps <= 250) return 'fair';
    return 'good';
  };

  const pollPeerStats = async (targetId, pc) => {
    if (!pc || typeof pc.getStats !== 'function') return;
    if (pc.connectionState === 'closed') {
      clearPeerStats(targetId, pc);
      return;
    }

    try {
      const report = await pc.getStats();
      let inboundVideo = null;
      let selectedPair = null;

      report.forEach((stat) => {
        if (
          stat.type === 'candidate-pair'
          && (stat.nominated || stat.selected || stat.state === 'succeeded')
          && typeof stat.currentRoundTripTime === 'number'
        ) {
          selectedPair = stat;
        }

        if (stat.type === 'inbound-rtp' && stat.kind === 'video' && !stat.isRemote) {
          inboundVideo = stat;
        }
      });

      const now = Date.now();
      const previous = pc.__statsSnapshot || {};
      const bytesReceived = inboundVideo?.bytesReceived || 0;
      const framesDecoded = inboundVideo?.framesDecoded || 0;
      const elapsedMs = previous.timestamp ? Math.max(1, now - previous.timestamp) : 0;
      const bitrateKbps = elapsedMs
        ? Math.max(0, Math.round((((bytesReceived - (previous.bytesReceived || 0)) * 8) / (elapsedMs / 1000)) / 1000))
        : 0;
      const packetsLost = inboundVideo?.packetsLost || 0;
      const packetsReceived = inboundVideo?.packetsReceived || 0;
      const totalPackets = packetsLost + packetsReceived;
      const packetLossPct = totalPackets > 0 ? Number(((packetsLost / totalPackets) * 100).toFixed(1)) : 0;
      const rttMs = typeof selectedPair?.currentRoundTripTime === 'number'
        ? Math.round(selectedPair.currentRoundTripTime * 1000)
        : null;
      const stagnantCount = (
        previous.framesDecoded === framesDecoded
        && pc.connectionState === 'connected'
        && bytesReceived > 0
      )
        ? (previous.stagnantCount || 0) + 1
        : 0;
      const frozen = stagnantCount >= 3 && bitrateKbps <= 80;
      const quality = classifyQuality({
        rttMs: rttMs ?? 0,
        packetLossPct,
        bitrateKbps,
        frozen,
      });

      pc.__statsSnapshot = {
        timestamp: now,
        bytesReceived,
        framesDecoded,
        stagnantCount,
      };

      if (setParticipantStats) {
        setParticipantStats((prev) => ({
          ...prev,
          [targetId]: {
            rttMs,
            packetLossPct,
            bitrateKbps,
            frozen,
            quality,
            updatedAt: now,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to collect peer stats', error);
    }
  };

  const schedulePeerStats = (targetId, pc) => {
    clearPeerStats(targetId, pc);
    pc.__statsSnapshot = null;
    pc.__statsTimer = setInterval(() => {
      void pollPeerStats(targetId, pc);
    }, 4000);
    void pollPeerStats(targetId, pc);
  };

  const attemptIceRestart = (targetId, pc) => {
    if (!pc || pc.signalingState === 'closed') return;
    const now = Date.now();
    if (pc.__lastIceRestartAt && now - pc.__lastIceRestartAt < 5000) return;
    pc.__lastIceRestartAt = now;

    pc.createOffer({ iceRestart: true })
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit('offer', {
          target: targetId,
          sdp: pc.localDescription,
          sender: socket.id,
        });
      })
      .catch((error) => console.error('Error restarting ICE:', error));
  };

  const createPeerConnection = (targetId, isInitiator) => {
    if (peersRef.current[targetId]) {
      try { peersRef.current[targetId].close(); } catch (error) { void error; }
      clearPeerStats(targetId, peersRef.current[targetId]);
    }

    const pc = new RTCPeerConnection(rtcConfigurationRef.current);
    peersRef.current[targetId] = pc;
    setParticipantConnectionStatus((prev) => ({ ...prev, [targetId]: 'connecting' }));
    schedulePeerStats(targetId, pc);

    pc.onconnectionstatechange = () => {
      const nextState = pc.connectionState;
      setConnectionStatus(nextState);
      setParticipantConnectionStatus((prev) => ({ ...prev, [targetId]: nextState }));
      dispatchLifecycle({ type: 'peer.connectionState', state: nextState, peerId: targetId });

      if (nextState === 'closed' || nextState === 'failed') {
        addToast(t('connection_lost', { targetId }), 'error');
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        if (peersRef.current[targetId]) {
          delete peersRef.current[targetId];
        }
        clearPeerStats(targetId, pc);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const nextState = pc.iceConnectionState;
      dispatchLifecycle({ type: 'peer.iceState', state: nextState, peerId: targetId, isInitiator });
      if (nextState === 'connected' || nextState === 'completed') {
        setParticipantConnectionStatus((prev) => ({ ...prev, [targetId]: 'connected' }));
        void pollPeerStats(targetId, pc);
        return;
      }

      if (nextState === 'checking') {
        setParticipantConnectionStatus((prev) => ({ ...prev, [targetId]: 'checking' }));
        return;
      }

      if (nextState === 'failed' || nextState === 'closed') {
        setParticipantConnectionStatus((prev) => ({ ...prev, [targetId]: nextState }));
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        if (peersRef.current[targetId]) {
          peersRef.current[targetId].close();
          delete peersRef.current[targetId];
        }
        clearPeerStats(targetId, pc);
        return;
      }

      if (nextState === 'disconnected') {
        setParticipantConnectionStatus((prev) => ({ ...prev, [targetId]: 'reconnecting' }));
        addToast(t('connection_unstable', { targetId }), 'warning');
        if (isInitiator) {
          attemptIceRestart(targetId, pc);
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit('ice-candidate', {
        target: targetId,
        candidate: event.candidate,
        sender: socket.id,
      });
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [targetId]: event.streams[0],
      }));
      setParticipantConnectionStatus((prev) => ({ ...prev, [targetId]: 'connected' }));
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    } else if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, audioStreamRef.current));
    }

    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('offer', {
            target: targetId,
            sdp: pc.localDescription,
            sender: socket.id,
          });
        });
    }

    return pc;
  };

  useEffect(() => {
    const onConnect = () => {
      setSignalingState('connected');
      dispatchLifecycle({ type: 'socket.connected' });
      if (typeof onSocketReconnected === 'function') {
        onSocketReconnected();
      }
    };
    const onDisconnect = () => {
      setSignalingState('disconnected');
      addToast(t('disconnected_signaling'), 'error');
      dispatchLifecycle({ type: 'socket.disconnected' });
      appendSystemMessage(t('disconnected_signaling') || 'Signaling disconnected', 'warning');
    };
    const onConnectError = (error) => {
      console.error('Signaling server connection error:', error);
      setSignalingState('disconnected');
      addToast(t('signaling_error'), 'error');
      dispatchLifecycle({ type: 'socket.connectError' });
    };
    const onError = (message) => {
      addToast(message, 'error');
    };
    const onRoleAssigned = (role) => {
      setMyRole(role);
      addToast(`${t('role_assigned')}: ${role}`, 'info');
    };
    const onRoleUpdated = ({ userId, newRole }) => {
      if (userId === socket.id) {
        setMyRole(newRole);
        addToast(`${t('role_changed_to')} ${newRole}`, 'info');
        appendSystemMessage(`${t('role_changed_to') || 'Role changed to'} ${newRole}`, 'notice');
        return;
      }
      setRemoteRoles((prev) => ({
        ...prev,
        [userId]: newRole,
      }));
      appendSystemMessage(`${t('role_changed_to') || 'Role changed to'} ${newRole}`, 'notice');
    };
    const onRoomInfo = (roomInfo) => {
      setRoomCreator(roomInfo.creator);
      setIsCreator(roomInfo.isCreator === true || roomInfo.creator === socket.id);
    };
    const onRoomSessionEvent = (payload) => {
      if (payload?.token && typeof handleRoomSession === 'function') {
        handleRoomSession(payload);
      }
    };
    const onRoomClosed = () => {
      addToast(t('room_closed'), 'error');
      dispatchLifecycle({ type: 'room.closed' });
      appendSystemMessage(t('room_closed') || 'Room closed', 'warning');
      onForcedExit();
    };
    const onUserKicked = ({ targetUserId }) => {
      if (targetUserId === socket.id) {
        addToast(t('you_were_kicked'), 'error');
        dispatchLifecycle({ type: 'room.kicked', isSelf: true });
        appendSystemMessage(t('you_were_kicked') || 'You were removed by host', 'warning');
        onForcedExit();
      } else {
        addToast(t('user_kicked_msg'), 'info');
        appendSystemMessage(t('user_kicked_msg') || 'A participant was removed', 'notice');
      }
    };
    const onUserMuted = ({ targetUserId, kind, enabled }) => {
      if (targetUserId !== socket.id) return;
      const nextEnabled = typeof enabled === 'boolean' ? enabled : false;
      if (kind === 'audio') {
        localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = nextEnabled; });
        audioStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = nextEnabled; });
        setIsAudioEnabled(nextEnabled);
        if (nextEnabled) {
          addToast(t('you_were_unmuted_audio') || 'Your microphone was restored by host', 'info');
          appendSystemMessage(t('you_were_unmuted_audio') || 'Your microphone was restored by host', 'notice');
        } else {
          addToast(t('you_were_muted_audio'), 'warning');
          appendSystemMessage(t('you_were_muted_audio') || 'Your microphone was muted by host', 'warning');
        }
        return;
      }
      if (kind === 'video') {
        localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = nextEnabled; });
        setIsVideoEnabled(nextEnabled);
        if (nextEnabled) {
          addToast(t('you_were_unmuted_video') || 'Your camera was restored by host', 'info');
          appendSystemMessage(t('you_were_unmuted_video') || 'Your camera was restored by host', 'notice');
        } else {
          addToast(t('you_were_muted_video'), 'warning');
          appendSystemMessage(t('you_were_muted_video') || 'Your camera was disabled by host', 'warning');
        }
      }
    };
    const onRoomUsers = (users) => {
      if (!Array.isArray(users)) return;
      setParticipantMeta((prev) => {
        const next = { ...prev };
        users.forEach((user) => {
          if (!user?.userId || user.userId === socket.id) return;
          next[user.userId] = {
            name: user.username || 'Anonymous',
            joinedAt: typeof user.joinedAt === 'number' ? user.joinedAt : Date.now(),
          };
        });
        return next;
      });
    };
    const onUserReconnecting = ({ userId, username }) => {
      if (!userId) return;
      setParticipantConnectionStatus((prev) => ({ ...prev, [userId]: 'reconnecting' }));
      appendSystemMessage(`${username || 'Anonymous'} ${t('reconnecting_status_short') || 'is reconnecting'}`, 'warning');
    };
    const onUserConnected = (payload) => {
      const userId = typeof payload === 'string' ? payload : payload?.userId;
      if (!userId) return;

      if (typeof payload === 'object' && payload) {
        setParticipantMeta((prev) => ({
          ...prev,
          [userId]: {
            name: payload.username || 'Anonymous',
            joinedAt: typeof payload.joinedAt === 'number' ? payload.joinedAt : Date.now(),
          },
        }));
        appendSystemMessage(`${payload.username || 'Anonymous'} ${t('joined_room_notice') || 'joined the room'}`, 'notice');
      }

      createPeerConnection(userId, true);
    };
    const onUserReconnected = (payload) => {
      const { oldUserId, newUserId, username, joinedAt } = payload || {};
      if (!oldUserId || !newUserId || oldUserId === newUserId) return;

      if (peersRef.current[oldUserId]) {
        try { peersRef.current[oldUserId].close(); } catch (error) { void error; }
        clearPeerStats(oldUserId, peersRef.current[oldUserId]);
        delete peersRef.current[oldUserId];
      }

      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[oldUserId];
        return next;
      });
      setRemoteRoles((prev) => {
        const next = { ...prev };
        const existing = next[oldUserId];
        delete next[oldUserId];
        if (existing) next[newUserId] = existing;
        return next;
      });
      setParticipantMeta((prev) => {
        const next = { ...prev };
        const existing = next[oldUserId];
        delete next[oldUserId];
        next[newUserId] = {
          name: username || existing?.name || 'Anonymous',
          joinedAt: typeof joinedAt === 'number' ? joinedAt : (existing?.joinedAt || Date.now()),
        };
        return next;
      });
      setSpeakingByUserId((prev) => {
        const next = { ...prev };
        delete next[oldUserId];
        return next;
      });
      setParticipantConnectionStatus((prev) => {
        const next = { ...prev };
        delete next[oldUserId];
        next[newUserId] = 'reconnecting';
        return next;
      });
      clearPeerStats(oldUserId, null);
      appendSystemMessage(`${username || 'Anonymous'} ${t('reconnected_status_short') || 'reconnected'}`, 'notice');
      createPeerConnection(newUserId, true);
    };
    const onUserDisconnected = (userId) => {
      if (peersRef.current[userId]) {
        clearPeerStats(userId, peersRef.current[userId]);
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }

      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setRemoteRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setParticipantMeta((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setSpeakingByUserId((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setParticipantConnectionStatus((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      addToast(t('user_left_msg', { userId }), 'info');
      appendSystemMessage(t('user_left_msg', { userId }) || `${userId} left the room`, 'notice');
    };
    const onOffer = async (payload) => {
      const pc = peersRef.current[payload.sender] || createPeerConnection(payload.sender, false);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { target: payload.sender, sdp: answer, sender: socket.id });
    };
    const onAnswer = async (payload) => {
      const pc = peersRef.current[payload.sender];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      }
    };
    const onIceCandidate = async (payload) => {
      const pc = peersRef.current[payload.sender];
      if (!pc || !payload.candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (error) {
        console.error('Error adding received ice candidate', error);
      }
    };
    const onReceiveMessage = (message) => {
      setMessages((prev) => [...prev, message]);
      if (!isChatOpenRef.current) {
        setUnreadCount((prev) => prev + 1);
      } else {
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 100);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('error', onError);
    socket.on('role-assigned', onRoleAssigned);
    socket.on('role-updated', onRoleUpdated);
    socket.on('room-info', onRoomInfo);
    socket.on('room-session', onRoomSessionEvent);
    socket.on('room-closed', onRoomClosed);
    socket.on('user-kicked', onUserKicked);
    socket.on('user-muted', onUserMuted);
    socket.on('room-users', onRoomUsers);
    socket.on('user-reconnecting', onUserReconnecting);
    socket.on('user-connected', onUserConnected);
    socket.on('user-reconnected', onUserReconnected);
    socket.on('user-disconnected', onUserDisconnected);
    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('receive-message', onReceiveMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('error', onError);
      socket.off('role-assigned', onRoleAssigned);
      socket.off('role-updated', onRoleUpdated);
      socket.off('room-info', onRoomInfo);
      socket.off('room-session', onRoomSessionEvent);
      socket.off('room-closed', onRoomClosed);
      socket.off('user-kicked', onUserKicked);
      socket.off('user-muted', onUserMuted);
      socket.off('room-users', onRoomUsers);
      socket.off('user-reconnecting', onUserReconnecting);
      socket.off('user-connected', onUserConnected);
      socket.off('user-reconnected', onUserReconnected);
      socket.off('user-disconnected', onUserDisconnected);
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('receive-message', onReceiveMessage);
    };
  }, []);
}
