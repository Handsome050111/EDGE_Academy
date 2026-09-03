import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';
import SiteNavbar from './SiteNavbar';

const SitePageLayout = ({ children, showInstallButton = true }) => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pwaMessage, setPwaMessage] = useState('');

  // PWA Install Prompt Listener
  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setPwaMessage('NexAcademy app installed successfully!');
      setTimeout(() => setPwaMessage(''), 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isInstalled) {
      setPwaMessage('NexAcademy is already installed on your device.');
      setTimeout(() => setPwaMessage(''), 4000);
    } else {
      setPwaMessage(
        'To install: In Chrome/Edge, click the Install App icon in the browser address bar (or on iOS tap Share → Add to Home Screen).'
      );
      setTimeout(() => setPwaMessage(''), 6000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <SiteNavbar basePath="/" />

      <main className="flex-1 bg-white">{children}</main>

      <footer className="bg-[#020D1E] text-slate-400 text-sm border-t border-blue-900/40">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 pt-16 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-col items-start cursor-pointer group select-none" onClick={() => navigate('/')}>
                <span className="text-2xl font-extrabold tracking-tight text-white leading-none">
                  <Logo size="full" variant="light" className="h-10" />
                </span>
                <span className="text-xs font-medium text-blue-200/80 tracking-wide mt-1">
                  A product of Technonex
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
                Proprietary operational qualification ecosystem certifying deployment-ready field engineers for high-stakes enterprise IT infrastructure and live data center environments across EMEA.
              </p>

              {showInstallButton && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleInstallPwa}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-950/90 hover:bg-blue-900/80 border border-blue-800/60 hover:border-gray-400/50 text-blue-100 hover:text-gray-400 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer group"
                  >
                    <svg className="w-4 h-4 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{isInstalled ? 'App Installed' : 'Install NexAcademy App'}</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">
                Platform
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <a href="/#modules" className="hover:text-gray-400 transition">Curriculum Modules</a>
                </li>
                <li>
                  <a href="/#certifications" className="hover:text-gray-400 transition">Certification Tiers</a>
                </li>
                <li>
                  <a href="/#about" className="hover:text-gray-400 transition">About Framework</a>
                </li>
                <li>
                  <a href="/#verification" className="hover:text-gray-400 transition">Verify Credential</a>
                </li>
                <li>
                  <button onClick={() => navigate('/login')} className="hover:text-gray-400 transition cursor-pointer text-left">
                    Engineer Portal Login
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">
                Qualifications
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <a href="/#certifications" className="hover:text-gray-400 transition">EDGE Technician (L1)</a>
                </li>
                <li>
                  <a href="/#certifications" className="hover:text-gray-400 transition">CORE Lead Engineer (L2)</a>
                </li>
                <li>
                  <a href="/#modules" className="hover:text-gray-400 transition">Enterprise Rack Standards</a>
                </li>
                <li>
                  <a href="/#modules" className="hover:text-gray-400 transition">Client 14-Section Site Survey</a>
                </li>
                <li>
                  <a href="/#modules" className="hover:text-gray-400 transition">Fiber Optics & Ekahau WLAN</a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">
                Quality & Verification
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <a href="/#verification" className="hover:text-gray-400 transition">Instant ID Lookup</a>
                </li>
                <li>
                  <a href="/#about" className="hover:text-gray-400 transition">Live Viva Assessment</a>
                </li>
                <li>
                  <a href="/#about" className="hover:text-gray-400 transition">DGUV V3 Electrical Safety</a>
                </li>
                <li>
                  <a href="/#about" className="hover:text-gray-400 transition">OTDR Tier-2 Fiber Testing</a>
                </li>
                <li>
                  <span className="text-slate-500">Regional Lead Sign-Off</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-blue-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Technonex NexAcademy. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-6">
              <a href="/privacy-policy" className="hover:text-slate-300 transition">Privacy Policy</a>
              <a href="/terms" className="hover:text-slate-300 transition">Terms and Conditions</a>
              <a href="/cookies" className="hover:text-slate-300 transition">Cookies</a>
              <a href="/legal-notice" className="hover:text-slate-300 transition">Legal Notice</a>
            </div>
          </div>
        </div>
      </footer>
      {/* PWA Toast Message */}
      {pwaMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white text-sm font-medium px-5 py-3.5 rounded-2xl shadow-xl border border-white/10 max-w-sm w-[90vw]">
          <span className="leading-relaxed">{pwaMessage}</span>
          <button
            onClick={() => setPwaMessage('')}
            className="ml-auto text-slate-400 hover:text-white transition shrink-0 cursor-pointer"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default SitePageLayout;
