import { useState, useCallback, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import AgoraMeeting from './AgoraMeeting';
import JitsiMeeting from './JitsiMeeting';
import WebRTCMeeting from './WebRTCMeeting';
import RoleManager from './RoleManager';
import { ToastContainer } from './UI';
import { Video, Zap, Cloud, Server, ArrowRight, User, Globe, Shield, ArrowUpRight, Menu, X, Orbit } from 'lucide-react';
import WaveParticles from './components/WaveParticles';

function App() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('roomId') ? 'webrtc' : 'home';
  }); // 'home', 'webrtc', 'agora', 'jitsi'
  const [toasts, setToasts] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(newLang);
  };

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
  };

  if (mode === 'agora') {
    return (
        <>
            <AgoraMeeting onBack={() => setMode('home')} addToast={addToast} />
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
    );
  }

  if (mode === 'jitsi') {
    return (
        <>
            <JitsiMeeting onBack={() => setMode('home')} addToast={addToast} />
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
    );
  }

  if (mode === 'webrtc') {
    return (
        <>
            <WebRTCMeeting onBack={() => setMode('home')} addToast={addToast} />
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
    );
  }

  if (mode === 'admin') {
      return <RoleManager onBack={() => setMode('home')} />;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* 3D Background with Fallback */}
      <div className="absolute inset-0 z-0">
          {/* Static Fallback / Placeholder */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black z-[-1]"></div>
          
          <Suspense fallback={null}>
             <WaveParticles />
          </Suspense>
      </div>

      {/* Floating Navbar */}
      <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
          <header className="w-full max-w-7xl px-6 py-4 flex items-center justify-between bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMode('home')}>
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Orbit className="text-white" size={24} />
                  </div>
                  <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">NEBULA</span>
              </div>

              {/* Desktop Menu */}
              <nav className="hidden md:flex items-center gap-8">
                  <a href="#" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Products</a>
                  <a href="#" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Solutions</a>
                  <a href="#" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Enterprise</a>
                  <a href="#" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Resources</a>
              </nav>

              <div className="hidden md:flex items-center gap-4">
                  <button 
                      onClick={toggleLanguage}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                      title={i18n.language === 'en' ? t('switch_to_zh') : t('switch_to_en')}
                  >
                      <Globe size={18} />
                      <span className="text-xs font-medium uppercase">{i18n.language === 'en' ? 'EN' : 'CN'}</span>
                  </button>
                  <button className="text-sm font-medium text-white px-4 py-2 hover:bg-white/10 rounded-lg transition-colors">Sign In</button>
                  <button className="text-sm font-medium bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">Get Started</button>
              </div>

              {/* Mobile Menu Button */}
              <button 
                  className="md:hidden p-2 text-gray-300 hover:text-white"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                  {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
          </header>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
          <div className="absolute top-[72px] left-0 w-full bg-gray-900/95 backdrop-blur-xl border-b border-gray-800 z-40 p-6 flex flex-col gap-4 md:hidden animate-in slide-in-from-top-5">
              <a href="#" className="text-lg font-medium text-gray-300 hover:text-white py-2">Products</a>
              <a href="#" className="text-lg font-medium text-gray-300 hover:text-white py-2">Solutions</a>
              <a href="#" className="text-lg font-medium text-gray-300 hover:text-white py-2">Enterprise</a>
              <div className="h-px bg-gray-800 my-2"></div>
              <button 
                  onClick={toggleLanguage}
                  className="flex items-center gap-2 text-gray-300 hover:text-white py-2"
              >
                  <Globe size={18} />
                  <span>{i18n.language === 'en' ? 'Switch to Chinese' : '切换到英文'}</span>
              </button>
              <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium mt-2">Get Started</button>
          </div>
      )}

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center p-6 relative z-10">

      {/* Background Gradients (Overlay on 3D) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[10%] right-[20%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="text-center z-10 max-w-4xl mb-24 mt-32 md:mt-40">

          <h1 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight leading-tight flex flex-col md:block items-center justify-center gap-2">
            {t('hero_title')} <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">{t('hero_subtitle')}</span>
          </h1>
          <p className="text-gray-400 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed mb-12 font-light">
            {t('hero_description')}
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button onClick={() => handleModeSelect('webrtc')} className="px-8 py-3 bg-white text-black rounded-full font-bold text-lg hover:bg-gray-200 transition-all transform hover:scale-105 shadow-xl shadow-white/10 flex items-center gap-2">
                  Start Meeting Now <ArrowRight size={18} />
              </button>
              <button className="px-8 py-3 bg-white/5 text-white border border-white/10 rounded-full font-bold text-lg backdrop-blur-xl hover:bg-white/10 transition-all shadow-lg shadow-black/20">
                  Learn More
              </button>
          </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl w-full z-10 px-4 md:px-0 mb-32">
        {/* Jitsi Card - Highlighted as Best for Instant */}
        <div 
            className="group relative bg-gray-900/20 backdrop-blur-xl p-6 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/20 cursor-pointer flex flex-col gap-4 overflow-hidden" 
            onClick={() => handleModeSelect('jitsi')}
        >
            <div className="absolute top-0 right-0 bg-gray-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl uppercase tracking-wider">DEMO</div>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Zap className="text-purple-400" size={20} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">{t('jitsi_card_title')}</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                    {t('jitsi_card_desc')}
                </p>
            </div>
            <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="text-xs font-mono text-gray-500">{t('jitsi_card_footer')}</span>
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                    <ArrowRight size={14} className="text-white" />
                </div>
            </div>
        </div>

        {/* Agora Card */}
        <div 
            className="group relative bg-gray-900/20 backdrop-blur-xl p-6 rounded-3xl border border-gray-800 hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/20 cursor-pointer flex flex-col gap-4" 
            onClick={() => handleModeSelect('agora')}
        >
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Cloud className="text-blue-400" size={20} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">{t('agora_card_title')}</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                    {t('agora_card_desc')}
                </p>
            </div>
            <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="text-xs font-mono text-gray-500">{t('agora_card_footer')}</span>
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                    <ArrowRight size={14} className="text-white" />
                </div>
            </div>
        </div>

        {/* WebRTC Card */}
        <div 
            className="group relative bg-gray-900/20 backdrop-blur-xl p-6 rounded-3xl border border-gray-800 hover:border-green-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-green-900/20 cursor-pointer flex flex-col gap-4" 
            onClick={() => handleModeSelect('webrtc')}
        >
             <div className="absolute top-0 right-0 bg-green-600/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl uppercase tracking-wider">{t('recommended_badge')}</div>
            <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Server className="text-green-400" size={20} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-green-300 transition-colors">{t('webrtc_card_title')}</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                    {t('webrtc_card_desc')}
                </p>
            </div>
            <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="text-xs font-mono text-gray-500">{t('webrtc_card_footer')}</span>
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-green-600 transition-colors">
                    <ArrowRight size={14} className="text-white" />
                </div>
            </div>
        </div>

        {/* Custom Service Card */}
        <div 
            className="group relative bg-gray-900/20 backdrop-blur-xl p-6 rounded-3xl border border-gray-800 hover:border-orange-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-900/20 cursor-pointer flex flex-col gap-4" 
            onClick={() => window.open('mailto:contact@freemeeting.com', '_blank')}
        >
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Shield className="text-orange-400" size={20} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-orange-300 transition-colors">{t('custom_service_title')}</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                    {t('custom_service_desc')}
                </p>
            </div>
            <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="text-xs font-mono text-gray-500">Enterprise</span>
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-orange-600 transition-colors">
                    <ArrowRight size={14} className="text-white" />
                </div>
            </div>
        </div>
      </div>
      </main>
      
      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-black/20 backdrop-blur-md py-8 mt-auto relative z-20">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                  <Orbit className="text-gray-600" size={20} />
                  <span className="text-gray-500 font-bold">NEBULA</span>
              </div>
              <div className="text-gray-600 text-sm">
                  <p>{t('footer_text')}</p>
              </div>
              <div className="flex gap-6">
                  <button 
                    onClick={() => setMode('admin')}
                    className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-500 transition-colors cursor-pointer"
                  >
                    <Shield size={12} />
                    Admin Portal
                  </button>
                  <a href="#" className="text-xs text-gray-600 hover:text-white transition-colors">Privacy</a>
                  <a href="#" className="text-xs text-gray-600 hover:text-white transition-colors">Terms</a>
              </div>
          </div>
      </footer>
    </div>
  );
}

export default App;
