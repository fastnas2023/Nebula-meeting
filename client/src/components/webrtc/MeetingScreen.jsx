import { AlertTriangle, Check, Copy, Crown, Loader2, Shield, UserX, Users, Wifi, WifiOff } from 'lucide-react';
import MeetingChatPanel from './MeetingChatPanel';
import MeetingOverlays from './MeetingOverlays';
import MeetingToolbar from './MeetingToolbar';

function MeetingScreen({
  t,
  fullscreenHostRef,
  activeFullscreenTileId,
  fullscreenTileId,
  roomId,
  copied,
  copyRoomId,
  myRole,
  isCreator,
  handleCloseRoom,
  meetingPhase,
  signalingState,
  remoteStreams,
  connectionStatus,
  isChatOpen,
  setIsChatOpen,
  messages,
  socketId,
  chatScrollRef,
  fileInputRef,
  handleFileSelect,
  newMessage,
  setNewMessage,
  sendMessage,
  videoGrid,
  isAudioEnabled,
  toggleAudio,
  isVideoEnabled,
  toggleVideo,
  isSharing,
  stopScreenShare,
  startScreenShare,
  isRecording,
  stopRecording,
  openRecordingMode,
  formatRecordingStats,
  recordingStats,
  isLowDataMode,
  toggleLowDataMode,
  sortMenuRef,
  setIsSortMenuOpen,
  isSortMenuOpen,
  applySortRule,
  sortRule,
  unreadCount,
  exitToHome,
  isSharePreviewOpen,
  sharePreviewStream,
  cancelScreenShare,
  confirmScreenShare,
  isRecordModeOpen,
  startRecording,
  startCompositeRecording,
  setIsRecordModeOpen,
  isLeaveOptionsOpen,
  setIsLeaveOptionsOpen,
  leaveAndTransferHost,
  closeRoomForEveryone,
}) {
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden relative">
      <div ref={fullscreenHostRef} className={`absolute inset-0 z-[70] ${activeFullscreenTileId ? 'pointer-events-auto' : 'pointer-events-none'}`} />

      <div className={`min-h-[64px] bg-gray-900/90 backdrop-blur border-b border-gray-800 flex flex-col gap-3 px-3 py-3 md:h-16 md:flex-row md:justify-between md:items-center md:px-6 md:py-0 z-10 transition-opacity duration-200 ${activeFullscreenTileId ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-3">
          <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700/50 self-start">
            <Users size={15} className="text-gray-400" />
            <span className="font-mono font-medium text-gray-200">{roomId}</span>
            <button
              onClick={copyRoomId}
              className="ml-2 hover:bg-gray-700 p-1 rounded transition-colors"
              title={t('copy_room_id')}
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:ml-2 md:gap-3">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
              myRole === 'creator'
                ? 'bg-red-500/10 border-red-500/20 text-red-500'
                : myRole === 'admin'
                ? 'bg-purple-500/10 border-purple-500/20 text-purple-500'
                : myRole === 'host'
                ? 'bg-orange-500/10 border-orange-500/20 text-orange-500'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
            }`}>
              {myRole === 'creator' && <Crown size={14} />}
              {myRole === 'admin' && <Shield size={14} />}
              {myRole === 'host' && <Crown size={14} />}
              {myRole === 'participant' && <Users size={14} />}
              <span className="text-[10px] font-medium uppercase tracking-wider leading-none">
                {myRole === 'creator' ? t('creator_label') : myRole.toUpperCase()}
              </span>
            </div>

            {isCreator && (
              <button
                onClick={handleCloseRoom}
                className="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] md:text-xs font-medium transition-colors border border-red-500/50 shadow-sm shadow-red-900/20 flex items-center gap-1.5"
              >
                <UserX size={13} />
                {t('close_room')}
              </button>
            )}

            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
              signalingState === 'connected'
                ? 'bg-green-500/10 border-green-500/20 text-green-500'
                : 'bg-red-500/10 border-red-500/20 text-red-500'
            }`}>
              {signalingState === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className="text-[10px] font-medium uppercase tracking-wider leading-none">
                {signalingState === 'connected' ? t('signal_ok') : t('offline')}
              </span>
            </div>

            {Object.keys(remoteStreams).length > 0 && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
                connectionStatus === 'connected'
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                  : (connectionStatus === 'failed' || connectionStatus === 'disconnected')
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                  : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
              }`}>
                {connectionStatus === 'connected' ? (
                  <Check size={14} />
                ) : (connectionStatus === 'failed' || connectionStatus === 'disconnected') ? (
                  <AlertTriangle size={14} />
                ) : (
                  <Loader2 size={14} className="animate-spin" />
                )}
                <span className="text-[10px] font-medium uppercase tracking-wider leading-none">
                  {connectionStatus}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('live')}</span>
        </div>
      </div>

      {meetingPhase !== 'meeting' && meetingPhase !== 'setup' && meetingPhase !== 'welcome' && (
        <div className="px-4 pt-3 z-10">
          <div className={`rounded-2xl border px-4 py-3 text-sm ${
            meetingPhase === 'reconnecting'
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-50'
              : meetingPhase === 'leaving'
                ? 'border-blue-500/20 bg-blue-500/10 text-blue-50'
                : 'border-red-500/20 bg-red-500/10 text-red-50'
          }`}>
            {meetingPhase === 'reconnecting' && (t('reconnecting_status') || 'Reconnecting to the meeting network...')}
            {meetingPhase === 'leaving' && (t('leaving_status') || 'Leaving meeting...')}
            {meetingPhase === 'kicked' && (t('you_were_kicked') || 'You were removed from the room')}
            {meetingPhase === 'room-closed' && (t('room_closed') || 'Room closed')}
          </div>
        </div>
      )}

      <div className="flex-1 px-2 py-3 md:p-4 overflow-y-auto bg-[#121212] flex items-center justify-center relative">
        <MeetingChatPanel
          t={t}
          isOpen={isChatOpen}
          fullscreenTileId={fullscreenTileId}
          setIsChatOpen={setIsChatOpen}
          messages={messages}
          socketId={socketId}
          chatScrollRef={chatScrollRef}
          fileInputRef={fileInputRef}
          handleFileSelect={handleFileSelect}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          sendMessage={sendMessage}
        />

        {videoGrid}
      </div>

      <MeetingToolbar
        t={t}
        activeFullscreenTileId={activeFullscreenTileId}
        toggleAudio={toggleAudio}
        isAudioEnabled={isAudioEnabled}
        toggleVideo={toggleVideo}
        isVideoEnabled={isVideoEnabled}
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
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        unreadCount={unreadCount}
        exitToHome={exitToHome}
      />

      <MeetingOverlays
        t={t}
        isSharePreviewOpen={isSharePreviewOpen}
        sharePreviewStream={sharePreviewStream}
        cancelScreenShare={cancelScreenShare}
        confirmScreenShare={confirmScreenShare}
        isRecordModeOpen={isRecordModeOpen}
        isRecording={isRecording}
        startRecording={startRecording}
        startCompositeRecording={startCompositeRecording}
        setIsRecordModeOpen={setIsRecordModeOpen}
        isLeaveOptionsOpen={isLeaveOptionsOpen}
        setIsLeaveOptionsOpen={setIsLeaveOptionsOpen}
        leaveAndTransferHost={leaveAndTransferHost}
        closeRoomForEveryone={closeRoomForEveryone}
      />
    </div>
  );
}

export default MeetingScreen;
