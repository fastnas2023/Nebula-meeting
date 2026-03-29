import { AlertTriangle, ArrowRight, Check, Monitor, X } from 'lucide-react';

function MeetingOverlays({
  t,
  isSharePreviewOpen,
  sharePreviewStream,
  cancelScreenShare,
  confirmScreenShare,
  isRecordModeOpen,
  isRecording,
  startRecording,
  startCompositeRecording,
  setIsRecordModeOpen,
  isLeaveOptionsOpen,
  setIsLeaveOptionsOpen,
  leaveAndTransferHost,
  closeRoomForEveryone,
}) {
  return (
    <>
      {isSharePreviewOpen && sharePreviewStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-3 md:p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Monitor className="text-blue-500" size={18} />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-white leading-tight">{t('confirm_screen_share_title')}</h3>
                  <p className="text-xs text-gray-400">{t('confirm_screen_share_desc')}</p>
                </div>
              </div>
              <button onClick={cancelScreenShare} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg">
                <span className="sr-only">Close</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="flex-1 bg-black p-2 md:p-4 flex items-center justify-center overflow-hidden relative group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800/20 via-black to-black pointer-events-none"></div>
              <video
                ref={(ref) => {
                  if (ref && sharePreviewStream) {
                    ref.srcObject = sharePreviewStream;
                  }
                }}
                autoPlay
                playsInline
                muted
                className="max-w-full max-h-[60vh] rounded-lg border border-gray-800 shadow-2xl z-10"
              />
            </div>

            <div className="p-4 md:p-6 bg-gray-900 border-t border-gray-800 space-y-4 md:space-y-6">
              <div className="flex items-start gap-3 text-yellow-400 bg-yellow-400/5 p-4 rounded-xl border border-yellow-400/10">
                <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">{t('privacy_warning_title')}</p>
                  <p className="text-sm opacity-90 leading-relaxed">{t('privacy_warning_desc')}</p>
                </div>
              </div>

              <div className="flex flex-col-reverse md:flex-row gap-3 justify-end">
                <button
                  onClick={cancelScreenShare}
                  className="w-full md:w-auto px-6 py-2.5 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all border border-transparent hover:border-gray-700"
                >
                  {t('cancel_btn')}
                </button>
                <button
                  onClick={confirmScreenShare}
                  className="w-full md:w-auto px-6 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Check size={18} />
                  {t('start_sharing_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRecordModeOpen && !isRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-3 md:p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="w-5 h-5 rounded-full border-2 border-red-400 flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-white leading-tight">{t('recording_mode_title')}</h3>
                  <p className="text-xs text-gray-400">{t('recording_mode_desc')}</p>
                </div>
              </div>
              <button onClick={() => setIsRecordModeOpen(false)} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              <button
                onClick={startRecording}
                className="w-full text-left p-4 md:p-5 rounded-2xl border border-gray-700 hover:border-red-500/40 bg-gray-950/30 hover:bg-gray-800/40 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-white font-semibold">{t('recording_mode_screen')}</div>
                    <div className="text-sm text-gray-400 mt-1">{t('recording_mode_screen_desc')}</div>
                  </div>
                  <ArrowRight size={18} className="text-gray-400" />
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {t('recording_scope_screen_hint') || 'Captures the selected screen/window, plus any system audio your browser allows. It does not capture chat history as a separate export.'}
                </div>
              </button>

              <button
                onClick={startCompositeRecording}
                className="w-full text-left p-4 md:p-5 rounded-2xl border border-gray-700 hover:border-blue-500/40 bg-gray-950/30 hover:bg-gray-800/40 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-white font-semibold">{t('recording_mode_composite')}</div>
                    <div className="text-sm text-gray-400 mt-1">{t('recording_mode_composite_desc')}</div>
                  </div>
                  <ArrowRight size={18} className="text-gray-400" />
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {t('recording_scope_composite_hint') || 'Captures the meeting canvas you see here. Included participants depend on the current layout or focus mode.'}
                </div>
              </button>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsRecordModeOpen(false)}
                  className="px-5 py-2 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all border border-transparent hover:border-gray-700"
                >
                  {t('cancel_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLeaveOptionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsLeaveOptionsOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 md:p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
              <div>
                <h3 className="text-base md:text-lg font-semibold text-white leading-tight">{t('leave_options_title') || t('confirm_leave_room') || 'Leave room'}</h3>
                <p className="text-xs text-gray-400 mt-1">{t('leave_options_desc') || 'You can leave without closing the room. Host will be transferred.'}</p>
              </div>
              <button onClick={() => setIsLeaveOptionsOpen(false)} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 md:p-6 space-y-3">
              <button
                onClick={leaveAndTransferHost}
                className="w-full px-5 py-3 rounded-2xl bg-white text-black font-bold transition-all transform active:scale-[0.98] flex items-center justify-between"
              >
                <span>{t('leave_transfer_btn') || 'Leave & transfer host'}</span>
                <ArrowRight size={18} />
              </button>
              <button
                onClick={closeRoomForEveryone}
                className="w-full px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all transform active:scale-[0.98] flex items-center justify-between"
              >
                <span>{t('close_room_btn') || t('confirm_close_room') || 'Close room'}</span>
                <AlertTriangle size={18} />
              </button>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsLeaveOptionsOpen(false)}
                  className="px-5 py-2 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all border border-transparent hover:border-gray-700"
                >
                  {t('cancel_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MeetingOverlays;
