import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import Pagination from '../../../components/Pagination';
import UserInviteModal from '../../../components/UserInviteModal';
import AssignTeamLeadModal from '../../../components/AssignTeamLeadModal';

const UserManagementTab = ({ currentUser, showNotification }) => {
  const { t } = useTranslation();

  // Data States
  const [usersList, setUsersList] = useState([]);
  const [teamLeadsList, setTeamLeadsList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 8;

  // Modal States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAssignTeamLeadModal, setShowAssignTeamLeadModal] = useState(false);
  const [targetUserForLead, setTargetUserForLead] = useState(null);

  // Edit User Details Modal
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ fullName: '', locale: 'en', teamId: '' });

  // Edit Role Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userForRoleEdit, setUserForRoleEdit] = useState(null);
  const [selectedRole, setSelectedRole] = useState('engineer');

  // Soft Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    loadTeamLeads();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsersList(res.data || []);
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamLeads = async () => {
    try {
      const res = await api.get('/admin/team-leads').catch(() => null);
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setTeamLeadsList(res.data);
      } else {
        const fallbackRes = await api.get('/admin/users?role=team_lead').catch(() => null);
        if (fallbackRes?.data && Array.isArray(fallbackRes.data)) {
          setTeamLeadsList(fallbackRes.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const name = (u.fullName || u.full_name || u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const status = (u.status || (u.is_active ? 'active' : 'deactivated')).toLowerCase();
      const leadName = (
        u.team_lead_id?.fullName ||
        u.team_lead_id?.full_name ||
        u.team_lead_id?.email ||
        u.team_id?.name ||
        ''
      ).toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || name.includes(q) || email.includes(q) || role.includes(q) || leadName.includes(q);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesRole = roleFilter === 'all' || role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [usersList, searchQuery, statusFilter, roleFilter]);

  // Reset page on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, roleFilter]);

  // Paginated Slice
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // Edit User Handler
  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setEditFormData({
      fullName: u.fullName || u.full_name || '',
      locale: u.locale || 'en',
      teamId: (u.team_id?._id || u.team_id || ''),
    });
    setShowEditUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionLoading(true);
    try {
      const res = await api.put(`/admin/users/${editingUser._id || editingUser.id}`, {
        fullName: editFormData.fullName,
        locale: editFormData.locale,
      });
      showNotification('success', res.data?.message || 'User details updated successfully');
      setShowEditUserModal(false);
      loadUsers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Role Handler
  const handleOpenRoleModal = (u) => {
    setUserForRoleEdit(u);
    setSelectedRole(u.role || 'engineer');
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!userForRoleEdit) return;
    setActionLoading(true);
    try {
      const res = await api.put(`/admin/users/${userForRoleEdit._id || userForRoleEdit.id}/role`, {
        role: selectedRole,
      });
      showNotification('success', res.data?.message || `Role updated to '${selectedRole}'`);
      setShowRoleModal(false);
      loadUsers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle User Active/Deactivated Status
  const handleToggleStatus = async (u) => {
    const currentlyActive = u.is_active !== false && u.status !== 'deactivated';
    const actionText = currentlyActive ? 'deactivate' : 'reactivate';

    if (!window.confirm(`Are you sure you want to ${actionText} user '${u.fullName || u.email}'?`)) return;

    setActionLoading(true);
    try {
      await api.put(`/admin/users/${u._id || u.id}/status`, {
        isActive: !currentlyActive,
      });
      showNotification('success', `User '${u.fullName || u.email}' ${currentlyActive ? 'deactivated' : 'reactivated'} successfully.`);
      loadUsers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || `Failed to ${actionText} user`);
    } finally {
      setActionLoading(false);
    }
  };

  // Resend Invite Handler
  const handleResendInvite = async (u) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/admin/users/${u._id || u.id}/resend-invite`);
      showNotification('success', res.data?.message || `Invitation resent successfully to ${u.email}`);
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to resend invite');
    } finally {
      setActionLoading(false);
    }
  };

  // Soft Delete Handler
  const handleOpenDelete = (u) => {
    const currentId = currentUser?._id || currentUser?.id;
    const targetId = u._id || u.id;
    if (currentId && targetId && String(currentId) === String(targetId)) {
      showNotification('error', 'You cannot delete your own active Admin account.');
      return;
    }
    setUserToDelete(u);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setActionLoading(true);
    try {
      const res = await api.delete(`/admin/users/${userToDelete._id || userToDelete.id}`);
      showNotification('success', res.data?.message || `User '${userToDelete.fullName || userToDelete.email}' deleted successfully.`);
      setShowDeleteModal(false);
      setUserToDelete(null);
      loadUsers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadgeClass = (role) => {
    const r = (role || '').toLowerCase();
    switch (r) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'team_lead':
      case 'teamlead':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const getStatusBadgeClass = (status, isActive) => {
    if (status === 'pending') return 'bg-amber-100 text-amber-800 border border-amber-200';
    if (status === 'deactivated' || isActive === false) return 'bg-rose-100 text-rose-800 border border-rose-200';
    return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  };

  return (
    <div className="space-y-6">
      {/* Header Section with Actions & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('adminPortal.users.title')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t('adminPortal.users.subtitle')}</p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#08306B] text-white hover:bg-[#0a3d87] shadow-sm transition cursor-pointer shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          {t('adminPortal.users.inviteUser')}
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center gap-3 w-full justify-between">
        <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('adminPortal.users.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto min-w-[140px] max-w-full sm:max-w-[220px] md:max-w-[280px] truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
          >
            <option value="all" className="truncate">{t('adminPortal.users.allRoles')}</option>
            <option value="admin" className="truncate">{t('admin')}</option>
            <option value="team_lead" className="truncate">{t('teamLead')}</option>
            <option value="engineer" className="truncate">{t('engineer')}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto min-w-[140px] max-w-full sm:max-w-[220px] md:max-w-[280px] truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
          >
            <option value="all" className="truncate">{t('adminPortal.users.allStatuses')}</option>
            <option value="active" className="truncate">{t('common.active')}</option>
            <option value="pending" className="truncate">{t('common.pending')}</option>
            <option value="deactivated" className="truncate">{t('common.deactivated')}</option>
          </select>

          {(searchQuery || statusFilter !== 'all' || roleFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setRoleFilter('all');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 underline cursor-pointer"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#08306B] border-t-transparent" />
            <p className="text-xs text-slate-500 font-medium">{t('common.loading')}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">{t('adminPortal.users.colUser')}</th>
                  <th className="px-4 py-3.5">{t('adminPortal.users.colRole')}</th>
                  <th className="px-4 py-3.5">{t('adminPortal.users.colTeam')}</th>
                  <th className="px-4 py-3.5">{t('adminPortal.users.colStatus')}</th>
                  <th className="px-4 py-3.5">{t('adminPortal.users.colLastActive')}</th>
                  <th className="px-5 py-3.5 text-right">{t('adminPortal.users.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedUsers.map((u) => {
                  const name = u.fullName || u.full_name || 'Unnamed User';
                  const initial = name.charAt(0).toUpperCase() || 'U';
                  const leadName = u.team_lead_id?.fullName || u.team_lead_id?.full_name || (u.role === 'engineer' ? 'None Assigned' : '—');
                  const teamName = u.team_id?.name || '—';
                  const isDeactivated = u.is_active === false || u.status === 'deactivated';
                  const isPending = u.status === 'pending';

                  return (
                    <tr key={u._id || u.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#08306B] to-[#0d4f9b] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getRoleBadgeClass(u.role)}`}>
                          {(u.role || 'engineer').replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-800 truncate">{teamName}</p>
                        <p className="text-[11px] text-slate-500 truncate">Lead: {leadName}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${getStatusBadgeClass(u.status, u.is_active)}`}>
                          {u.status || (u.is_active ? 'active' : 'deactivated')}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Edit Details */}
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                            title="Edit user details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Change Role */}
                          <button
                            onClick={() => handleOpenRoleModal(u)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-purple-700 transition cursor-pointer"
                            title="Change user role"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </button>

                          {/* Assign Team Lead (Engineers only) */}
                          {u.role === 'engineer' && (
                            <button
                              onClick={() => {
                                setTargetUserForLead(u);
                                setShowAssignTeamLeadModal(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-700 transition cursor-pointer"
                              title="Assign Team Lead"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </button>
                          )}

                          {/* Resend Invite (Pending only) */}
                          {isPending && (
                            <button
                              onClick={() => handleResendInvite(u)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-amber-600 hover:text-amber-800 transition cursor-pointer"
                              title="Resend invitation link"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}

                          {/* Toggle Active Status */}
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer ${
                              isDeactivated ? 'text-emerald-600 hover:text-emerald-800' : 'text-slate-400 hover:text-rose-600'
                            }`}
                            title={isDeactivated ? 'Reactivate user' : 'Deactivate user'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isDeactivated ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"} />
                            </svg>
                          </button>

                          {/* Soft Delete */}
                          <button
                            onClick={() => handleOpenDelete(u)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Delete user"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-200">
          <Pagination
            currentPage={currentPage}
            totalItems={filteredUsers.length}
            pageSize={USERS_PER_PAGE}
            onPageChange={setCurrentPage}
            itemLabel="users"
          />
        </div>
      </div>

      {/* User Invite / Create Modal */}
      <UserInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onUserAdded={() => {
          setShowInviteModal(false);
          loadUsers();
          showNotification('success', 'User invitation / account creation completed');
        }}
      />

      {/* Assign Team Lead Modal */}
      {targetUserForLead && (
        <AssignTeamLeadModal
          isOpen={showAssignTeamLeadModal}
          user={targetUserForLead}
          teamLeads={teamLeadsList}
          onClose={() => {
            setShowAssignTeamLeadModal(false);
            setTargetUserForLead(null);
          }}
          onAssigned={() => {
            setShowAssignTeamLeadModal(false);
            setTargetUserForLead(null);
            loadUsers();
            showNotification('success', 'Team Lead assignment updated successfully');
          }}
        />
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Edit User Details</h3>
            <p className="text-xs text-slate-500 mt-0.5">{editingUser.email}</p>

            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Language Preference</label>
                <select
                  value={editFormData.locale}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, locale: e.target.value }))}
                  className="w-full truncate px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none bg-white font-medium"
                >
                  <option value="en" className="truncate">English (EN)</option>
                  <option value="de" className="truncate">German (DE)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#08306B] text-white hover:bg-[#0a3d87] transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showRoleModal && userForRoleEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Change User Role</h3>
            <p className="text-xs text-slate-500 mt-0.5">{userForRoleEdit.fullName || userForRoleEdit.email}</p>

            <form onSubmit={handleSaveRole} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Role</label>
                <div className="space-y-2">
                  {[
                    { role: 'engineer', label: 'Engineer', desc: 'Standard learner accessing assigned modules, tracks, and quizzes' },
                    { role: 'team_lead', label: 'Team Lead', desc: 'Can assign modules to their team and view team performance reports' },
                    { role: 'admin', label: 'Admin', desc: 'Full administrative access across curriculum, users, assignments, audit logs & certificates' },
                  ].map((r) => (
                    <label
                      key={r.role}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                        selectedRole === r.role ? 'bg-blue-50/60 border-[#08306B] ring-1 ring-[#08306B]' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="userRole"
                        value={r.role}
                        checked={selectedRole === r.role}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="mt-0.5 text-[#08306B] focus:ring-[#08306B]"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{r.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#08306B] text-white hover:bg-[#0a3d87] transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : 'Update Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete User Account</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Are you sure you want to soft-delete <strong className="text-slate-900">{userToDelete.fullName || userToDelete.email}</strong>? The user will be immediately deactivated and unable to log in.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementTab;
