import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import api from '../services/api';

const Profile = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/me/profile');
        const userData = response.data || {};
        setUserProfile(userData);
        setFormData({
          fullName: userData.full_name || userData.fullName || user?.fullName || '',
          email: userData.email || user?.email || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    if (formData.newPassword) {
      if (!formData.currentPassword) {
        setError('Current password is required to change password.');
        setSaving(false);
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New password and confirm password do not match.');
        setSaving(false);
        return;
      }
      if (formData.newPassword.length < 8) {
        setError('Password must be at least 8 characters long.');
        setSaving(false);
        return;
      }
    }

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
      };

      if (formData.newPassword) {
        payload.currentPassword = formData.currentPassword;
        payload.newPassword = formData.newPassword;
      }

      const response = await api.put('/me/profile', payload);
      const updated = response.data?.user || response.data || {};

      setUserProfile((prev) => ({ ...prev, ...updated }));
      if (updated.token) {
        login(formData.email, formData.newPassword || formData.currentPassword);
      }

      setMessage('Profile updated successfully.');
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const displayRole = (userProfile?.role || user?.role || 'agent').replace('_', ' ');
  const displayTeam = userProfile?.team_id?.name || 'Service Delivery';
  const initialLetter = (formData.fullName || user?.fullName || 'K')[0]?.toUpperCase() || 'K';

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col">
      {/* Top Navbar Matching Reference Header */}
      <header className="h-16 bg-white border-b border-slate-200/80 text-slate-800 flex items-center justify-between px-4 sm:px-6 z-20 shadow-xs">
        {/* Left: Back Button */}
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-600 hover:text-slate-900 transition p-2 -ml-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-sm font-medium cursor-pointer"
            title="Go Back"
            aria-label="Go Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        </div>

        {/* Right: Notification Bell & STATIC Profile Badge */}
        <div className="flex items-center gap-5">
          <NotificationBell />

          {/* Static Top-Right Corner Profile (No click action) */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="h-8 w-8 rounded-full bg-[#08306B] text-white flex items-center justify-center font-bold text-xs shadow-xs select-none">
              {initialLetter}
            </div>
            <span className="text-xs font-semibold text-slate-800 hidden sm:inline select-none">
              {formData.fullName || user?.fullName || 'User Profile'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 sm:p-10 max-w-5xl w-full mx-auto">
        {/* Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Profile</h1>
          <p className="text-sm text-slate-500 font-normal mt-1">Manage your account details.</p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm italic">Loading profile details...</div>
        ) : (
          /* Profile Card Container Matching Reference Image */
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 shadow-xs max-w-2xl">
            {/* Feedback Alerts */}
            {message && (
              <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{message}</span>
              </div>
            )}
            {error && (
              <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Role Pill */}
              <div>
                <span className="inline-block px-3.5 py-1 bg-[#EBF3FC] text-[#1E40AF] text-xs font-semibold rounded-full capitalize">
                  {displayRole}
                </span>
              </div>

              {/* Full Name & Email (2-Column Responsive Grid) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    FULL NAME
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B] transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    EMAIL
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B] transition"
                  />
                </div>
              </div>

              {/* Password Section */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  CHANGE PASSWORD (OPTIONAL)
                </label>

                {/* Current Password */}
                <div className="mb-4">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    CURRENT PASSWORD
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 bg-[#EBF3FC] border border-blue-100 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B] transition"
                  />
                </div>

                {/* New Password & Confirm Password (2-Column Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      NEW PASSWORD
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      CONFIRM PASSWORD
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B] transition"
                    />
                  </div>
                </div>

                {/* Password Criteria Notice */}
                <p className="text-xs text-slate-500 mt-2.5 font-normal leading-relaxed">
                  Password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, and one number.
                </p>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#092857] hover:bg-[#071F44] text-white text-sm font-semibold rounded-xl shadow-xs transition duration-150 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default Profile;
