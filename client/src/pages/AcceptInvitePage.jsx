import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const AcceptInvitePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Typewriter Animation State
  const phrases = [
    'Welcome to the Team',
    'Mastering Field Engineering',
    'Accelerating Technical Growth',
    'Certified Enterprise Standards',
  ];
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typedText, setTypedText] = useState('Welcome to the Team');
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
    if (!token) {
      setError('No invitation token provided. Please use the link sent to your email.');
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/auth/invite/${token}`);
        setInviteInfo(res.data);
      } catch (err) {
        if (err.response?.status === 400) {
          setError(err.response?.data?.message || 'Invalid or expired invitation token. Please request a new invite.');
        } else {
          // If server is on older cache or fallback mode, allow submission
          setInviteInfo({ role: 'Engineer' });
        }
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const hasLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password && password === confirmPassword;
  const isPasswordValid = hasLength && hasMixedCase && hasNumber && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (!isPasswordValid) {
      setError('Please ensure your password meets all required security criteria.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await api.post('/auth/accept-invite', {
        token,
        password,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { state: { activatedEmail: inviteInfo?.email } });
      }, 2200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate account. Please try again.');
    } finally {
      setSubmitting(false);
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
          <div className="inline-flex items-center gap-2 bg-blue-400/10 border border-blue-300/20 text-blue-200 text-xs px-3.5 py-1.5 rounded-full font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Account Activation Portal
          </div>
          <h1 className="text-3xl lg:text-4xl xl:text-[42px] font-bold leading-tight text-white mb-4 tracking-tight min-h-[96px] sm:min-h-[110px]">
            <span>{typedText}</span>
            <span className="inline-block w-[3.5px] h-[0.82em] bg-blue-300 ml-1.5 align-baseline animate-pulse rounded-full"></span>
          </h1>
          <p className="text-sm lg:text-base text-blue-200/80 leading-relaxed font-normal">
            Activate your corporate account to access personalized curriculum tracks, dynamic assessments, and verified certifications.
          </p>
        </div>

        {/* Bottom Product Footer */}
        <div className="relative z-10 text-center lg:text-left text-xs text-blue-200/60 font-medium">
          © {new Date().getFullYear()} Technonex GmbH. All rights reserved.
        </div>
      </div>

      {/* Right Side: Activation Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-8 lg:p-14 xl:p-16 overflow-y-auto bg-white flex-1 min-h-screen lg:min-h-0">
        <div className="max-w-[420px] w-full mx-auto my-auto py-6 lg:py-0">
          {/* Mobile-Only Header Brand */}
          <div className="flex lg:hidden items-center mb-8 cursor-pointer group" onClick={() => navigate('/')}>
            <span className="text-2xl font-extrabold tracking-tight text-[#062452] leading-none">
              EDGE <span className="text-[#EAB308]">Academy</span>
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="h-10 w-10 border-3 border-[#08306B] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-semibold text-slate-600">Verifying invitation token...</p>
            </div>
          ) : success ? (
            <div className="text-center py-8 space-y-5">
              <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
                  Account Activated!
                </h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Your password has been set successfully. Redirecting you to sign in...
                </p>
              </div>
              <button
                onClick={() => navigate('/login', { state: { activatedEmail: inviteInfo?.email } })}
                className="w-full rounded-xl bg-[#08306B] hover:bg-[#062452] px-6 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99] cursor-pointer"
              >
                Go to Sign In →
              </button>
            </div>
          ) : error && !inviteInfo ? (
            <div className="text-center py-8 space-y-5">
              <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Invalid or Expired Link</h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{error}</p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full rounded-xl bg-[#08306B] hover:bg-[#062452] px-6 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99] cursor-pointer"
              >
                Return to Sign In
              </button>
            </div>
          ) : (
            <div>
              {/* Form Header */}
              <div className="mb-8">
                {inviteInfo?.role && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#08306B] border border-blue-100 mb-3 capitalize">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#08306B]"></span>
                    {inviteInfo.role.replace('_', ' ')}
                  </div>
                )}
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight mb-1.5">
                  Create your password
                </h2>
                <p className="text-sm text-slate-500 font-normal">
                  {inviteInfo?.email ? (
                    <>
                      Activating corporate account for <span className="font-semibold text-slate-700">{inviteInfo.email}</span>
                    </>
                  ) : (
                    'Set your corporate credentials to activate your account'
                  )}
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-medium text-red-600 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="password">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="w-full rounded-xl bg-[#F0F5FF] border border-transparent px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white focus:border-[#08306B] focus:ring-2 focus:ring-[#08306B]/20 pr-10"
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

                {/* Confirm Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="w-full rounded-xl bg-[#F0F5FF] border border-transparent px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white focus:border-[#08306B] focus:ring-2 focus:ring-[#08306B]/20 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? (
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

                {/* Password Criteria Checklist */}
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">Security Requirements:</p>
                  <div className="flex items-center gap-2">
                    <span className={hasLength ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {hasLength ? '✓' : '•'} At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={hasMixedCase ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {hasMixedCase ? '✓' : '•'} Uppercase and lowercase letters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={hasNumber ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {hasNumber ? '✓' : '•'} At least one number
                    </span>
                  </div>
                  {confirmPassword && (
                    <div className="flex items-center gap-2">
                      <span className={passwordsMatch ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                        {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Call-to-Action Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || !isPasswordValid}
                  className="w-full rounded-xl bg-[#08306B] hover:bg-[#062452] px-6 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Activating Account...</span>
                    </>
                  ) : (
                    'Activate Account & Continue'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitePage;
