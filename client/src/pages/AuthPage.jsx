import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const getDashboardPath = (role) => {
  switch (role) {
    case 'TeamLead':
    case 'team_lead':
      return '/team-lead';
    case 'Admin':
    case 'admin':
      return '/admin';
    case 'SuperAdmin':
    case 'super_admin':
      return '/super-admin';
    default:
      return '/engineer';
  }
};

const AuthPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: location.state?.activatedEmail || '',
    password: '',
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(
    location.state?.activatedEmail
      ? 'Your account has been activated! Please log in with your new password.'
      : ''
  );
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();

  // Typewriter Animation State
  const phrases = [
    'Empowering Technical Excellence',
    'Mastering Field Engineering',
    'Accelerating Technical Growth',
    'Certified Enterprise Standards',
  ];
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typedText, setTypedText] = useState('Empowering Technical Excellence');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    const typingSpeed = isDeleting ? 35 : 70;
    const pauseTime = isDeleting ? 400 : 2400;

    let timer;

    if (!isDeleting && typedText === currentPhrase) {
      timer = setTimeout(() => setIsDeleting(true), pauseTime);
    } else if (isDeleting && typedText === '') {
      timer = setTimeout(() => {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      }, 400);
    } else {
      timer = setTimeout(() => {
        setTypedText((prev) =>
          isDeleting
            ? currentPhrase.substring(0, prev.length - 1)
            : currentPhrase.substring(0, prev.length + 1)
        );
      }, typingSpeed);
    }

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, phraseIndex]);

  useEffect(() => {
    const inviteToken = searchParams.get('token');
    if (inviteToken) {
      navigate(`/invite/accept?token=${inviteToken}`, { replace: true });
      return;
    }

    if (user) {
      const targetPath = getDashboardPath(user.role || 'engineer');
      navigate(targetPath, { replace: true });
    }
  }, [user, navigate, searchParams]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const authUser = await login(form.email, form.password, rememberMe);
      const targetPath = getDashboardPath(authUser.role || 'engineer');
      navigate(targetPath, { replace: true });
    } catch (err) {
      const msg = err.message || err.response?.data?.error?.message || err.response?.data?.message || 'Authentication failed. Please check your corporate credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    try {
      setForgotLoading(true);
      setForgotError('');
      setForgotSuccess('');
      const res = await api.post('/auth/forgot-password', { email: forgotEmail.trim() });
      setForgotSuccess(res.data?.message || res.message || 'If this email is registered, a password reset link has been dispatched to your inbox.');
    } catch (err) {
      const msg = err.message || err.response?.data?.message || err.response?.data?.error?.message || (typeof err === 'string' ? err : 'Failed to dispatch password reset link.');
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white flex flex-col lg:flex-row font-sans">
      {/* Left Side: Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#062452] p-8 lg:p-14 xl:p-16 flex-col justify-between text-white relative overflow-hidden shrink-0">
        {/* Large Watermark Graphic */}
        <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border-[32px] border-white/[0.04] flex items-center justify-center pointer-events-none">
          <div className="w-[360px] h-[360px] rounded-full border-[24px] border-white/[0.03] flex items-center justify-center">
            <div className="w-[200px] h-[200px] rounded-full bg-white/[0.02]"></div>
          </div>
        </div>

        {/* Decorative Horizontal Circuit Line */}
        <div className="absolute bottom-1/3 left-0 right-0 h-[1px] bg-blue-400/20 pointer-events-none flex items-center justify-between px-20">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-300 bg-[#062452]"></div>
          <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-300 bg-[#062452]"></div>
        </div>

        {/* Top Brand Logo */}
        <div className="relative z-10">
          <div className="flex items-center cursor-pointer group" onClick={() => navigate('/')}>
            <span className="text-2xl font-extrabold tracking-tight text-white leading-none">
              EDGE <span className="text-[#EAB308]">Academy</span>
            </span>
          </div>
        </div>

        {/* Middle Copy with Typewriter Effect */}
        <div className="relative z-10 max-w-md my-auto py-12">
          <h1 className="text-3xl lg:text-4xl xl:text-[42px] font-bold leading-tight text-white mb-4 tracking-tight min-h-[96px] sm:min-h-[110px]">
            <span>{typedText}</span>
            <span className="inline-block w-[3.5px] h-[0.82em] bg-blue-300 ml-1.5 align-baseline animate-pulse rounded-full"></span>
          </h1>
          <p className="text-sm lg:text-base text-blue-200/80 leading-relaxed font-normal">
            Internal field engineer portal for personalized learning tracks, dynamic assessments, and spaced repetition quizzes.
          </p>
        </div>

        {/* Bottom Product Footer */}
        <div className="relative z-10 text-center lg:text-left text-xs text-blue-200/60 font-medium">
          © {new Date().getFullYear()} Technonex GmbH. All rights reserved.
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-8 lg:p-14 xl:p-16 overflow-y-auto bg-white flex-1 min-h-screen lg:min-h-0">
        <div className="max-w-[420px] w-full mx-auto my-auto py-6 lg:py-0">
          {/* Mobile-Only Header Brand */}
          <div className="flex lg:hidden items-center mb-8 cursor-pointer group" onClick={() => navigate('/')}>
            <span className="text-2xl font-extrabold tracking-tight text-[#062452] leading-none">
              EDGE <span className="text-[#EAB308]">Academy</span>
            </span>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight mb-1.5">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500 font-normal">
              Sign in with your Technonex corporate credentials
            </p>
          </div>

          {successMsg && (
            <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2.5 shadow-xs">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full rounded-xl bg-[#F0F5FF] border border-transparent px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white focus:border-[#08306B] focus:ring-2 focus:ring-[#08306B]/20"
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl bg-[#F0F5FF] border border-transparent px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white focus:border-[#08306B] focus:ring-2 focus:ring-[#08306B]/20 pr-10"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.007 10.007 0 014.122-.963c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-3.903-3.903a3 3 0 11-4.243-4.243m4.242 4.242L3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1 pb-1">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-[#08306B] focus:ring-[#08306B]"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(form.email);
                  setForgotError('');
                  setForgotSuccess('');
                  setIsForgotModalOpen(true);
                }}
                className="text-xs font-semibold text-[#08306B] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#08306B] hover:bg-[#062452] px-6 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99] disabled:opacity-70 mt-2 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign in'}
            </button>
          </form>

          {/* Technonex Field Engineers Notice */}
          <div className="mt-8 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Internal Technonex Portal — Authorized Field Personnel Only</span>
          </div>
        </div>

        {/* Security badge at bottom */}
        <div className="text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5 pt-4">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Protected enterprise access</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-slate-200 relative">
            <div className="flex items-start justify-between pb-3">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Forgot Password?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your registered work email to receive a password reset link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition p-1 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {forgotSuccess ? (
              <div className="py-4 space-y-4">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{forgotSuccess}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Please check your inbox (and spam folder) for the reset instructions. The reset link is valid for 60 minutes.
                </p>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="w-full py-3 bg-[#08306B] hover:bg-[#062452] text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="mt-4 space-y-4">
                {forgotError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-600">
                    {forgotError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    WORK EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                    className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B] transition"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 bg-[#08306B] hover:bg-[#062452] text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Sending Link...</span>
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;
