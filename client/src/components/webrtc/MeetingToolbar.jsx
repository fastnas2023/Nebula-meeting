import { ArrowUpDown, ChevronUp, MessageSquare, Mic, MicOff, Monitor, MonitorOff, PhoneOff, SignalLow, StopCircle, Video as VideoIcon } from 'lucide-react';
import { useState } from 'react';
import { SafeArea } from 'antd-mobile';

function MeetingToolbar({
  t,
  activeFullscreenTileId,
  toggleAudio,
  isAudioEnabled,
  toggleVideo,
  isVideoEnabled,
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
  isChatOpen,
  setIsChatOpen,
  unreadCount,
  exitToHome,
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const primaryButtonClass = 'rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-1 w-[64px] min-w-[64px] h-[56px] md:w-20 md:h-auto md:min-w-[80px] md:p-3';
  const secondaryButtonClass = 'rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-1 w-[64px] min-w-[64px] h-[56px] md:w-20 md:h-auto md:min-w-[80px] md:p-3';

  const commonSecondaryControls = (
    <>
      <button
        onClick={isSharing ? stopScreenShare : startScreenShare}
        className={`${secondaryButtonClass} ${
          isSharing ? 'bg-green-500/10 hover:bg-green-500/20 text-green-500' : 'bg-gray-700/50 hover:bg-gray-600 text-white'
        }`}
        title={isSharing ? t('stop_sharing_tooltip') : t('share_screen_tooltip')}
      >
        {isSharing ? <MonitorOff size={18} className="md:h-5 md:w-5" /> : <Monitor size={18} className="md:h-5 md:w-5" />}
        <span className="text-[10px] font-medium">{isSharing ? t('stop_sharing_btn') : t('share_screen_btn')}</span>
      </button>

      <button
        onClick={isRecording ? stopRecording : openRecordingMode}
        className={`${secondaryButtonClass} ${
          isRecording ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 animate-pulse' : 'bg-gray-700/50 hover:bg-gray-600 text-white'
        }`}
        title={isRecording ? t('stop_recording_tooltip') : t('start_recording_tooltip')}
      >
        {isRecording ? <StopCircle size={18} className="md:h-5 md:w-5" /> : <div className="w-[18px] h-[18px] md:w-5 md:h-5 rounded-full border-2 border-current flex items-center justify-center"><div className="w-2 h-2 bg-current rounded-full"></div></div>}
        {isRecording ? (
          (() => {
            const stats = formatRecordingStats(recordingStats.seconds, recordingStats.bytes);
            return (
              <span className="text-[10px] font-medium leading-tight text-center">
                {t('rec_btn')} {stats.time}
                <span className="block opacity-80">{stats.size}</span>
              </span>
            );
          })()
        ) : (
          <span className="text-[10px] font-medium">{t('record_btn')}</span>
        )}
      </button>

      <button
        onClick={toggleLowDataMode}
        className={`${secondaryButtonClass} ${
          isLowDataMode ? 'bg-green-500/10 hover:bg-green-500/20 text-green-500' : 'bg-gray-700/50 hover:bg-gray-600 text-white'
        }`}
        title={isLowDataMode ? t('low_data_mode_on') : t('low_data_mode_off')}
      >
        <SignalLow size={18} className="md:h-5 md:w-5" />
        <span className="text-[10px] font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{t('low_data_mode')}</span>
      </button>

      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`${secondaryButtonClass} relative ${
          isChatOpen ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-700/50 hover:bg-gray-600 text-white'
        }`}
        title={t('chat_btn') || 'Chat'}
      >
        <MessageSquare size={18} className="md:h-5 md:w-5" />
        <span className="text-[10px] font-medium">{t('chat_btn') || 'Chat'}</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-gray-800">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </>
  );

  const sortControl = (
    <div ref={sortMenuRef} className="relative">
      <button
        onClick={() => setIsSortMenuOpen((prev) => !prev)}
        className={`${secondaryButtonClass} bg-gray-700/50 hover:bg-gray-600 text-white`}
        title={t('sort_tooltip') || 'Sort'}
      >
        <ArrowUpDown size={18} className="md:h-5 md:w-5" />
        <span className="text-[10px] font-medium">{t('sort_btn') || 'Sort'}</span>
      </button>

      {isSortMenuOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <button
            onClick={() => { applySortRule({ type: 'name', direction: 'asc' }); setIsSortMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-800 transition-colors ${sortRule.type === 'name' && sortRule.direction === 'asc' ? 'text-blue-400' : 'text-gray-200'}`}
          >
            {t('sort_name_asc') || 'Name (A → Z)'}
          </button>
          <button
            onClick={() => { applySortRule({ type: 'name', direction: 'desc' }); setIsSortMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-800 transition-colors ${sortRule.type === 'name' && sortRule.direction === 'desc' ? 'text-blue-400' : 'text-gray-200'}`}
          >
            {t('sort_name_desc') || 'Name (Z → A)'}
          </button>
          <button
            onClick={() => { applySortRule({ type: 'speaking', direction: 'desc' }); setIsSortMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-800 transition-colors ${sortRule.type === 'speaking' ? 'text-blue-400' : 'text-gray-200'}`}
          >
            {t('sort_speaking') || 'Speaking first'}
          </button>
          <button
            onClick={() => { applySortRule({ type: 'joinedAt', direction: 'asc' }); setIsSortMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-800 transition-colors ${sortRule.type === 'joinedAt' && sortRule.direction === 'asc' ? 'text-blue-400' : 'text-gray-200'}`}
          >
            {t('sort_joined') || 'Join time'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`bg-gray-900/95 border-t border-gray-800 flex items-center justify-center px-2 md:px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] md:pb-4 transition-opacity duration-200 ${activeFullscreenTileId ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 md:gap-3 bg-gray-800/80 backdrop-blur-lg px-2.5 md:px-6 py-2.5 md:py-3 rounded-2xl border border-gray-700 shadow-2xl md:transform md:-translate-y-2 max-w-full overflow-x-auto">
          <button
            onClick={toggleAudio}
            className={`${primaryButtonClass} ${
              isAudioEnabled ? 'bg-gray-700/50 hover:bg-gray-600 text-white' : 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
            }`}
            title={isAudioEnabled ? t('mute_mic_tooltip') : t('unmute_mic_tooltip')}
          >
            {isAudioEnabled ? <Mic size={18} className="md:h-5 md:w-5" /> : <MicOff size={18} className="md:h-5 md:w-5" />}
            <span className="text-[10px] font-medium">{isAudioEnabled ? t('mute_btn') : t('unmute_btn')}</span>
          </button>

          <button
            onClick={toggleVideo}
            className={`${primaryButtonClass} ${
              isVideoEnabled ? 'bg-gray-700/50 hover:bg-gray-600 text-white' : 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
            }`}
            title={isVideoEnabled ? t('stop_video_tooltip') : t('start_video_tooltip')}
          >
            {isVideoEnabled ? <VideoIcon size={18} className="md:h-5 md:w-5" /> : <VideoIcon size={18} className="text-red-500 md:h-5 md:w-5" />}
            <span className="text-[10px] font-medium">{isVideoEnabled ? t('stop_video_btn') : t('start_video_btn')}</span>
          </button>

          <div className="hidden md:flex items-center gap-3">
            {commonSecondaryControls}
            {sortControl}
          </div>

          <div className="md:hidden relative">
            <button
              onClick={() => setIsMoreOpen((prev) => !prev)}
              className={`${primaryButtonClass} bg-gray-700/50 hover:bg-gray-600 text-white`}
              title={t('more_controls') || 'More'}
            >
              <ChevronUp size={18} className={`transition-transform md:h-5 md:w-5 ${isMoreOpen ? 'rotate-180' : ''}`} />
              <span className="text-[10px] font-medium">{t('more_controls') || 'More'}</span>
            </button>

            {isMoreOpen && (
              <div className="absolute bottom-full mb-2 right-0 w-[232px] rounded-2xl border border-gray-700 bg-gray-900/95 p-2.5 shadow-2xl">
                <div className="grid grid-cols-3 gap-2">
                  {commonSecondaryControls}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-8 bg-gray-700 mx-1 md:mx-2"></div>

          <button
            onClick={exitToHome}
            className={`${primaryButtonClass} bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20`}
            title={t('leave_meeting_tooltip')}
          >
            <PhoneOff size={18} className="md:h-5 md:w-5" />
            <span className="text-[10px] font-medium">{t('leave_btn')}</span>
          </button>
        </div>
        <SafeArea position="bottom" />
      </div>
    </div>
  );
}

export default MeetingToolbar;
