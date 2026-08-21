import { useState, useEffect } from 'react';
import api from '../services/api';

const AssignTeamLeadModal = ({ isOpen, onClose, user, teamLeads = [], onAssigned }) => {
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [leadsList, setLeadsList] = useState(teamLeads);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (teamLeads && teamLeads.length > 0) {
      setLeadsList(teamLeads);
    } else if (isOpen) {
      api.get('/admin/team-leads')
        .then((res) => {
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            setLeadsList(res.data);
          } else {
            api.get('/admin/users?role=team_lead')
              .then((uRes) => setLeadsList(uRes.data || []))
              .catch(() => {});
          }
        })
        .catch(() => {
          api.get('/admin/users?role=team_lead')
            .then((uRes) => setLeadsList(uRes.data || []))
            .catch(() => {});
        });
    }
  }, [teamLeads, isOpen]);

  useEffect(() => {
    if (user) {
      const currentLeadId = typeof user.team_lead_id === 'object' && user.team_lead_id !== null
        ? user.team_lead_id._id
        : (user.team_lead_id || (user.team_id?.lead_user_id?._id || user.team_id?.lead_user_id || ''));
      setSelectedLeadId(currentLeadId || '');
      setError('');
      setSuccess('');
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  // Resolve current lead's display name
  const currentLeadName = typeof user.team_lead_id === 'object' && user.team_lead_id !== null
    ? (user.team_lead_id.fullName || user.team_lead_id.full_name || user.team_lead_id.email)
    : (typeof user.team_id === 'object' && user.team_id?.lead_user_id
      ? (user.team_id.lead_user_id.fullName || user.team_id.lead_user_id.full_name || user.team_id.lead_user_id.email || user.team_id.name)
      : '');

  const handleAssignLead = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.put(`/admin/users/${user._id}/team-lead`, {
        teamLeadId: selectedLeadId || null,
      }).catch(async (err) => {
        if (err.response?.status === 404) {
          return await api.put(`/admin/users/${user._id}/team`, {
            teamLeadId: selectedLeadId || null,
            teamId: selectedLeadId || null,
          });
        }
        throw err;
      });

      setSuccess(res.data.message || 'Team Lead assigned successfully!');
      if (onAssigned) {
        onAssigned(res.data.user || { ...user, team_lead_id: selectedLeadId || null });
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update Team Lead assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-150">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Assign Team Lead</h3>
            <p className="text-xs text-slate-500 mt-0.5">Assign a Team Lead to supervise and guide this engineer</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* User Snapshot Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Engineer:</span>
            <span className="font-bold text-slate-900">{user.fullName || user.full_name || user.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Email:</span>
            <span className="font-mono text-slate-700">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Current Team Lead:</span>
            {currentLeadName ? (
              <span className="bg-blue-50 text-[#08306B] font-bold px-2.5 py-0.5 rounded-md border border-blue-200">
                {currentLeadName}
              </span>
            ) : (
              <span className="bg-amber-50 text-amber-800 font-bold px-2.5 py-0.5 rounded-md border border-amber-200">
                Unassigned
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleAssignLead} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Team Lead
            </label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full truncate rounded-xl border border-slate-300 p-3 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B]"
            >
              <option value="" className="truncate">-- Unassigned (No Team Lead) --</option>
              {leadsList.map((lead) => {
                const leadName = lead.fullName || lead.full_name || lead.name || lead.email;
                return (
                  <option key={lead._id || lead.id} value={lead._id || lead.id} className="truncate">
                    {leadName} ({lead.email})
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Upon assignment, both the Engineer and the Team Lead will automatically receive in-app and email notifications.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#092857] hover:bg-[#071f45] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save Team Lead Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignTeamLeadModal;
