import { useState, useEffect } from 'react';
import api from '../services/api';

const UserInviteModal = ({ isOpen, onClose, onUserAdded }) => {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'invite'

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('engineer');
  const [locale, setLocale] = useState('en');
  const [teamLeadId, setTeamLeadId] = useState('');
  const [teamLeads, setTeamLeads] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteResult, setInviteResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      api.get('/admin/team-leads')
        .then((res) => {
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            setTeamLeads(res.data);
          } else {
            api.get('/admin/users?role=team_lead')
              .then((uRes) => {
                if (uRes.data && Array.isArray(uRes.data) && uRes.data.length > 0) {
                  setTeamLeads(uRes.data);
                } else {
                  api.get('/admin/users')
                    .then((allRes) => {
                      const leads = (allRes.data || []).filter(
                        (u) => (u.role || '').toLowerCase().replace(/[-_ ]/g, '') === 'teamlead'
                      );
                      setTeamLeads(leads);
                    })
                    .catch(() => setTeamLeads([]));
                }
              })
              .catch(() => setTeamLeads([]));
          }
        })
        .catch(() => {
          api.get('/admin/users?role=team_lead')
            .then((uRes) => setTeamLeads(uRes.data || []))
            .catch(() => setTeamLeads([]));
        });
      setTeamLeadId('');
      setError('');
      setSuccess('');
      setInviteResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await api.post('/admin/users', {
        fullName,
        email,
        password,
        role,
        locale,
        team_lead_id: role === 'engineer' ? (teamLeadId || null) : null,
      });

      setSuccess(`User '${res.data.user.email}' created successfully with role '${res.data.user.role}'!`);
      setFullName('');
      setEmail('');
      setPassword('');
      setTeamLeadId('');
      if (onUserAdded) onUserAdded(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviteResult(null);
    setLoading(true);

    try {
      const res = await api.post('/admin/users/invite', {
        fullName,
        email,
        role,
        locale,
        team_lead_id: role === 'engineer' ? (teamLeadId || null) : null,
      });

      setSuccess(`Invitation token generated for '${res.data.user.email}'!`);
      setInviteResult(res.data);
      setEmail('');
      setFullName('');
      setTeamLeadId('');
      if (onUserAdded) onUserAdded(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to invite user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h3 className="text-xl font-bold text-[#092857]">User Management & Invitations</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none text-xl font-bold cursor-pointer"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => { setActiveTab('create'); setError(''); setSuccess(''); setInviteResult(null); }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              activeTab === 'create' ? 'bg-white text-[#092857] shadow-xs' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Direct User Creation
          </button>
          <button
            onClick={() => { setActiveTab('invite'); setError(''); setSuccess(''); setInviteResult(null); }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              activeTab === 'invite' ? 'bg-white text-[#092857] shadow-xs' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Send Email Invitation
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 border border-red-100">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-600 border border-emerald-100">
            {success}
          </div>
        )}

        {inviteResult && (
          <div className="mt-3 rounded-xl bg-blue-50 p-3.5 border border-blue-100 text-xs space-y-1 text-blue-900">
            <p className="font-bold">Invitation Setup Link:</p>
            <p className="font-mono bg-white p-2 rounded border border-blue-200 select-all overflow-x-auto">
              {window.location.origin}{inviteResult.inviteLink}
            </p>
          </div>
        )}

        {activeTab === 'create' ? (
          <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Ali Sultan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857] focus:ring-1 focus:ring-[#092857]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. ali.sultan@technonex.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857] focus:ring-1 focus:ring-[#092857]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Initial Password
              </label>
              <input
                type="password"
                placeholder="Password123!"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857] focus:ring-1 focus:ring-[#092857]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Assign Role
                </label>
                <select
                  value={role}
                  onChange={(e) => {
                    const newR = e.target.value;
                    setRole(newR);
                    if (newR !== 'engineer') setTeamLeadId('');
                  }}
                  className="w-full truncate rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857] focus:ring-1 focus:ring-[#092857]"
                >
                  <option value="engineer" className="truncate">Engineer</option>
                  <option value="team_lead" className="truncate">Team Lead</option>
                  <option value="admin" className="truncate">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Language
                </label>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="w-full truncate rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857] focus:ring-1 focus:ring-[#092857]"
                >
                  <option value="en" className="truncate">English (EN)</option>
                  <option value="de" className="truncate">German (DE)</option>
                </select>
              </div>
            </div>

            {role === 'engineer' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Assign Team Lead (Optional)
                </label>
                <select
                  value={teamLeadId}
                  onChange={(e) => setTeamLeadId(e.target.value)}
                  className="w-full truncate rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857] focus:ring-1 focus:ring-[#092857]"
                >
                  <option value="" className="truncate">-- Unassigned / Assign Later --</option>
                  {teamLeads.map((lead) => (
                    <option key={lead._id} value={lead._id} className="truncate">
                      {lead.fullName || lead.full_name || lead.name} ({lead.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#092857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#071f45] transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleInviteUser} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Recipient Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Klaus Weber"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                placeholder="klaus.weber@technonex.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Assign Role
                </label>
                <select
                  value={role}
                  onChange={(e) => {
                    const newR = e.target.value;
                    setRole(newR);
                    if (newR !== 'engineer') setTeamLeadId('');
                  }}
                  className="w-full truncate rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857] focus:ring-1 focus:ring-[#092857]"
                >
                  <option value="engineer" className="truncate">Engineer</option>
                  <option value="team_lead" className="truncate">Team Lead</option>
                  <option value="admin" className="truncate">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Language
                </label>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="w-full truncate rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857] focus:ring-1 focus:ring-[#092857]"
                >
                  <option value="en" className="truncate">English (EN)</option>
                  <option value="de" className="truncate">German (DE)</option>
                </select>
              </div>
            </div>

            {role === 'engineer' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Assign Team Lead (Optional)
                </label>
                <select
                  value={teamLeadId}
                  onChange={(e) => setTeamLeadId(e.target.value)}
                  className="w-full truncate rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#092857] focus:ring-1 focus:ring-[#092857]"
                >
                  <option value="" className="truncate">-- Unassigned / Assign Later --</option>
                  {teamLeads.map((lead) => (
                    <option key={lead._id} value={lead._id} className="truncate">
                      {lead.fullName || lead.full_name || lead.name} ({lead.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#092857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#071f45] transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Sending...' : 'Generate Invite Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default UserInviteModal;
