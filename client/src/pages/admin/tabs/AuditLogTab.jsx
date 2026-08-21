import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import Pagination from '../../../components/Pagination';

const AuditLogTab = ({ showNotification }) => {
  const { t } = useTranslation();

  // Data States
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const LOGS_PER_PAGE = 8;

  // Filter States
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');

  // Selected Log Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadAuditLogs();
  }, [currentPage, actionFilter, outcomeFilter]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      let url = `/admin/audit-log?page=${currentPage}&limit=${LOGS_PER_PAGE}`;
      if (actionFilter) url += `&action=${actionFilter}`;
      if (outcomeFilter) url += `&outcome=${outcomeFilter}`;

      const res = await api.get(url);
      setAuditLogs(res.data.auditLogs || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalCount(res.data.total || (res.data.auditLogs?.length || 0));
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getOutcomeBadge = (outcome) => {
    if (outcome === 'failure' || outcome === 'error') {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  const getActionBadge = (action) => {
    const act = (action || '').toUpperCase();
    if (act.includes('DELETE') || act.includes('REVOKE')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (act.includes('CREATE') || act.includes('INVITE') || act.includes('PUBLISH')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('UPDATE') || act.includes('ASSIGN')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Security Audit Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable system logs tracking administrative actions, user changes, and governance events
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto min-w-[140px] max-w-full sm:max-w-[220px] md:max-w-[280px] truncate text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-700 outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
          >
            <option value="" className="truncate">All Actions</option>
            <option value="CREATE_USER" className="truncate">CREATE_USER</option>
            <option value="INVITE_USER" className="truncate">INVITE_USER</option>
            <option value="UPDATE_USER" className="truncate">UPDATE_USER</option>
            <option value="UPDATE_USER_ROLE" className="truncate">UPDATE_USER_ROLE</option>
            <option value="DELETE_USER" className="truncate">DELETE_USER</option>
            <option value="PUBLISH_MODULE" className="truncate">PUBLISH_MODULE</option>
            <option value="UPLOAD_MODULE_VIDEO" className="truncate">UPLOAD_MODULE_VIDEO</option>
            <option value="REVOKE_CERTIFICATE" className="truncate">REVOKE_CERTIFICATE</option>
            <option value="CREATE_ASSIGNMENT" className="truncate">CREATE_ASSIGNMENT</option>
          </select>

          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto min-w-[140px] max-w-full sm:max-w-[220px] md:max-w-[280px] truncate text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-700 outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
          >
            <option value="" className="truncate">All Outcomes</option>
            <option value="success" className="truncate">Success</option>
            <option value="failure" className="truncate">Failure</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#08306B] border-t-transparent mx-auto" />
            <p className="text-xs text-slate-500 mt-2 font-medium">Fetching immutable audit records...</p>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No audit log entries found.</p>
            <p className="text-xs text-slate-500 mt-1">Actions performed on the platform will be automatically recorded here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Actor</th>
                  <th className="px-4 py-3.5">Resource</th>
                  <th className="px-4 py-3.5">Outcome</th>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.map((log) => {
                  const actor = log.actorId || log.user_id;
                  const actorName = actor?.fullName || actor?.full_name || log.actorRole || 'System';
                  const actorEmail = actor?.email || '';
                  const outcome = log.outcome || 'success';
                  const timestamp = log.occurred_at || log.created_at || log.createdAt;

                  return (
                    <tr key={log._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase border ${getActionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{actorName}</p>
                        {actorEmail && <p className="text-[11px] text-slate-500 truncate">{actorEmail}</p>}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-medium text-slate-800">{log.resourceType || 'Resource'}</span>
                        {log.resourceId && (
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                            {String(log.resourceId)}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getOutcomeBadge(outcome)}`}>
                          {outcome}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                        {timestamp ? new Date(timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }) : '—'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#08306B] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-slate-50/50 border-t border-slate-200">
          <Pagination
            currentPage={currentPage}
            totalItems={totalCount}
            pageSize={LOGS_PER_PAGE}
            onPageChange={setCurrentPage}
            itemLabel="audit logs"
          />
        </div>
      </div>

      {/* Inspect Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 font-mono">
                {selectedLog.action}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getOutcomeBadge(selectedLog.outcome)}`}>
                {selectedLog.outcome || 'success'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Description:</p>
                <p className="font-medium text-slate-900 mt-0.5">{selectedLog.description || 'No description logged.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">Actor Role:</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedLog.actorRole || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">Resource:</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedLog.resourceType} ({selectedLog.resourceId || 'N/A'})</p>
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Metadata Payload:</p>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogTab;
