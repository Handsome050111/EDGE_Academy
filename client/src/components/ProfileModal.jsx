import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ProfileModal = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const { user, login } = useAuth();

  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    locale: user?.locale || 'en',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      const fetchProfile = async () => {
        setLoading(true);
        try {
          const res = await api.get('/me/profile');
          const data = res.data || {};
          setUserProfile(data);
          setFormData({
            fullName: data.full_name || data.fullName || user?.fullName || '',
            email: data.email || user?.email || '',
            locale: data.locale || localStorage.getItem('language') || 'en',
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
        } catch {
          setFormData({
            fullName: user?.fullName || '',
            email: user?.email || '',
            locale: localStorage.getItem('language') || 'en',
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword) {
      if (!formData.currentPassword) {
        setError('Current password is required to change password.');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New password and confirm password do not match.');
        return;
      }
      if (formData.newPassword.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        locale: formData.locale || 'en',
      };

      if (formData.newPassword) {
        payload.currentPassword = formData.currentPassword;
        payload.newPassword = formData.newPassword;
      }

      const res = await api.put('/me/profile', payload);
      const updated = res.data?.user || res.data || {};

      setUserProfile((prev) => ({ ...prev, ...updated }));
      if (payload.locale) {
        i18n.changeLanguage(payload.locale);
        localStorage.setItem('language', payload.locale);
        localStorage.setItem('locale', payload.locale);
      }

      if (updated.token) {
        login(formData.email, formData.newPassword || formData.currentPassword);
      }

      setSuccess(t('common.success'));
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const displayRole = (userProfile?.role || user?.role || 'engineer').replace('_', ' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-8 sm:p-10 shadow-2xl border border-slate-200/80 my-8 relative">
        {/* Header with Title & Close Button */}
        <div className="flex items-start justify-between pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('profileModal.title')}</h2>
            <p className="text-sm text-slate-500 font-normal mt-0.5">{t('profileModal.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition p-2 -mr-2 -mt-2 rounded-xl text-lg font-bold cursor-pointer"
            title={t('common.close')}
          >
            &times;
          </button>
        </div>

        {/* Feedback Alerts */}
        {success && (
          <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm italic">{t('common.loading')}</div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
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
                  {t('profileModal.fullName')}
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
                  {t('profileModal.emailAddress')}
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

            {/* Language Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                {t('profileModal.platformLanguage')}
              </label>
              <select
                name="locale"
                value={formData.locale}
                onChange={handleChange}
                className="w-full truncate px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B] transition"
              >
                <option value="en" className="truncate">{t('profileModal.english')}</option>
                <option value="de" className="truncate">{t('profileModal.german')}</option>
              </select>
            </div>

            {/* Password Section */}
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                {t('profileModal.changePassword')}
              </label>

              {/* Current Password */}
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t('profileModal.currentPassword')}
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
                    {t('profileModal.newPassword')}
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
                    {t('profileModal.confirmNewPassword')}
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
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#092857] hover:bg-[#071F44] text-white text-sm font-semibold rounded-xl shadow-xs transition duration-150 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{t('common.saving')}</span>
                  </>
                ) : (
                  t('profileModal.updateProfile')
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
