import { ArrowRight, Clock, Copy, Crown, Loader2, Lock, MessageSquare, Monitor, MonitorOff, RefreshCw, Users, X } from 'lucide-react';
import RejoinPrompt from '../RejoinPrompt';

function WelcomeScreen({
  t,
  pendingRoomId,
  confirmReturnRoom,
  cancelReturnRoom,
  exitToHome,
  entryMode,
  setEntryMode,
  roomId,
  setRoomId,
  setJoinRoomIdError,
  joinRoomIdError,
  joinRoom,
  createRoomId,
  setCreateRoomId,
  regenerateCreateRoomId,
  createRoomName,
  setCreateRoomName,
  copyText,
  handleCreateMeeting,
  activeRooms,
  visibleRooms,
  roomIdleTtlMs,
  fetchActiveRooms,
  isLoadingRooms,
  activeRoomQuery,
  setActiveRoomQuery,
  onJoinActiveRoom,
}) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black"></div>
      <div className="absolute top-[15%] left-[15%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[10%] right-[15%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]"></div>

      {pendingRoomId && (
        <RejoinPrompt t={t} onConfirm={confirmReturnRoom} onCancel={cancelReturnRoom} />
      )}

      <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-600/90 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Users size={22} />
              </div>
              <div>
                <div className="text-lg font-bold">{t('webrtc_entry_title') || t('webrtc_card_title') || 'WebRTC Meeting'}</div>
                <div className="text-xs text-gray-400">{t('webrtc_entry_subtitle') || t('webrtc_card_desc') || 'Unlimited self-hosted meeting'}</div>
              </div>
            </div>
            <button
              onClick={exitToHome}
              className="px-3 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              {t('back_home_btn')}
            </button>
          </div>

          <div className="p-6">
            <div className="inline-flex bg-black/30 border border-white/10 rounded-2xl p-1 mb-6 w-full">
              <button
                onClick={() => setEntryMode('join')}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${entryMode === 'join' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}
              >
                {t('entry_join_tab') || t('join_meeting_title') || 'Join'}
              </button>
              <button
                onClick={() => setEntryMode('create')}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${entryMode === 'create' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}
              >
                {t('entry_create_tab') || t('create_meeting_btn') || 'Create'}
              </button>
            </div>

            {entryMode === 'join' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">{t('room_id_label') || 'Room ID'}</label>
                  <input
                    type="text"
                    placeholder={t('room_id_placeholder')}
                    value={roomId}
                    onChange={(e) => {
                      setRoomId(e.target.value);
                      setJoinRoomIdError(false);
                    }}
                    className={`w-full px-4 py-3 rounded-2xl text-white placeholder-gray-500 outline-none transition-all bg-black/30 border ${
                      joinRoomIdError ? 'border-red-500/60 focus:ring-2 focus:ring-red-500/30' : 'border-white/10 focus:ring-2 focus:ring-blue-500/30'
                    }`}
                    onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                    autoFocus
                  />
                  {joinRoomIdError && (
                    <div className="mt-2 text-xs text-red-400">{t('enter_room_id_error')}</div>
                  )}
                </div>

                <button
                  onClick={joinRoom}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all transform active:scale-[0.98] shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
                >
                  {t('continue_btn')} <ArrowRight size={18} />
                </button>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => {
                      setEntryMode('create');
                      if (!createRoomId) regenerateCreateRoomId();
                    }}
                    className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    {t('quick_create_hint') || 'No room yet? Create one'}
                  </button>
                  <button
                    onClick={fetchActiveRooms}
                    disabled={isLoadingRooms}
                    className="text-sm font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {t('refresh_rooms') || 'Refresh'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">{t('create_room_label') || 'New Room ID'}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={createRoomId}
                      onChange={(e) => setCreateRoomId(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-2xl text-white outline-none bg-black/30 border border-white/10 focus:ring-2 focus:ring-purple-500/30 font-mono"
                    />
                    <button
                      onClick={regenerateCreateRoomId}
                      className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors"
                      title={t('regenerate_btn') || 'Regenerate'}
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-400 mb-2">{t('create_room_name_label') || 'Room Name'}</label>
                    <input
                      type="text"
                      value={createRoomName}
                      onChange={(e) => setCreateRoomName(e.target.value)}
                      placeholder={t('create_room_name_placeholder') || 'e.g. Weekly Sync'}
                      className="w-full px-4 py-3 rounded-2xl text-white outline-none bg-black/30 border border-white/10 focus:ring-2 focus:ring-purple-500/30"
                      maxLength={60}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{t('create_room_desc') || 'You can edit it before creating.'}</span>
                    <button onClick={() => copyText(createRoomId)} className="text-gray-300 hover:text-white transition-colors">
                      {t('copy_room_id') || 'Copy'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCreateMeeting}
                  className="w-full py-3 bg-white text-black rounded-2xl font-bold transition-all transform active:scale-[0.98] shadow-lg shadow-white/10 flex items-center justify-center gap-2"
                >
                  {t('create_meeting_primary') || 'Create & Continue'} <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col min-h-[420px]">
          <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Monitor size={18} className="text-green-500" />
              <div className="font-bold">{t('active_rooms_title')}</div>
              <div className="text-xs text-gray-400">{visibleRooms.length}/{activeRooms.length}</div>
              <div className="text-xs text-gray-500 hidden sm:block">
                {t('room_cleanup_rule', { minutes: Math.round(roomIdleTtlMs / 60000) }) ||
                  `空房间超过 ${Math.round(roomIdleTtlMs / 60000)} 分钟自动清理`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  copyText(
                    JSON.stringify({
                      at: new Date().toISOString(),
                      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
                      rooms: activeRooms.length,
                    })
                  )
                }
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-colors"
                title={t('feedback_btn') || 'Feedback'}
              >
                <MessageSquare size={18} />
              </button>
              <button
                onClick={fetchActiveRooms}
                disabled={isLoadingRooms}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                title={t('refresh_rooms')}
              >
                <RefreshCw size={18} className={isLoadingRooms ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="p-6 pt-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={activeRoomQuery}
                onChange={(e) => setActiveRoomQuery(e.target.value)}
                placeholder={t('search_rooms_placeholder') || 'Search by room or creator'}
                className="flex-1 px-4 py-2.5 rounded-2xl text-sm text-white placeholder-gray-500 outline-none bg-black/30 border border-white/10 focus:ring-2 focus:ring-blue-500/30"
              />
              {activeRoomQuery ? (
                <button
                  onClick={() => setActiveRoomQuery('')}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors"
                  title={t('clear_btn') || 'Clear'}
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar space-y-3">
            {isLoadingRooms && activeRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                <Loader2 size={30} className="animate-spin mb-3" />
                <p className="text-sm">{t('loading')}...</p>
              </div>
            ) : visibleRooms.length > 0 ? (
              visibleRooms.map((room) => (
                <div
                  key={room.roomId}
                  className="bg-black/25 border border-white/10 rounded-2xl p-4 hover:bg-black/35 hover:border-blue-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-base font-bold text-blue-300 break-all">{room.roomId}</span>
                        {room.roomName ? (
                          <span className="text-sm font-semibold text-white/90 truncate max-w-[320px]">{room.roomName}</span>
                        ) : null}
                        {room.isProtected && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                            <Lock size={12} />
                            {t('password_required') || 'Protected'}
                          </span>
                        )}
                        {room.creatorName && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            <Crown size={10} />
                            {room.creatorName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} />
                          <span>{new Date(room.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users size={12} />
                          <span>
                            {room.userCount} {t('users_count')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => copyText(room.roomId)}
                        className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors"
                        title={t('copy_room_id') || 'Copy'}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => onJoinActiveRoom(room)}
                        className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-900/20"
                      >
                        {t('join_now_btn')}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 border-2 border-dashed border-white/10 rounded-2xl">
                <MonitorOff size={30} className="mb-3 opacity-60" />
                <p className="text-sm">{t('no_active_rooms')}</p>
                <button
                  onClick={() => {
                    setEntryMode('create');
                    regenerateCreateRoomId();
                  }}
                  className="mt-4 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors text-sm"
                >
                  {t('create_meeting_btn') || 'Create a meeting'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
