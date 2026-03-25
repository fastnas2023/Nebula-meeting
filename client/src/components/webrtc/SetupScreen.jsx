import { Lock, Mic, MicOff, SignalLow, Users, Video as VideoIcon } from 'lucide-react';

function SetupScreen({
  t,
  previewVideoRef,
  meetingPhase,
  deviceSetupIssue,
  isVideoEnabled,
  shouldFlipLocalVideoCss,
  toggleAudio,
  toggleVideo,
  volumeLevel,
  nickname,
  setNickname,
  roomPassword,
  setRoomPassword,
  cameras,
  selectedCameraId,
  setSelectedCameraId,
  mics,
  selectedMicId,
  setSelectedMicId,
  isLowDataMode,
  toggleLowDataMode,
  resolution,
  setResolution,
  frameRate,
  setFrameRate,
  confirmJoin,
  setUiState,
  isAudioEnabled,
}) {
  return (
    <div className="h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-800 flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-white mb-4">{t('preview_label')}</h3>
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-gray-800 shadow-inner group">
            <video
              ref={previewVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''} ${shouldFlipLocalVideoCss ? 'transform scale-x-[-1]' : ''}`}
            />
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                    <VideoIcon size={32} className="text-red-500" />
                  </div>
                  <p className="text-gray-500 font-medium">{t('camera_off')}</p>
                </div>
              </div>
            )}

            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 z-20">
              <button
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-all duration-200 ${
                  isAudioEnabled ? 'bg-gray-700/80 hover:bg-gray-600 text-white' : 'bg-red-500/80 hover:bg-red-600 text-white'
                }`}
                title={isAudioEnabled ? t('mute_mic_tooltip') : t('unmute_mic_tooltip')}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-all duration-200 ${
                  isVideoEnabled ? 'bg-gray-700/80 hover:bg-gray-600 text-white' : 'bg-red-500/80 hover:bg-red-600 text-white'
                }`}
                title={isVideoEnabled ? t('stop_video_tooltip') : t('start_video_tooltip')}
              >
                <VideoIcon size={20} />
              </button>
            </div>

            <div className="absolute bottom-4 left-4 flex gap-2 z-10 hidden">
              <div className="bg-black/50 backdrop-blur px-3 py-1 rounded-full flex items-center gap-2">
                {volumeLevel > 5 ? <Mic size={14} className="text-green-400" /> : <MicOff size={14} className="text-red-400" />}
                <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-100" style={{ width: `${volumeLevel}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('setup_title')}</h2>
            <p className="text-gray-400">{t('setup_desc')}</p>
          </div>

          {meetingPhase === 'joining' && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
              {t('joining_room_status') || 'Joining room and preparing your devices...'}
            </div>
          )}

          {deviceSetupIssue && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-50 space-y-2">
              <div className="font-semibold">{deviceSetupIssue.title || (t('device_setup_issue_title') || 'We could not access your devices')}</div>
              <p className="text-amber-100/90">{deviceSetupIssue.message}</p>
              {Array.isArray(deviceSetupIssue.fixes) && deviceSetupIssue.fixes.length > 0 && (
                <div className="space-y-1 text-amber-100/80">
                  {deviceSetupIssue.fixes.map((fix) => (
                    <div key={fix}>• {fix}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('enter_name_placeholder')}</label>
              <div className="relative">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t('enter_name_placeholder')}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <Users size={18} className="absolute left-3 top-3.5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('room_password_optional') || 'Room Password (Optional)'}</label>
              <div className="relative">
                <input
                  type="password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder={t('room_password_placeholder') || 'Set for new, enter for existing'}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('camera_label')}</label>
              <div className="relative">
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {cameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>{cam.label || `Camera ${cam.deviceId.slice(0, 5)}...`}</option>
                  ))}
                </select>
                <VideoIcon size={18} className="absolute left-3 top-3.5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('microphone_label')}</label>
              <div className="relative">
                <select
                  value={selectedMicId}
                  onChange={(e) => setSelectedMicId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {mics.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>{mic.label || `Mic ${mic.deviceId.slice(0, 5)}...`}</option>
                  ))}
                </select>
                <Mic size={18} className="absolute left-3 top-3.5 text-gray-400" />
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-800 p-3 rounded-xl border border-gray-700">
              <div className="flex items-center gap-2">
                <SignalLow size={18} className="text-gray-400" />
                <span className="text-sm text-gray-300">{t('low_data_mode')}</span>
              </div>
              <button
                onClick={toggleLowDataMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${isLowDataMode ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <span className={`${isLowDataMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </button>
            </div>

            {!isLowDataMode && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('resolution_label') || 'Resolution'}</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="360p">360p (SD)</option>
                    <option value="720p">720p (HD)</option>
                    <option value="1080p">1080p (FHD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('framerate_label') || 'Frame Rate'}</label>
                  <select
                    value={frameRate}
                    onChange={(e) => setFrameRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="15">15 FPS</option>
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={confirmJoin}
              disabled={meetingPhase === 'joining'}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-900/30 transition-all active:scale-95"
            >
              {meetingPhase === 'joining' ? (t('joining_room_status') || 'Joining...') : t('join_now_btn')}
            </button>
            <button
              onClick={() => setUiState('welcome')}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
            >
              {t('back_btn') || 'Back'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetupScreen;
