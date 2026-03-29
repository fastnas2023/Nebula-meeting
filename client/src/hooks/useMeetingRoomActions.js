export default function useMeetingRoomActions({
  socket,
  t,
  addToast,
  hasPermission,
  roomId,
  peersRef,
  setMessages,
}) {
  const appendSystemMessage = (content, tone = 'notice') => {
    if (!setMessages) return;
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

  const emitJoinRoom = ({ roomId: nextRoomId, nickname, roomPassword, createRoomName, clientId, roomSessionToken }) => {
    const payload = [
      nextRoomId,
      nickname || 'Anonymous',
      (roomPassword || '').trim() || null,
      createRoomName.trim() || null,
      clientId,
    ];
    if (roomSessionToken) payload.push(roomSessionToken);
    socket.emit('join-room', ...payload);
  };

  const leaveCurrentRoom = () => {
    socket.emit('leave-room');
  };

  const requestHighQuality = (targetUserId) => {
    if (!hasPermission('canManageRoles')) {
      addToast(t('permission_denied'), 'error');
      return;
    }
    socket.emit('request-high-quality', { targetUserId });
    addToast(t('high_quality_request_sent'), 'success');
    appendSystemMessage(t('high_quality_request_sent') || 'High quality request sent', 'notice');
  };

  const handleKickUser = (targetUserId) => {
    if (!hasPermission('canKickUsers')) {
      addToast(t('permission_denied'), 'error');
      return;
    }
    socket.emit('kick-user', { targetUserId });
    appendSystemMessage(t('kick_user_tooltip') || 'Participant removed', 'warning');
  };

  const handleMuteUser = (targetUserId, kind, enabled = false) => {
    if (!hasPermission('canMuteOthers')) {
      addToast(t('permission_denied'), 'error');
      return;
    }
    socket.emit('mute-user', { targetUserId, kind, enabled });
    appendSystemMessage(
      enabled
        ? (t('restore_user_audio_tooltip') || 'Participant microphone restored')
        : (t('mute_user_tooltip') || 'Participant muted'),
      'notice',
    );
  };

  const handleUpdateRole = (targetUserId, currentRole) => {
    if (!hasPermission('canManageRoles')) {
      addToast(t('permission_denied'), 'error');
      return;
    }

    let newRole = 'participant';
    if (currentRole === 'participant') newRole = 'host';
    else if (currentRole === 'host') newRole = 'admin';
    else if (currentRole === 'admin') newRole = 'participant';

    socket.emit('update-role', { targetUserId, newRole });
    appendSystemMessage(`${t('role_changed_to') || 'Role changed to'} ${newRole}`, 'notice');
  };

  const sendMessage = (event, newMessage, setNewMessage) => {
    event.preventDefault();
    if (!newMessage.trim()) return;

    socket.emit('send-message', { roomId, message: newMessage });
    setNewMessage('');
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      addToast(t('file_too_large') || 'File too large (Max 50MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result,
      };
      socket.emit('send-file', { roomId, file: fileData });
    };
    reader.readAsDataURL(file);
    event.target.value = null;
  };

  const closeAllPeerConnections = () => {
    Object.values(peersRef.current).forEach((pc) => {
      try { pc.close(); } catch (error) { void error; }
    });
    peersRef.current = {};
  };

  return {
    emitJoinRoom,
    leaveCurrentRoom,
    requestHighQuality,
    handleKickUser,
    handleMuteUser,
    handleUpdateRole,
    sendMessage,
    handleFileSelect,
    closeAllPeerConnections,
  };
}
