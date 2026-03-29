import { ArrowUpCircle, Maximize2, Minimize2, MoreVertical, Shield, UserX, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function ParticipantTileActions({
  t,
  userId,
  activeFullscreenTileId,
  toggleFullscreen,
  hasPermission,
  remoteRole,
  handleUpdateRole,
  handleKickUser,
  handleMuteUser,
  requestHighQuality,
  isAudioMuted = false,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const canManage = hasPermission('canManageRoles');
  const canKick = hasPermission('canKickUsers');
  const canMute = hasPermission('canMuteOthers');

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  return (
    <>
      <button
        onClick={() => toggleFullscreen(userId)}
        className="p-1.5 md:p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-sm shadow-lg transition-transform hover:scale-105 border border-white/10"
        title={activeFullscreenTileId === userId ? (t('restore_video') || 'Restore') : (t('fullscreen_video') || 'Fullscreen')}
      >
        {activeFullscreenTileId === userId ? <Minimize2 size={13} className="md:h-[14px] md:w-[14px]" /> : <Maximize2 size={13} className="md:h-[14px] md:w-[14px]" />}
      </button>
      {(canManage || canKick || canMute) && (
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="p-1.5 md:p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-sm shadow-lg transition-transform hover:scale-105 border border-white/10"
            title={t('host_actions_tooltip') || 'Host actions'}
          >
            <MoreVertical size={13} className="md:h-[14px] md:w-[14px]" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 md:w-48 bg-gray-950/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {canManage && (
                <button
                  onClick={() => {
                    handleUpdateRole(userId, remoteRole || 'participant');
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <Shield size={14} className="text-blue-400" />
                  {t('change_role_tooltip')}
                </button>
              )}
              {canMute && (
                <button
                  onClick={() => {
                    handleMuteUser(userId, 'audio', isAudioMuted);
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  {isAudioMuted ? (
                    <Volume2 size={14} className="text-emerald-400" />
                  ) : (
                    <VolumeX size={14} className="text-yellow-400" />
                  )}
                  {isAudioMuted ? (t('restore_user_audio_tooltip') || 'Restore Audio') : t('mute_user_tooltip')}
                </button>
              )}
              {canManage && (
                <button
                  onClick={() => {
                    requestHighQuality(userId);
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <ArrowUpCircle size={14} className="text-green-400" />
                  {t('request_hq_tooltip')}
                </button>
              )}
              {canKick && (
                <button
                  onClick={() => {
                    if (window.confirm(t('confirm_kick_user') || 'Remove this participant from the room?')) {
                      handleKickUser(userId);
                    }
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-950/40 transition-colors flex items-center gap-2"
                >
                  <UserX size={14} />
                  {t('kick_user_tooltip')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default ParticipantTileActions;
