import { Download, FileText, MessageSquare, Paperclip, Send, X } from 'lucide-react';

function MeetingChatPanel({
  t,
  isOpen,
  fullscreenTileId,
  setIsChatOpen,
  messages,
  socketId,
  chatScrollRef,
  fileInputRef,
  handleFileSelect,
  newMessage,
  setNewMessage,
  sendMessage,
}) {
  if (!isOpen || fullscreenTileId) return null;

  return (
    <div className="absolute right-4 top-4 bottom-4 w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl flex flex-col z-40 animate-in slide-in-from-right-10 duration-200 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
        <h3 className="font-bold text-white flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-500" />
          {t('chat_title') || 'Chat'}
        </h3>
        <button
          onClick={() => setIsChatOpen(false)}
          className="text-gray-400 hover:text-white hover:bg-gray-800 p-1 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={chatScrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm opacity-60">
            <MessageSquare size={32} className="mb-2 opacity-50" />
            <p>{t('no_messages') || 'No messages yet'}</p>
            <p className="text-xs">{t('start_conversation') || 'Start the conversation!'}</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === 'system') {
              const toneClass = msg.tone === 'warning'
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
                : msg.tone === 'notice'
                  ? 'border-blue-500/20 bg-blue-500/10 text-blue-100'
                  : 'border-gray-700 bg-gray-800/70 text-gray-200';
              return (
                <div key={msg.id} className={`rounded-2xl border px-3 py-2 text-xs leading-relaxed ${toneClass}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold uppercase tracking-wide opacity-80">{t('system_notice') || 'System'}</span>
                    <span className="opacity-60">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-1">{msg.content}</div>
                </div>
              );
            }

            const isMe = msg.senderId === socketId;
            const isFile = msg.type === 'file';

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-gray-500 font-medium">
                    {isMe ? (t('you') || 'You') : msg.senderName}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm break-words shadow-sm ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none'
                }`}>
                  {isFile ? (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-lg">
                        <FileText size={24} />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-medium truncate max-w-[150px]" title={msg.file.name}>{msg.file.name}</span>
                        <span className="text-xs opacity-70">{(msg.file.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <a
                        href={msg.file.data}
                        download={msg.file.name}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors ml-2"
                        title={t('download_file') || 'Download'}
                      >
                        <Download size={16} />
                      </a>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-gray-800 bg-gray-900/50">
        <div className="relative flex items-center gap-2">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title={t('attach_file') || 'Attach file'}
          >
            <Paperclip size={20} />
          </button>
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-600"
            placeholder={t('type_message_placeholder') || 'Type a message...'}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default MeetingChatPanel;
