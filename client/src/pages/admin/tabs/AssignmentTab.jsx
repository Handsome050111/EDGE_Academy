import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import Pagination from '../../../components/Pagination';

const AssignmentTab = ({ showNotification }) => {
  const { t } = useTranslation();

  // Sub-view Toggle ('dispatch' | 'list')
  const [activeSubTab, setActiveSubTab] = useState('dispatch');

  // Core Options
  const [tracks, setTracks] = useState([]);
  const [modules, setModules] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Assignment List State
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('all');
  const [assignmentsPage, setAssignmentsPage] = useState(1);

  // Assignment Form State
  const [assignmentScope, setAssignmentScope] = useState('module'); // 'module' | 'track'
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');

  const [assignmentTarget, setAssignmentTarget] = useState('engineer'); // 'engineer' | 'team'
  const [selectedEngineerIds, setSelectedEngineerIds] = useState([]);
  const [selectedTeamLeadId, setSelectedTeamLeadId] = useState('');
  const [deadlineAt, setDeadlineAt] = useState('');

  // Engineer search in form
  const [engineerSearch, setEngineerSearch] = useState('');

  // Result summary
  const [lastAssignmentResult, setLastAssignmentResult] = useState(null);

  useEffect(() => {
    loadPrerequisites();
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoadingAssignments(true);
      const res = await api.get('/admin/assignments?limit=200');
      const list = res.data?.assignments || (Array.isArray(res.data) ? res.data : []);
      setAssignmentsList(list);
    } catch (err) {
      console.error('Failed to load assignments list:', err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const loadPrerequisites = async () => {
    setLoading(true);
    try {
      const [tracksRes, modulesRes, usersRes, teamsRes, teamLeadsRes] = await Promise.all([
        api.get('/tracks'),
        api.get('/modules'),
        api.get('/admin/users'),
        api.get('/admin/teams').catch(() => ({ data: [] })),
        api.get('/admin/team-leads').catch(() => ({ data: [] })),
      ]);

      const tr = tracksRes.data || [];
      const mo = modulesRes.data || [];
      setTracks(tr);
      setModules(mo);
      if (tr.length > 0) setSelectedTrackId(tr[0]._id);
      if (mo.length > 0) setSelectedModuleId(mo[0]._id);

      const allUsers = usersRes.data || [];
      const engs = allUsers.filter((u) => {
        const r = (u.role || '').toLowerCase().replace(/[^a-z]/g, '');
        return r === 'engineer' || r === 'fieldengineer' || r === 'agent';
      });
      setEngineers(engs);

      let leads = teamLeadsRes.data || [];
      if (!Array.isArray(leads) || leads.length === 0) {
        leads = allUsers.filter((u) => {
          const r = (u.role || '').toLowerCase().replace(/[^a-z]/g, '');
          return r === 'teamlead' || r === 'lead';
        });
      }
      setTeamLeads(leads);
      if (leads.length > 0) {
        setSelectedTeamLeadId(leads[0]._id);
      }

      setTeams(teamsRes.data || []);
    } catch (err) {
      showNotification('error', 'Failed to load assignment dependencies');
    } finally {
      setLoading(false);
    }
  };

  // Helper to resolve all engineers assigned under a Team Lead
  const getEngineersUnderLead = (leadId, leadTeamId) => {
    if (!leadId && !leadTeamId) return [];
    return engineers.filter((eng) => {
      const engLeadId = eng.team_lead_id?._id || eng.team_lead_id;
      const engTeamId = eng.team_id?._id || eng.team_id;

      const matchesLead = leadId && engLeadId && String(engLeadId) === String(leadId);
      const matchesTeam = leadTeamId && engTeamId && String(engTeamId) === String(leadTeamId);

      return matchesLead || matchesTeam;
    });
  };

  // Filtered Engineers by search query
  const filteredEngineers = engineers.filter((eng) => {
    if (!engineerSearch.trim()) return true;
    const q = engineerSearch.toLowerCase().trim();
    const name = (eng.fullName || eng.full_name || '').toLowerCase();
    const email = (eng.email || '').toLowerCase();
    const team = (eng.team_id?.name || '').toLowerCase();
    return name.includes(q) || email.includes(q) || team.includes(q);
  });

  const handleToggleEngineer = (engId) => {
    setSelectedEngineerIds((prev) =>
      prev.includes(engId) ? prev.filter((id) => id !== engId) : [...prev, engId]
    );
  };

  const handleSelectAllEngineers = () => {
    if (selectedEngineerIds.length === filteredEngineers.length) {
      setSelectedEngineerIds([]);
    } else {
      setSelectedEngineerIds(filteredEngineers.map((e) => e._id || e.id));
    }
  };

  // Selected Team Lead metadata & engineers
  const selectedLeadObj = teamLeads.find((l) => String(l._id) === String(selectedTeamLeadId));
  const leadTeamId = selectedLeadObj?.team_id?._id || selectedLeadObj?.team_id;
  const leadEngineers = selectedLeadObj ? getEngineersUnderLead(selectedLeadObj._id, leadTeamId) : [];
  const selectedLeadDisplayName = selectedLeadObj?.fullName || selectedLeadObj?.full_name || selectedLeadObj?.email || 'Team Lead';

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();

    if (assignmentTarget === 'engineer' && selectedEngineerIds.length === 0) {
      showNotification('error', 'Please select at least one engineer.');
      return;
    }

    if (assignmentTarget === 'team') {
      if (!selectedTeamLeadId) {
        showNotification('error', 'Please select a Team Lead.');
        return;
      }
      if (leadEngineers.length === 0) {
        showNotification('error', `No active engineers are currently assigned under the team of ${selectedLeadDisplayName}. Assign engineers to this lead in User Management first.`);
        return;
      }
    }

    if (assignmentScope === 'module' && !selectedModuleId) {
      showNotification('error', 'Please select a module.');
      return;
    }

    if (assignmentScope === 'track' && !selectedTrackId) {
      showNotification('error', 'Please select a track.');
      return;
    }

    setSubmitLoading(true);
    setLastAssignmentResult(null);

    try {
      let targetModuleIds = [];
      if (assignmentScope === 'module') {
        targetModuleIds = [selectedModuleId];
      } else {
        const trackMods = modules.filter((m) => {
          const tId = (m.track_id?._id || m.track_id || m.trackId?._id || m.trackId)?.toString();
          return tId === selectedTrackId.toString();
        });
        if (trackMods.length === 0) {
          showNotification('error', 'Selected track contains no modules.');
          setSubmitLoading(false);
          return;
        }
        targetModuleIds = trackMods.map((m) => m._id);
      }

      // Resolve recipient engineer IDs
      const targetEngineerIds = assignmentTarget === 'engineer'
        ? selectedEngineerIds
        : leadEngineers.map((e) => e._id || e.id);

      let totalAssigned = 0;
      for (const modId of targetModuleIds) {
        const payload = {
          module_id: modId,
          engineer_ids: targetEngineerIds,
          team_lead_id: assignmentTarget === 'team' ? selectedTeamLeadId : undefined,
          team_id: assignmentTarget === 'team' ? (leadTeamId || undefined) : undefined,
          deadline_at: deadlineAt || null,
        };

        const res = await api.post('/admin/assignments', payload);
        totalAssigned += res.data.createdCount || targetEngineerIds.length;
      }

      const summaryText = assignmentTarget === 'team'
        ? `Successfully assigned ${targetModuleIds.length} module(s) to the overall team of ${selectedLeadDisplayName} (${targetEngineerIds.length} engineer(s))!`
        : assignmentScope === 'track'
          ? `Successfully assigned all ${targetModuleIds.length} modules of track to ${targetEngineerIds.length} engineer(s)!`
          : `Successfully assigned module to ${targetEngineerIds.length} engineer(s)!`;

      showNotification('success', summaryText);
      setLastAssignmentResult({
        count: totalAssigned,
        modulesCount: targetModuleIds.length,
        recipientsCount: targetEngineerIds.length,
        leadName: assignmentTarget === 'team' ? selectedLeadDisplayName : null,
        deadline: deadlineAt ? new Date(deadlineAt).toLocaleDateString() : 'None',
      });

      // Reset selection
      if (assignmentTarget === 'engineer') {
        setSelectedEngineerIds([]);
      }
      setDeadlineAt('');
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Assignment failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Filtered Assignments List
  const filteredAssignmentsList = useMemo(() => {
    return assignmentsList.filter((item) => {
      const eng = item.engineer_id || item.userId || {};
      const mod = item.module_id || item.moduleId || {};
      const track = mod.track_id || mod.trackId || {};
      const assigner = item.assigned_by || item.assignedBy || {};

      const engName = (eng.fullName || eng.full_name || eng.name || '').toLowerCase();
      const engEmail = (eng.email || '').toLowerCase();
      const modTitle = (mod.title || '').toLowerCase();
      const trackTitle = (track.title || track.name || '').toLowerCase();
      const assignerName = (assigner.fullName || assigner.full_name || assigner.name || '').toLowerCase();
      const q = assignmentSearch.toLowerCase().trim();

      const matchesSearch =
        !q ||
        engName.includes(q) ||
        engEmail.includes(q) ||
        modTitle.includes(q) ||
        trackTitle.includes(q) ||
        assignerName.includes(q);

      const statusVal = item.computed_status || item.status || 'pending';
      const matchesStatus =
        assignmentStatusFilter === 'all'
          ? true
          : assignmentStatusFilter === 'overdue'
          ? Boolean(item.is_overdue || statusVal === 'overdue')
          : statusVal === assignmentStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [assignmentsList, assignmentSearch, assignmentStatusFilter]);

  const paginatedAssignmentsList = useMemo(() => {
    return filteredAssignmentsList.slice((assignmentsPage - 1) * 10, assignmentsPage * 10);
  }, [filteredAssignmentsList, assignmentsPage]);

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Assignment Engine</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign modules or full tracks to individual engineers or entire teams with completion deadlines
          </p>
        </div>

        {/* Sub-view Toggle */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('dispatch')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'dispatch'
                ? 'bg-white text-[#08306B] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Dispatch Assignments</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('list');
              fetchAssignments();
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'list'
                ? 'bg-white text-[#08306B] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>View All Assignments ({assignmentsList.length})</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'list' && (
        <div className="space-y-4">
          {/* Search and Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center gap-3 w-full justify-between">
            <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={assignmentSearch}
                onChange={(e) => {
                  setAssignmentSearch(e.target.value);
                  setAssignmentsPage(1);
                }}
                placeholder="Search by engineer name, email, module, or track..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none transition font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <select
                value={assignmentStatusFilter}
                onChange={(e) => {
                  setAssignmentStatusFilter(e.target.value);
                  setAssignmentsPage(1);
                }}
                className="w-full sm:w-auto min-w-[140px] max-w-full sm:max-w-[220px] md:max-w-[280px] truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-700 font-medium outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
              >
                <option value="all" className="truncate">All Statuses</option>
                <option value="pending" className="truncate">Pending</option>
                <option value="in_progress" className="truncate">In Progress</option>
                <option value="completed" className="truncate">Completed</option>
                <option value="overdue" className="truncate">Overdue</option>
              </select>
            </div>
          </div>

          {/* Assignments Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {loadingAssignments ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-8 h-8 border-3 border-[#08306B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-semibold">Loading assignments...</p>
              </div>
            ) : filteredAssignmentsList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800">No assignments found</p>
                <p className="text-xs text-slate-400">
                  {assignmentSearch || assignmentStatusFilter !== 'all'
                    ? 'Try adjusting your search filters.'
                    : 'No assignments have been dispatched yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Engineer</th>
                      <th className="px-4 py-3.5">Assigned Module & Track</th>
                      <th className="px-4 py-3.5">Assigned By</th>
                      <th className="px-4 py-3.5">Assigned Date</th>
                      <th className="px-4 py-3.5">Deadline</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedAssignmentsList.map((item) => {
                      const eng = item.engineer_id || item.userId || {};
                      const mod = item.module_id || item.moduleId || {};
                      const track = mod.track_id || mod.trackId || {};
                      const assigner = item.assigned_by || item.assignedBy || {};
                      const statusVal = item.computed_status || item.status || 'pending';
                      const isOverdue = item.is_overdue || statusVal === 'overdue';

                      return (
                        <tr key={item._id} className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-[#08306B] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {(eng.fullName || eng.full_name || eng.name || eng.email || 'E')[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">
                                  {eng.fullName || eng.full_name || eng.name || 'Unknown Engineer'}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">{eng.email || 'No email'}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-semibold text-slate-900">{mod.title || 'Training Module'}</p>
                              <p className="text-[11px] text-slate-400">
                                {track.title || track.name || 'Curriculum Track'} {track.tier ? `· ${track.tier}` : ''}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="font-medium text-slate-800">{assigner.fullName || assigner.full_name || 'Administrator'}</p>
                            <p className="text-[11px] text-slate-400 capitalize">{assigner.role || 'Admin'}</p>
                          </td>

                          <td className="px-4 py-3.5 text-slate-500">
                            {new Date(item.assigned_at || item.createdAt || Date.now()).toLocaleDateString()}
                          </td>

                          <td className="px-4 py-3.5">
                            {item.deadline_at ? (
                              <span className={`font-medium ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                                {new Date(item.deadline_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">No deadline</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isOverdue
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : statusVal === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : statusVal === 'in_progress'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {isOverdue && (
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                              )}
                              {isOverdue ? 'Overdue' : statusVal.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {!loadingAssignments && filteredAssignmentsList.length > 0 && (
              <div className="p-3.5 sm:p-4 border-t border-slate-100">
                <Pagination
                  currentPage={assignmentsPage}
                  totalItems={filteredAssignmentsList.length}
                  pageSize={10}
                  onPageChange={setAssignmentsPage}
                  itemLabel="assignments"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'dispatch' && (
        <>
          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#08306B] border-t-transparent mx-auto" />
              <p className="text-xs text-slate-500 mt-2 font-medium">Loading teams and curriculum...</p>
            </div>
          ) : (
        <form onSubmit={handleSubmitAssignment} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Scope & Target Selector */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Assignment Scope (Module vs Track) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#08306B] text-white text-[11px] font-bold">1</span>
                Select Curriculum Scope
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                    assignmentScope === 'module'
                      ? 'bg-blue-50/70 border-[#08306B] ring-1 ring-[#08306B]'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="assignScope"
                    value="module"
                    checked={assignmentScope === 'module'}
                    onChange={() => setAssignmentScope('module')}
                    className="text-[#08306B]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Single Module</p>
                    <p className="text-[11px] text-slate-500">Assign a specific individual module</p>
                  </div>
                </label>

                <label
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                    assignmentScope === 'track'
                      ? 'bg-blue-50/70 border-[#08306B] ring-1 ring-[#08306B]'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="assignScope"
                    value="track"
                    checked={assignmentScope === 'track'}
                    onChange={() => setAssignmentScope('track')}
                    className="text-[#08306B]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Entire Track (Sequential)</p>
                    <p className="text-[11px] text-slate-500">Assign all modules within a track</p>
                  </div>
                </label>
              </div>

              {/* Dynamic Dropdown based on Scope */}
              {assignmentScope === 'module' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Module *</label>
                  <select
                    value={selectedModuleId}
                    onChange={(e) => setSelectedModuleId(e.target.value)}
                    className="w-full truncate px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none bg-white font-medium"
                  >
                    {modules.map((m) => (
                      <option key={m._id} value={m._id} className="truncate">
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Track *</label>
                  <select
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    className="w-full truncate px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none bg-white font-medium"
                  >
                    {tracks.map((t) => {
                      const count = modules.filter((m) => {
                        const tId = (m.track_id?._id || m.track_id || m.trackId)?.toString();
                        return tId === t._id.toString();
                      }).length;

                      return (
                        <option key={t._id} value={t._id} className="truncate">
                          {t.name} ({count} Modules)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Section 2: Target Selection (Engineers vs Team) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#08306B] text-white text-[11px] font-bold">2</span>
                Select Target Recipients
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                    assignmentTarget === 'engineer'
                      ? 'bg-blue-50/70 border-[#08306B] ring-1 ring-[#08306B]'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="assignTarget"
                    value="engineer"
                    checked={assignmentTarget === 'engineer'}
                    onChange={() => setAssignmentTarget('engineer')}
                    className="text-[#08306B]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Specific Engineers</p>
                    <p className="text-[11px] text-slate-500">Choose one or more individuals</p>
                  </div>
                </label>

                <label
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                    assignmentTarget === 'team'
                      ? 'bg-blue-50/70 border-[#08306B] ring-1 ring-[#08306B]'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="assignTarget"
                    value="team"
                    checked={assignmentTarget === 'team'}
                    onChange={() => setAssignmentTarget('team')}
                    className="text-[#08306B]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Entire Team (by Team Lead)</p>
                    <p className="text-[11px] text-slate-500">Assign to overall team of selected lead</p>
                  </div>
                </label>
              </div>

              {/* Specific Engineers Multi-Select List */}
              {assignmentTarget === 'engineer' ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={engineerSearch}
                      onChange={(e) => setEngineerSearch(e.target.value)}
                      placeholder="Search engineers by name, email, or team..."
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleSelectAllEngineers}
                      className="text-xs font-semibold text-[#08306B] hover:underline px-2 cursor-pointer shrink-0"
                    >
                      {selectedEngineerIds.length === filteredEngineers.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {filteredEngineers.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-500">No engineers found matching query.</p>
                    ) : (
                      filteredEngineers.map((eng) => {
                        const isChecked = selectedEngineerIds.includes(eng._id || eng.id);
                        return (
                          <label
                            key={eng._id || eng.id}
                            className={`flex items-center justify-between px-3.5 py-2 text-xs transition cursor-pointer ${
                              isChecked ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleEngineer(eng._id || eng.id)}
                                className="rounded text-[#08306B] focus:ring-[#08306B]"
                              />
                              <div>
                                <p className="font-semibold text-slate-900">{eng.fullName || eng.full_name}</p>
                                <p className="text-[11px] text-slate-500">{eng.email}</p>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">{eng.team_id?.name || 'No Team'}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Selected: <strong className="text-slate-800">{selectedEngineerIds.length}</strong> engineer(s)
                  </p>
                </div>
              ) : (
                /* Entire Team Dropdown (by Team Lead) */
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Team Lead / Entire Team *
                    </label>

                    {teamLeads.length === 0 ? (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        <p className="font-semibold">No Team Leads Found</p>
                        <p className="mt-0.5 text-amber-700">
                          Create or promote a user to the <strong>Team Lead</strong> role in User Management to assign by team.
                        </p>
                      </div>
                    ) : (
                      <select
                        value={selectedTeamLeadId}
                        onChange={(e) => setSelectedTeamLeadId(e.target.value)}
                        className="w-full truncate px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none bg-white font-semibold text-slate-800"
                      >
                        {teamLeads.map((lead) => {
                          const leadName = lead.fullName || lead.full_name || lead.email;
                          const leadTeam = lead.team_id?.name || 'role team lead';
                          const leadId = lead._id || lead.id;
                          const leadTeamIdVal = lead.team_id?._id || lead.team_id;
                          const count = getEngineersUnderLead(leadId, leadTeamIdVal).length;

                          return (
                            <option key={leadId} value={leadId} className="truncate">
                              Team of {leadName} ({leadTeam}) — {count} engineer{count === 1 ? '' : 's'}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>

                  {/* Team Preview Card */}
                  {selectedLeadObj && (
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-800">
                          Assigning to overall team of: <span className="text-[#08306B]">{selectedLeadDisplayName}</span>
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          leadEngineers.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {leadEngineers.length} Engineer{leadEngineers.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {leadEngineers.length > 0 ? (
                        <div className="pt-1.5 border-t border-slate-200">
                          <p className="text-[11px] font-medium text-slate-500 mb-1">Team Members:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {leadEngineers.map((eng) => (
                              <span
                                key={eng._id || eng.id}
                                className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-700"
                              >
                                {eng.fullName || eng.full_name || eng.email}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-700 italic pt-1 border-t border-slate-200">
                          No active engineers are assigned to this Team Lead yet. You can link engineers to {selectedLeadDisplayName} via the User Management tab.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right 1 Col: Deadline & Dispatch Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#08306B] text-white text-[11px] font-bold">3</span>
                Deadline & Dispatch
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Completion Deadline (Optional)</label>
                <input
                  type="date"
                  value={deadlineAt}
                  onChange={(e) => setDeadlineAt(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">If set, automated reminder notifications will trigger before deadline.</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <p className="font-bold text-slate-800">Automated Dispatch Actions:</p>
                <ul className="text-[11px] text-slate-600 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>In-app notification bell dispatched</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Email notification queued with direct link</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Audit log entry recorded</span>
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full py-3 rounded-xl text-xs font-bold bg-[#08306B] text-white hover:bg-[#0a3d87] shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {submitLoading ? 'Dispatching Assignments...' : 'Dispatch Assignments'}
              </button>
            </div>

            {/* Last Execution Summary */}
            {lastAssignmentResult && (
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 shadow-xs text-xs space-y-2">
                <p className="font-bold text-emerald-900">
                  Last Dispatch Summary
                </p>
                {lastAssignmentResult.leadName && (
                  <p className="text-emerald-800">
                    Assigned to: <strong>Team of {lastAssignmentResult.leadName}</strong> ({lastAssignmentResult.recipientsCount} engineers)
                  </p>
                )}
                <p className="text-emerald-800">
                  Total module assignments generated: <strong>{lastAssignmentResult.count}</strong>
                </p>
                <p className="text-emerald-800">
                  Deadline applied: <strong>{lastAssignmentResult.deadline}</strong>
                </p>
              </div>
            )}
          </div>
        </form>
      )}
    </>
  )}
</div>
);
};

export default AssignmentTab;
