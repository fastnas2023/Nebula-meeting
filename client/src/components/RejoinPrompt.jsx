import { useEffect } from 'react';
import { ArrowRight, ArrowUpCircle } from 'lucide-react';

const RejoinPrompt = ({ t, onConfirm, onCancel }) => {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4 text-blue-400">
          <ArrowUpCircle size={24} />
          <h3 className="text-xl font-bold text-white">{t('rejoin_prompt_title') || '返回会议'}</h3>
        </div>
        <p className="text-gray-300 mb-6 leading-relaxed">
          {t('rejoin_prompt_text') || '检测到您刚离开会议，是否立即返回？'}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            {t('cancel_btn') || '取消'}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
          >
            {t('return_meeting_btn') || '返回会议'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejoinPrompt;

