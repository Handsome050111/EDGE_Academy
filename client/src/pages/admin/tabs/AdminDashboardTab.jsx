import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';

const AdminDashboardTab = ({ showNotification }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverviewData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/reports/overview');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load admin overview data:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to load dashboard overview data';
      setError(msg);
      if (showNotification) {
        showNotification('error', msg);
      }
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-xl" />
            <div className="h-4 w-96 bg-slate-200 animate-pulse rounded-lg" />
          </div>
          <div className="h-10 w-28 bg-slate-200 animate-pulse rounded-xl" />
        </div>

        {/* 5 KPI Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-36 bg-white border border-slate-200 rounded-3xl p-5 animate-pulse space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-9 w-9 bg-slate-200 rounded-xl" />
              </div>
              <div className="h-8 w-16 bg-slate-200 rounded" />
              <div className="h-3 w-28 bg-slate-200 rounded" />
            </div>
          ))}
        </div>

        {/* Bottom Section Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-white border border-slate-200 rounded-3xl p-6 animate-pulse" />
          <div className="h-80 bg-white border border-slate-200 rounded-3xl p-6 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-8 text-center max-w-xl mx-auto space-y-4 my-10">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Failed to Load Dashboard Overview</h3>
          <p className="text-xs text-slate-600 mt-1">{error}</p>
        </div>
        <button
          onClick={fetchOverviewData}
          className="px-4 py-2 bg-[#08306B] hover:bg-[#062452] text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const {
    workforce = {},
    curriculum = {},
    assignments = {},
    quizzes = {},
    certificates = {},
    tracksHealth = [],
    weakConcepts = [],
  } = data || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            System Overview Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time platform metrics across workforce, curriculum, assignments, quizzes, and certificates
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchOverviewData}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
            title="Refresh Dashboard Data"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 5 Primary Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* 1. Workforce Overview (Engineers, Leads, Admins, Active/Deactivated) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Workforce</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{workforce.totalUsers || 0}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#08306B] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-normal">
            <span>{workforce.engineers || 0} Engineers</span>
            <span className="text-slate-300">•</span>
            <span>{workforce.teamLeads || 0} Leads</span>
            <span className="text-slate-300">•</span>
            <span>{workforce.admins || 0} Admins</span>
          </div>
        </div>

        {/* 2. Curriculum Footprint */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Curriculum</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{curriculum.publishedModules || 0}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-normal">
            <span>{curriculum.totalTracks || 0} Tracks</span>
            <span className="text-slate-300">•</span>
            <span>{curriculum.totalQuestions || 0} MCQs</span>
            {curriculum.draftModules > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-amber-600 font-medium">{curriculum.draftModules} Draft</span>
              </>
            )}
          </div>
        </div>

        {/* 3. Assignment Velocity (No overdue) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Assignments</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-bold text-slate-900">{assignments.total || 0}</h3>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {assignments.completionRate || 0}% Done
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-normal">
            <span>{assignments.completed || 0} Completed</span>
            <span className="text-slate-300">•</span>
            <span>{assignments.inProgress || 0} In Progress</span>
            <span className="text-slate-300">•</span>
            <span>{assignments.pending || 0} Pending</span>
          </div>
        </div>

        {/* 4. Quiz Performance & Accuracy */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Quiz Accuracy</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-bold text-slate-900">{quizzes.passRate || 0}%</h3>
                <span className="text-xs font-medium text-slate-500">
                  Avg: {quizzes.averageScore || 0}%
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-normal">
            <span>{quizzes.totalAttempts || 0} Attempts</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-medium">{quizzes.passedAttempts || 0} Passed</span>
            <span className="text-slate-300">•</span>
            <span className="text-rose-600 font-medium">{quizzes.failedAttempts || 0} Failed</span>
          </div>
        </div>

        {/* 5. Verified Credentials */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Certificates</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{certificates.totalActive || 0}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-normal">
            <span>{certificates.edgeCertificates || 0} EDGE</span>
            <span className="text-slate-300">•</span>
            <span>{certificates.coreCertificates || 0} CORE</span>
            {certificates.revokedCertificates > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-rose-600 font-medium">{certificates.revokedCertificates} Revoked</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2-Column Section: Track Progression + Weak Concepts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Track-Level Progression & Completion */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Track Progression & Health</h2>
              <p className="text-xs text-slate-500 mt-0.5">Learner completion rate and certification across learning tracks</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
              {tracksHealth.length} Track{tracksHealth.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-4">
            {tracksHealth.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                No learning tracks found
              </div>
            ) : (
              tracksHealth.map((tr) => (
                <div key={tr._id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="font-semibold text-slate-900 text-sm truncate">{tr.title}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#08306B]/10 text-[#08306B] shrink-0">
                        {tr.tier}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-slate-900">{tr.completionRate}%</span>
                      <span className="text-xs text-slate-400">rate</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        tr.completionRate >= 80
                          ? 'bg-emerald-500'
                          : tr.completionRate >= 40
                          ? 'bg-[#08306B]'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, tr.completionRate))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>{tr.publishedModulesCount} published modules</span>
                    <div className="flex items-center gap-3">
                      <span>{tr.enrolledEngineersCount} enrolled</span>
                      <span>•</span>
                      <span className="font-medium text-emerald-700">{tr.completedEngineersCount} certified</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Skill Gaps & Weak Concepts */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Skill Gaps & Weak Concepts</h2>
              <p className="text-xs text-slate-500 mt-0.5">Concepts with the lowest quiz accuracy across all engineers</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
              {weakConcepts.length} Identified
            </span>
          </div>

          <div className="space-y-3">
            {weakConcepts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                No quiz responses recorded yet to compute concept accuracy
              </div>
            ) : (
              weakConcepts.map((item, idx) => {
                const acc = item.accuracyPercentage || 0;
                const isCritical = acc < 60;
                const isModerate = acc >= 60 && acc < 80;

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {item.concept_tag}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isCritical
                            ? 'bg-rose-100 text-rose-700'
                            : isModerate
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {acc}% Accuracy
                        </span>
                      </div>
                    </div>

                    {/* Accuracy Bar */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isCritical ? 'bg-rose-500' : isModerate ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, acc))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{item.totalAttempts} total attempts</span>
                      <span>{item.totalCorrect} correct answers</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardTab;
