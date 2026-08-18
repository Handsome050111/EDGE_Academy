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
          // If server is on older cache or endpoint not found, proceed to allow submission
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
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white flex flex-col lg:flex-row font-sans">
      {/* Left Side: Brand Panel */}
      <div className="lg:w-1/2 bg-[#062452] p-8 lg:p-14 xl:p-16 flex flex-col justify-between text-white relative overflow-hidden shrink-0">
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
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/app-logo.png" alt="EDGE Academy Logo" className="h-9 w-9 rounded-xl object-contain shadow-xs" />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none">
                Technone<span className="text-red-500">X</span>
              </span>
              <span className="text-[11px] font-semibold text-blue-200/80 tracking-wider">EDGE Academy</span>
            </div>
          </div>
        </div>

        {/* Middle Copy */}
        <div className="relative z-10 max-w-md my-auto py-12">
          <div className="inline-flex items-center gap-2 bg-blue-400/10 border border-blue-300/20 text-blue-200 text-xs px-3.5 py-1.5 rounded-full font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Account Activation Portal
          </div>
          <h1 className="text-3xl lg:text-4xl xl:text-[40px] font-bold leading-tight text-white mb-4 tracking-tight">
            Welcome to the Team<span className="font-light text-blue-300 animate-pulse">|</span>
          </h1>
          <p className="text-sm lg:text-base text-blue-200/80 leading-relaxed font-normal">
            Activate your corporate account to access personalized curriculum tracks, hands-on field assessments, and verified certifications.
          </p>
        </div>

        {/* Bottom Product Footer */}
        <div className="relative z-10 text-xs text-blue-200/60 font-medium">
          © {new Date().getFullYear()} Technonex GmbH. All rights reserved.
        </div>
      </div>

      {/* Right Side: Activation Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 overflow-y-auto bg-slate-50/50">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100 relative">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="h-10 w-10 border-3 border-[#08306B] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-semibold text-slate-600">Verifying your invitation token...</p>
            </div>
          ) : success ? (
            <div className="text-center py-8 space-y-5">
              <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Account Activated!</h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Your password has been set successfully. Redirecting you to the login screen...
                </p>
              </div>
              <button
                onClick={() => navigate('/login', { state: { activatedEmail: inviteInfo?.email } })}
                className="w-full py-3 bg-[#08306B] hover:bg-[#062452] text-white font-bold text-sm rounded-xl transition cursor-pointer"
              >
                Go to Login Now →
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
                <h2 className="text-xl font-bold text-slate-900">Invalid or Expired Link</h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{error}</p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-[#08306B] hover:bg-[#062452] text-white font-bold text-sm rounded-xl transition cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-blue-50 text-[#08306B] text-xs font-bold rounded-full capitalize">
                    {inviteInfo?.role?.replace('_', ' ') || 'Engineer'}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create Your Password</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Activating account for <strong className="text-slate-800 font-semibold">{inviteInfo?.email}</strong>
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    SET PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B] transition pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B] transition"
                  />
                </div>

                {/* Password Criteria Checklist */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-500">
                  <p className="font-bold text-slate-600 mb-1 text-[11px] uppercase tracking-wider">Security Requirements:</p>
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
                      <span className={passwordsMatch ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                        {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || !isPasswordValid}
                  className="w-full py-3.5 bg-[#08306B] hover:bg-[#062452] text-white font-bold text-sm rounded-xl shadow-md transition duration-150 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
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
