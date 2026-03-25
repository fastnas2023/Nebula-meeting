import { useEffect } from 'react';
import { startCompositeRecordingSession, startDisplayRecording, stopMediaRecording } from '../utils/meetingRecording';
import describeDeviceSetupIssue from './describeDeviceSetupIssue';

export default function useInMeetingMedia({
  uiState,
  selectedCameraId,
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
  peersRef,
  socket,
  speakingAudioContextRef,
  speakingDetectorRef,
  speakingValueRef,
  setSpeakingByUserId,
}) {
  const emitOfferForPeer = (peerId, pc) => {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit('offer', {
          target: peerId,
          sdp: pc.localDescription,
          sender: socket.id,
        });
      });
  };

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

  const addTrackToPeers = (track, stream) => {
    Object.keys(peersRef.current).forEach((userId) => {
      const pc = peersRef.current[userId];
      const sender = pc.getSenders().find((candidate) => candidate.track?.kind === track.kind);
      if (sender) {
        sender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
      emitOfferForPeer(userId, pc);
    });
  };

  const removeTrackFromPeers = (kind) => {
    Object.keys(peersRef.current).forEach((userId) => {
      const pc = peersRef.current[userId];
      const sender = pc.getSenders().find((candidate) => candidate.track?.kind === kind);
      if (!sender) return;
      pc.removeTrack(sender);
      emitOfferForPeer(userId, pc);
    });
  };

  useEffect(() => {
    const handleHighQualityRequest = async () => {
      addToast(t('high_quality_requested'), 'info');
      appendSystemMessage(t('high_quality_requested') || 'A host requested higher video quality', 'notice');
      if (isLowDataMode) {
        await toggleLowDataMode();
        return;
      }

      try {
        const track = videoStreamRef.current?.getVideoTracks?.()[0];
        if (track) {
          await track.applyConstraints({
            width: { ideal: 1280, min: 720 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 20 },
          });
        }
      } catch (error) {
        console.error('Failed to apply high quality', error);
      }
    };

    socket.on('request-high-quality', handleHighQualityRequest);
    return () => {
      socket.off('request-high-quality', handleHighQualityRequest);
    };
  }, [isLowDataMode, videoStreamRef, socket, addToast, t]);

  const setLowDataModeEnabled = async (nextMode, options = {}) => {
    const { showToast = true } = options;
    const newMode = !!nextMode;
    if (newMode === isLowDataMode) return true;

    if (uiState === 'setup') {
      setIsLowDataMode(newMode);
      return true;
    }

    if (!isVideoEnabled) {
      setIsLowDataMode(newMode);
      if (showToast) {
        addToast(newMode ? t('low_data_mode_on') : t('low_data_mode_off'), 'info');
      }
      return true;
    }

    try {
      const constraints = {
        video: {
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: newMode ? { ideal: 480 } : (resolution === '1080p' ? { ideal: 1920 } : (resolution === '720p' ? { ideal: 1280 } : { ideal: 640 })),
          height: newMode ? { ideal: 270 } : (resolution === '1080p' ? { ideal: 1080 } : (resolution === '720p' ? { ideal: 720 } : { ideal: 360 })),
          frameRate: newMode ? { ideal: 15 } : { ideal: frameRate },
          aspectRatio: { ideal: 1.7777777778 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const newVideoTrack = stream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      if (newMode) {
        try {
          await newVideoTrack.applyConstraints({
            width: { ideal: 480 },
            height: { ideal: 270 },
            frameRate: 15,
            aspectRatio: 1.7777777778,
          });
        } catch (error) {
          console.warn('Could not apply strict constraints, falling back to soft constraints', error);
        }
      }

      videoStreamRef.current = new MediaStream([newVideoTrack]);

      if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          localStreamRef.current.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        localStreamRef.current.addTrack(newVideoTrack);
      } else {
        localStreamRef.current = new MediaStream([newVideoTrack]);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((candidate) => candidate.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        } else if (localStreamRef.current) {
          pc.addTrack(newVideoTrack, localStreamRef.current);
        }
      });

      setIsLowDataMode(newMode);
      if (showToast) {
        addToast(newMode ? t('low_data_mode_on') : t('low_data_mode_off'), 'info');
      }
      return true;
    } catch (error) {
      console.error('Error switching quality:', error);
      if (showToast) {
        addToast(t('switch_quality_error'), 'error');
      }
      return false;
    }
  };

  const toggleLowDataMode = async () => setLowDataModeEnabled(!isLowDataMode);

  const toggleAudio = () => {
    const newAudioState = !isAudioEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = newAudioState; });
    audioStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = newAudioState; });
    setIsAudioEnabled(newAudioState);
  };

  const toggleVideo = async () => {
    if (isSharing) {
      const newStatus = !isVideoEnabled;
      setIsVideoEnabled(newStatus);
      videoStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = newStatus; });
      return;
    }

    if (isVideoEnabled) {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
        localStreamRef.current.getVideoTracks().forEach((track) => localStreamRef.current.removeTrack(track));
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }
      if (uiState === 'setup' && previewVideoRef.current) {
        previewVideoRef.current.srcObject = null;
      }
      setIsVideoEnabled(false);
      return;
    }

    try {
      const constraints = {
        video: {
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: isLowDataMode ? { ideal: 480 } : (resolution === '1080p' ? { ideal: 1920 } : (resolution === '720p' ? { ideal: 1280 } : { ideal: 640 })),
          height: isLowDataMode ? { ideal: 270 } : (resolution === '1080p' ? { ideal: 1080 } : (resolution === '720p' ? { ideal: 720 } : { ideal: 360 })),
          frameRate: isLowDataMode ? { ideal: 15 } : { ideal: frameRate },
          aspectRatio: { ideal: 1.7777777778 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const newVideoTrack = stream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      videoStreamRef.current = new MediaStream([newVideoTrack]);
      if (uiState === 'setup' && previewVideoRef.current) {
        previewVideoRef.current.srcObject = videoStreamRef.current;
      }

      if (localStreamRef.current) {
        localStreamRef.current.addTrack(newVideoTrack);
      } else {
        localStreamRef.current = new MediaStream([newVideoTrack]);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      Object.entries(peersRef.current).forEach(([peerId, pc]) => {
        const sender = pc.getSenders().find((candidate) => candidate.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
          return;
        }
        if (localStreamRef.current) {
          pc.addTrack(newVideoTrack, localStreamRef.current);
          emitOfferForPeer(peerId, pc);
        }
      });

      setIsVideoEnabled(true);
      setDeviceSetupIssue(null);
    } catch (error) {
      console.error('Error restarting video:', error);
      setDeviceSetupIssue(describeDeviceSetupIssue(error, t));
      addToast(t('device_access_error'), 'error');
    }
  };

  const startScreenShare = async () => {
    if (!hasPermission('canShareScreen')) {
      addToast(t('permission_denied_screen_share'), 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      stream.getVideoTracks()[0].onended = () => {
        if (isSharePreviewOpen) {
          setSharePreviewStream(null);
          setIsSharePreviewOpen(false);
        } else {
          stopScreenShare();
        }
      };

      setSharePreviewStream(stream);
      setIsSharePreviewOpen(true);
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  };

  const confirmScreenShare = () => {
    if (!sharePreviewStream) return;
    const stream = sharePreviewStream;
    screenStreamRef.current = stream;

    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    const videoTrack = stream.getVideoTracks()[0];
    localStreamRef.current.addTrack(videoTrack);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setIsSharing(true);
    appendSystemMessage(t('share_focus_mode_notice') || 'Screen sharing started. Focus mode enabled.', 'notice');
    addTrackToPeers(videoTrack, localStreamRef.current);
    setIsSharePreviewOpen(false);
    setSharePreviewStream(null);

    videoTrack.onended = () => {
      stopScreenShare();
    };
  };

  const cancelScreenShare = () => {
    sharePreviewStream?.getTracks().forEach((track) => track.stop());
    setSharePreviewStream(null);
    setIsSharePreviewOpen(false);
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;

    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        localStreamRef.current.removeTrack(videoTrack);
      }
    }

    setIsSharing(false);
    appendSystemMessage(t('share_focus_mode_end_notice') || 'Screen sharing stopped. Returning to grid view.', 'notice');

    if (videoStreamRef.current && videoStreamRef.current.getVideoTracks().length > 0) {
      const cameraTrack = videoStreamRef.current.getVideoTracks()[0];
      cameraTrack.enabled = isVideoEnabled;

      if (localStreamRef.current) {
        localStreamRef.current.addTrack(cameraTrack);
      }

      addTrackToPeers(cameraTrack, localStreamRef.current);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      return;
    }

    removeTrackFromPeers('video');
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  };

  const startRecording = async () => {
    if (!hasPermission('canRecord')) {
      addToast(t('permission_denied_record'), 'error');
      return;
    }

    await startDisplayRecording({
      mediaRecorderRef,
      recordedChunksRef,
      recordingStatsIntervalRef,
      recordingStopCleanupRef,
      setRecordingStats,
      setIsRecording,
      setIsRecordModeOpen,
      addToast,
      startedMessage: t('recording_started'),
      savedMessage: t('recording_saved'),
      errorMessage: t('recording_error'),
      onStopRequested: () => stopRecording(),
    });
  };

  const stopRecording = () => {
    stopMediaRecording(mediaRecorderRef);
  };

  const startCompositeRecording = async () => {
    if (!hasPermission('canRecord')) {
      addToast(t('permission_denied_record'), 'error');
      return;
    }

    const tiles = activeFullscreenTileId ? [activeFullscreenTileId] : orderedTileIds;
    const getStreamById = (id) => (id === 'local' ? localStreamRef.current : remoteStreams[id]);

    await startCompositeRecordingSession({
      tileIds: tiles,
      getStreamById,
      mediaRecorderRef,
      recordedChunksRef,
      recordingStatsIntervalRef,
      recordingStopCleanupRef,
      setRecordingStats,
      setIsRecording,
      setIsRecordModeOpen,
      addToast,
      startedMessage: t('recording_started'),
      savedMessage: t('recording_saved'),
      errorMessage: t('recording_error'),
    });
  };

  const openRecordingMode = () => setIsRecordModeOpen(true);

  const cleanupMediaResources = () => {
    try {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        }
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      }
    } catch (error) { void error; }

    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];

    if (recordingStatsIntervalRef.current) {
      clearInterval(recordingStatsIntervalRef.current);
      recordingStatsIntervalRef.current = null;
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    if (recordingStopCleanupRef.current) {
      try { recordingStopCleanupRef.current(); } catch (error) { void error; }
      recordingStopCleanupRef.current = null;
    }

    Object.keys(speakingDetectorRef.current).forEach((id) => {
      const detector = speakingDetectorRef.current[id];
      if (detector?.intervalId) clearInterval(detector.intervalId);
      try { detector?.source?.disconnect?.(); } catch (error) { void error; }
      try { detector?.analyser?.disconnect?.(); } catch (error) { void error; }
      delete speakingDetectorRef.current[id];
    });
    speakingValueRef.current = {};
    if (speakingAudioContextRef.current) {
      try { speakingAudioContextRef.current.close(); } catch (error) { void error; }
      speakingAudioContextRef.current = null;
    }
    setSpeakingByUserId({});

    sharePreviewStream?.getTracks().forEach((track) => track.stop());
    [screenStreamRef, localStreamRef, videoStreamRef, audioStreamRef].forEach((streamRef) => {
      if (!streamRef.current) return;
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    });

    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  };

  return {
    setLowDataModeEnabled,
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
  };
}
