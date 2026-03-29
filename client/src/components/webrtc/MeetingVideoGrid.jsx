import { Activity, Clock3, Crown, FlipHorizontal, Maximize2, MicOff, Minimize2, RotateCw, Shield, TriangleAlert, Users, VideoOff, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ZoomableVideoContainer from '../ZoomableVideoContainer';
import VideoTile from '../VideoTile';
import ParticipantTileActions from './ParticipantTileActions';
import { detectMobileEdgeBrowser, detectTouchCapableDevice } from '../../utils/browserSupport';

function configureInlineVideoPlayback(video, { muted = false } = {}) {
  if (!video) return;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = muted;
  video.defaultMuted = muted;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('x5-playsinline', 'true');
  video.setAttribute('x5-video-player-type', 'h5-page');
  video.setAttribute('x5-video-player-fullscreen', 'false');
  video.setAttribute('x-webkit-airplay', 'allow');
}

async function requestVideoPlayback(video) {
  if (!video || typeof video.play !== 'function') return;
  try {
    const maybePromise = video.play();
    if (maybePromise && typeof maybePromise.catch === 'function') {
      await maybePromise.catch(() => {});
    }
  } catch {}
}

function shouldPreferCanvasFallback() {
  return detectMobileEdgeBrowser();
}

function StreamVideo({ stream, className, muted = false, externalRef = null }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [useCanvasFallback, setUseCanvasFallback] = useState(false);

  useEffect(() => {
    setUseCanvasFallback(shouldPreferCanvasFallback());
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (externalRef) {
      externalRef.current = video;
    }

    configureInlineVideoPlayback(video, { muted });

    if (video.srcObject !== stream) {
      video.srcObject = stream || null;
    }

    let stalledTicks = 0;
    let lastCurrentTime = -1;
    let lastFrameAt = Date.now();
    let cancelVideoFrameCallback = null;

    const handleReady = () => {
      lastFrameAt = Date.now();
      void requestVideoPlayback(video);
    };
    const recoverPlayback = () => {
      if (!video.srcObject && stream) {
        video.srcObject = stream;
      }
      configureInlineVideoPlayback(video, { muted });
      if (!video.paused || video.readyState >= 2) {
        void requestVideoPlayback(video);
        return;
      }
      void requestVideoPlayback(video);
    };
    const onFrame = () => {
      lastFrameAt = Date.now();
      if (typeof video.requestVideoFrameCallback === 'function') {
        const callbackId = video.requestVideoFrameCallback(() => {
          onFrame();
        });
        cancelVideoFrameCallback = () => {
          if (typeof video.cancelVideoFrameCallback === 'function') {
            video.cancelVideoFrameCallback(callbackId);
          }
        };
      }
    };

    if (typeof video.requestVideoFrameCallback === 'function') {
      onFrame();
    }

    video.addEventListener('loadedmetadata', handleReady);
    video.addEventListener('canplay', handleReady);
    video.addEventListener('pause', recoverPlayback);
    video.addEventListener('playing', handleReady);
    document.addEventListener('visibilitychange', recoverPlayback);
    window.addEventListener('focus', recoverPlayback);
    window.addEventListener('pageshow', recoverPlayback);
    const watchdogId = window.setInterval(() => {
      recoverPlayback();

      const hasLiveVideoTrack = !!stream?.getVideoTracks?.().some((track) => track.readyState === 'live');
      if (!hasLiveVideoTrack) {
        stalledTicks = 0;
        lastCurrentTime = -1;
        return;
      }

      if (video.readyState >= 2 && video.videoWidth > 0 && video.currentTime === lastCurrentTime) {
        stalledTicks += 1;
      } else {
        stalledTicks = 0;
      }
      lastCurrentTime = video.currentTime;

      const frameSilenceMs = Date.now() - lastFrameAt;
      if ((stalledTicks >= 3 || frameSilenceMs >= 3500) && detectTouchCapableDevice()) {
        setUseCanvasFallback(true);
      }
    }, 1500);
    void requestVideoPlayback(video);

    return () => {
      cancelVideoFrameCallback?.();
      video.removeEventListener('loadedmetadata', handleReady);
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('pause', recoverPlayback);
      video.removeEventListener('playing', handleReady);
      document.removeEventListener('visibilitychange', recoverPlayback);
      window.removeEventListener('focus', recoverPlayback);
      window.removeEventListener('pageshow', recoverPlayback);
      window.clearInterval(watchdogId);
      if (externalRef?.current === video) {
        externalRef.current = null;
      }
    };
  }, [stream, muted, externalRef]);

  useEffect(() => {
    if (!useCanvasFallback) return undefined;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return undefined;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return undefined;

    let animationFrameId = 0;
    let lastDrawAt = 0;
    const targetFrameInterval = 1000 / 15;

    const drawFrame = (now = 0) => {
      if (now - lastDrawAt >= targetFrameInterval) {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          lastDrawAt = now;
        }
      }

      animationFrameId = window.requestAnimationFrame(drawFrame);
    };

    animationFrameId = window.requestAnimationFrame(drawFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [useCanvasFallback, stream]);

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        disablePictureInPicture
        controls={false}
        className={useCanvasFallback ? 'pointer-events-none absolute inset-0 h-full w-full opacity-0' : className}
      />
      {useCanvasFallback ? (
        <canvas
          ref={canvasRef}
          className={className}
        />
      ) : null}
    </div>
  );
}

function MeetingVideoGrid({
  t,
  orderedTileIds,
  isChatOpen,
  activeFullscreenTileId,
  fullscreenTileId,
  fullscreenHostRef,
  focusedTileId,
  isAudioEnabled,
  isMirrored,
  setIsMirrored,
  toggleFullscreen,
  localVideoRef,
  localStreamRef,
  isSharing,
  isVideoEnabled,
  shouldFlipLocalVideoCss,
  remoteStreams,
  participantMeta,
  remoteRoles,
  participantConnectionStatus,
  participantStats,
  hasPermission,
  handleUpdateRole,
  handleKickUser,
  handleMuteUser,
  requestHighQuality,
  roomId,
}) {
  const [isMobileEdge, setIsMobileEdge] = useState(false);

  useEffect(() => {
    setIsMobileEdge(detectMobileEdgeBrowser());
  }, []);

  const participantTileIds = orderedTileIds.filter((id) => id !== 'local');
  const remoteStreamCount = Object.keys(remoteStreams).length;
  const remoteParticipantCount = participantTileIds.length;
  const shouldHideLocalTile = isMobileEdge && remoteParticipantCount > 0;
  const displayedTileIds = shouldHideLocalTile ? participantTileIds : orderedTileIds;
  const edgeCompactMode = isMobileEdge && remoteParticipantCount > 0;
  const focusModeActive = !!focusedTileId && displayedTileIds.includes(focusedTileId);
  const secondaryTileIds = focusModeActive ? displayedTileIds.filter((id) => id !== focusedTileId) : [];

  const qualityBadge = (stats) => {
    if (!stats?.quality) return null;

    if (stats.quality === 'poor') {
      return {
        icon: TriangleAlert,
        label: t('network_quality_poor') || 'Poor',
        className: 'bg-red-500/20 text-red-100 border-red-500/20',
      };
    }

    if (stats.quality === 'fair') {
      return {
        icon: WifiOff,
        label: t('network_quality_fair') || 'Fair',
        className: 'bg-amber-500/20 text-amber-100 border-amber-500/20',
      };
    }

    return {
      icon: Wifi,
      label: t('network_quality_good') || 'Good',
      className: 'bg-emerald-500/20 text-emerald-100 border-emerald-500/20',
    };
  };

  const renderParticipantPlaceholder = ({ displayName, peerStatus, peerStats, mutedVideo }) => {
    const initials = (displayName || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || '?';

    const reconnecting = peerStatus === 'reconnecting' || peerStatus === 'checking' || peerStatus === 'connecting';
    const statusCopy = reconnecting
      ? (t('participant_reconnecting_desc') || 'Reconnecting to audio and video...')
      : mutedVideo
        ? (t('camera_off') || 'Camera off')
        : (t('waiting_for_video_stream') || 'Waiting for video stream...');

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_40%),rgba(2,6,23,0.88)] px-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-3xl font-bold text-white shadow-lg">
          {initials}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
            {reconnecting ? <RotateCw size={16} className="animate-spin text-amber-300" /> : <VideoOff size={16} className="text-gray-300" />}
            <span>{statusCopy}</span>
          </div>
          {peerStats ? (
            <p className="text-xs text-gray-400">
              {[
                typeof peerStats.rttMs === 'number' ? `${peerStats.rttMs}ms RTT` : null,
                typeof peerStats.packetLossPct === 'number' ? `${peerStats.packetLossPct}% loss` : null,
                typeof peerStats.bitrateKbps === 'number' ? `${peerStats.bitrateKbps} kbps` : null,
              ].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  const renderTile = (tileId) => {
    if (tileId === 'local') {
      return (
        <VideoTile
          key="local"
          tileId="local"
          mode={
            activeFullscreenTileId === 'local'
              ? (fullscreenTileId === 'local' ? 'fullscreen' : 'exiting')
              : 'grid'
          }
          controlsAlwaysVisible={activeFullscreenTileId === 'local'}
          compactMobile={edgeCompactMode}
          portalTarget={fullscreenHostRef.current}
          title={t('you')}
          topLeftExtra={
            <div className="flex items-center gap-2">
              {!isAudioEnabled ? <MicOff size={12} className="text-red-500" /> : null}
              {isSharing ? (
                <div className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-100">
                  {t('sharing_focus_badge') || 'Sharing'}
                </div>
              ) : null}
            </div>
          }
          topRightControls={
            <>
              {!edgeCompactMode ? (
                <button
                  onClick={() => setIsMirrored(!isMirrored)}
                  className="p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-lg border border-white/10"
                  title={t('toggle_mirror') || 'Toggle Mirror'}
                >
                  <FlipHorizontal size={16} className={isMirrored ? 'text-blue-400' : 'text-white'} />
                </button>
              ) : null}
              <button
                onClick={() => toggleFullscreen('local')}
                className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg border border-white/10"
                title={activeFullscreenTileId === 'local' ? (t('restore_video') || 'Restore') : (t('fullscreen_video') || 'Fullscreen')}
              >
                {activeFullscreenTileId === 'local' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </>
          }
        >
          <ZoomableVideoContainer>
            <StreamVideo
              stream={localStreamRef.current}
              externalRef={localVideoRef}
              muted
              className={`w-full h-full object-contain ${shouldFlipLocalVideoCss ? 'transform scale-x-[-1]' : ''} ${!isSharing && !isVideoEnabled ? 'hidden' : ''}`}
            />
          </ZoomableVideoContainer>

          {(!isSharing && (!localStreamRef.current || localStreamRef.current.getVideoTracks().length === 0 || !isVideoEnabled)) && (
            <div className="flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg mb-4">
                {t('me_placeholder')}
              </div>
              <p className="text-gray-500 text-sm">{t('camera_off')}</p>
            </div>
          )}
        </VideoTile>
      );
    }

    const userId = tileId;
    const stream = remoteStreams[userId];
    if (!stream) return null;
    const displayName = participantMeta[userId]?.name || t('user_label', { userId: userId.slice(0, 4) });
    const remoteRole = remoteRoles[userId];
    const peerStatus = participantConnectionStatus[userId];
    const peerStats = participantStats[userId];
    const hasAudioTrack = stream?.getAudioTracks().length > 0;
    const hasVideoTrack = stream?.getVideoTracks().length > 0;
    const mutedAudio = hasAudioTrack && stream.getAudioTracks().every((track) => track.muted || track.enabled === false);
    const mutedVideo = hasVideoTrack && stream.getVideoTracks().every((track) => track.muted || track.enabled === false);
    const quality = qualityBadge(peerStats);
    const statusTone = peerStatus === 'connected'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
      : peerStatus === 'unstable' || peerStatus === 'disconnected' || peerStatus === 'reconnecting'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
        : peerStatus === 'failed'
          ? 'bg-red-500/15 text-red-300 border-red-500/20'
          : 'bg-gray-500/15 text-gray-300 border-gray-500/20';

    if (!stream && !participantMeta[userId] && !peerStatus) return null;

    return (
        <VideoTile
          key={userId}
          tileId={userId}
        mode={
          activeFullscreenTileId === userId
            ? (fullscreenTileId === userId ? 'fullscreen' : 'exiting')
            : 'grid'
        }
          controlsAlwaysVisible={activeFullscreenTileId === userId}
          compactMobile={edgeCompactMode}
          portalTarget={fullscreenHostRef.current}
          title={displayName}
          topLeftExtra={
          <div className={`flex items-center ${edgeCompactMode ? 'gap-1' : 'gap-2'}`}>
            {remoteRole ? (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                remoteRole === 'admin' ? 'bg-purple-500/80 text-white' :
                remoteRole === 'host' ? 'bg-orange-500/80 text-white' :
                'bg-blue-500/50 text-white'
              }`}>
                {remoteRole === 'admin' && <Shield size={8} />}
                {remoteRole === 'host' && <Crown size={8} />}
                {remoteRole}
              </div>
            ) : null}
            {peerStatus ? (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] uppercase font-medium ${statusTone}`}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                {peerStatus}
              </div>
            ) : null}
            {!edgeCompactMode && quality ? (
              <div
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${quality.className}`}
                title={[
                  peerStats.rttMs ? `RTT ${peerStats.rttMs}ms` : null,
                  typeof peerStats.packetLossPct === 'number' ? `Loss ${peerStats.packetLossPct}%` : null,
                  typeof peerStats.bitrateKbps === 'number' ? `${peerStats.bitrateKbps} kbps` : null,
                ].filter(Boolean).join(' · ')}
              >
                <quality.icon size={11} />
                {quality.label}
              </div>
            ) : null}
            {!edgeCompactMode && peerStats?.rttMs >= 500 ? (
              <div className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-100">
                <Clock3 size={11} />
                {peerStats.rttMs}ms
              </div>
            ) : null}
            {!edgeCompactMode && typeof peerStats?.packetLossPct === 'number' && peerStats.packetLossPct >= 3 ? (
              <div className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-100">
                <Activity size={11} />
                {peerStats.packetLossPct}% loss
              </div>
            ) : null}
            {!edgeCompactMode && peerStats?.frozen ? (
              <div className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-100">
                <VideoOff size={11} />
                {t('video_frozen_badge') || 'Frozen'}
              </div>
            ) : null}
            {mutedAudio ? (
              <div className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-yellow-100">
                {t('audio_off_badge') || 'Audio off'}
              </div>
            ) : null}
            {!hasVideoTrack || mutedVideo ? (
              <div className="rounded-full bg-gray-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-100">
                {t('camera_off') || 'Camera off'}
              </div>
            ) : null}
          </div>
        }
        topRightControls={!edgeCompactMode ? (
          <ParticipantTileActions
            t={t}
            userId={userId}
            activeFullscreenTileId={activeFullscreenTileId}
            toggleFullscreen={toggleFullscreen}
            hasPermission={hasPermission}
            remoteRole={remoteRole}
            handleUpdateRole={handleUpdateRole}
            handleKickUser={handleKickUser}
            handleMuteUser={handleMuteUser}
            requestHighQuality={requestHighQuality}
          />
        ) : null}
      >
        {stream ? (
          <div className="flex-1 bg-gray-950 flex items-center justify-center overflow-hidden relative">
            {edgeCompactMode ? (
              <div className="h-full w-full flex items-center justify-center">
                <VideoPlayer stream={stream} />
              </div>
            ) : (
              <ZoomableVideoContainer>
                <VideoPlayer stream={stream} />
              </ZoomableVideoContainer>
            )}
          </div>
        ) : (
          renderParticipantPlaceholder({ displayName, peerStatus, peerStats, mutedVideo })
        )}
      </VideoTile>
    );
  };

  return (
    <div
      className={`w-full transition-all duration-300 ${
        isChatOpen ? 'pr-0 md:pr-80' : ''
      } ${
        fullscreenTileId ? 'opacity-0 pointer-events-none' : ''
      }`}
    >
      {isMobileEdge ? (
        <div className="mx-auto mb-3 w-full max-w-5xl rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
          <div className="font-semibold">
            {t('edge_mobile_browser_warning_title') || 'Edge on Android may black-screen in multi-person meetings'}
          </div>
          <div className="text-amber-100/90">
            {t('edge_mobile_meeting_notice') || 'We are using a simplified view here. For the best stability, open this room in your phone browser, Chrome, or WeChat.'}
          </div>
        </div>
      ) : null}

      {focusModeActive ? (
        <div className="flex h-full flex-col gap-4 xl:flex-row">
          <div className="min-h-0 flex-1">
            {renderTile(focusedTileId)}
          </div>
          <div className="flex w-full flex-row gap-4 overflow-x-auto xl:w-80 xl:flex-col xl:overflow-y-auto">
            {secondaryTileIds.map((tileId) => (
              <div key={tileId} className="min-w-[260px] flex-1 xl:min-w-0">
                {renderTile(tileId)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            remoteParticipantCount === 0
              ? 'h-full grid-cols-1 max-w-5xl mx-auto'
              : edgeCompactMode
                ? 'h-full grid-cols-1 max-w-5xl mx-auto'
                : remoteParticipantCount === 1
                ? 'h-full grid-cols-1 md:grid-cols-2 max-w-7xl mx-auto'
                : 'h-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {displayedTileIds.map(renderTile)}
        </div>
      )}

      {remoteParticipantCount === 0 && (
        <div className="hidden md:flex bg-gray-900/30 border-2 border-dashed border-gray-800 rounded-2xl flex-col items-center justify-center text-gray-600 p-8">
          <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
            <Users size={24} className="opacity-50" />
          </div>
          <p className="font-medium">{t('waiting_for_others')}</p>
          <p className="text-sm mt-2 opacity-60">
            {t('share_room_id_hint')} <span className="font-mono text-blue-400">{roomId}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function VideoPlayer({ stream }) {
  return <StreamVideo stream={stream} className="w-full h-full object-contain" />;
}

export default MeetingVideoGrid;
