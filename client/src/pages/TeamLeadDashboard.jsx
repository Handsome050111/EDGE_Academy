import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NotificationBell from '../components/NotificationBell';
import ProfileModal from '../components/ProfileModal';
import Pagination from '../components/Pagination';
import api from '../services/api';

const TeamLeadDashboard = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Live Team Report & Curriculum State
  const [teamReport, setTeamReport] = useState(null);
  const [weakConceptsReport, setWeakConceptsReport] = useState(null);
  const [tracksList, setTracksList] = useState([]);
  const [modulesList, setModulesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Engineers Table Filters & Pagination
  const [engineerSearchQuery, setEngineerSearchQuery] = useState('');
  const [engineerStatusFilter, setEngineerStatusFilter] = useState('all');
  const [engineersPage, setEngineersPage] = useState(1);

  // Weak Concepts Table Filters & Pagination
  const [conceptSearchQuery, setConceptSearchQuery] = useState('');
  const [conceptProficiencyFilter, setConceptProficiencyFilter] = useState('all');
  const [conceptsPage, setConceptsPage] = useState(1);

  // Squad Certificates State
  const [squadCertificates, setSquadCertificates] = useState([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [certSearchQuery, setCertSearchQuery] = useState('');
  const [certTrackFilter, setCertTrackFilter] = useState('all');
  const [certStatusFilter, setCertStatusFilter] = useState('all');
  const [certsPage, setCertsPage] = useState(1);
  const [downloadingCertId, setDownloadingCertId] = useState(null);

  // Drill-down Certificate Modal State for individual engineer
  const [selectedEngineerForCerts, setSelectedEngineerForCerts] = useState(null);

  // Squad Assignments State
  const [squadAssignments, setSquadAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('all');
  const [assignmentsPage, setAssignmentsPage] = useState(1);

  // Drill-down Assignment Modal State for individual engineer
  const [selectedEngineerForAssignments, setSelectedEngineerForAssignments] = useState(null);

  // Assignment Modal Form State
  const [curriculumScope, setCurriculumScope] = useState('module'); // 'module' | 'track'
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [assignmentType, setAssignmentType] = useState('individual'); // 'individual' | 'team'
  const [selectedEngineerIds, setSelectedEngineerIds] = useState([]);
  const [deadlineAt, setDeadlineAt] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState('');
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    fetchTeamData();
  }, [user?.team_id]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError(null);
      const teamEndpoint = user?.team_id ? `/admin/reports/team/${user.team_id}` : '/admin/reports/team/me';
      const [teamRes, conceptsRes, tracksRes, modulesRes, certsRes, assignmentsRes] = await Promise.all([
        api.get(teamEndpoint).catch((err) => {
          console.error('Failed to fetch team report:', err);
          return { data: null };
        }),
        api.get('/admin/reports/weak-concepts').catch((err) => {
          console.error('Failed to fetch weak concepts report:', err);
          return { data: null };
        }),
        api.get('/tracks').catch((err) => {
          console.error('Failed to fetch tracks:', err);
          return { data: null };
        }),
        api.get('/modules').catch((err) => {
          console.error('Failed to fetch modules:', err);
          return { data: null };
        }),
        api.get('/admin/certificates?limit=100').catch((err) => {
          console.error('Failed to fetch squad certificates:', err);
          return { data: null };
        }),
        api.get('/admin/assignments?limit=200').catch((err) => {
          console.error('Failed to fetch squad assignments:', err);
          return { data: null };
        }),
      ]);

      if (teamRes.data) {
        setTeamReport(teamRes.data);
      }
      if (conceptsRes.data) {
        setWeakConceptsReport(conceptsRes.data);
      }
      if (tracksRes.data) {
        const rawTracks = Array.isArray(tracksRes.data) ? tracksRes.data : (tracksRes.data.tracks || []);
        setTracksList(rawTracks);
        if (rawTracks.length > 0) {
          setSelectedTrackId(rawTracks[0]._id);
        }
      }
      if (modulesRes.data) {
        const rawMods = Array.isArray(modulesRes.data) ? modulesRes.data : (modulesRes.data.modules || []);
        setModulesList(rawMods);
        if (rawMods.length > 0) {
          setSelectedModuleId(rawMods[0]._id);
        }
      }
      if (certsRes?.data) {
        const list = certsRes.data.certificates || (Array.isArray(certsRes.data) ? certsRes.data : []);
        setSquadCertificates(list);
      }
      if (assignmentsRes?.data) {
        const list = assignmentsRes.data.assignments || (Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
        setSquadAssignments(list);
      }
    } catch (err) {
      console.error('Failed to fetch team report data:', err);
      setError('Failed to load team data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const engineersList = teamReport?.engineers || [];
  const completionRate = teamReport?.completionRate || 0;
  const avgQuizScore = teamReport?.averageQuizScore || 0;
  const totalEngineers = teamReport?.totalEngineers || 0;
  const activeAssignments = teamReport?.activeAssignments || 0;
  const earnedCertificatesTotal = teamReport?.earnedCertificatesTotal !== undefined
    ? teamReport.earnedCertificatesTotal
    : engineersList.reduce((acc, eng) => acc + (eng.earnedCertificatesCount || 0), 0);

  // Filtered Engineers
  const filteredEngineers = useMemo(() => {
    return engineersList.filter((eng) => {
      const name = (eng.fullName || eng.name || eng.email || '').toLowerCase();
      const email = (eng.email || '').toLowerCase();
      const query = engineerSearchQuery.toLowerCase().trim();
      const matchesSearch = !query || name.includes(query) || email.includes(query);

      const isActive = eng.is_active !== false && eng.status !== 'deactivated';
      const matchesStatus =
        engineerStatusFilter === 'all'
          ? true
          : engineerStatusFilter === 'active'
          ? isActive
          : !isActive;

      return matchesSearch && matchesStatus;
    });
  }, [engineersList, engineerSearchQuery, engineerStatusFilter]);

  const paginatedEngineers = useMemo(() => {
    return filteredEngineers.slice((engineersPage - 1) * 8, engineersPage * 8);
  }, [filteredEngineers, engineersPage]);

  // Filtered Weak Concepts
  const allWeakConcepts = weakConceptsReport?.weakConcepts || [];
  const filteredConcepts = useMemo(() => {
    return allWeakConcepts.filter((item) => {
      const tag = (item.concept_tag || '').toLowerCase();
      const query = conceptSearchQuery.toLowerCase().trim();
      const matchesSearch = !query || tag.includes(query);

      const acc = item.accuracyPercentage !== undefined ? item.accuracyPercentage : 0;
      let proficiencyCategory = 'proficient';
      if (acc < 60) proficiencyCategory = 'critical';
      else if (acc < 80) proficiencyCategory = 'needs_focus';

      const matchesProficiency =
        conceptProficiencyFilter === 'all' || conceptProficiencyFilter === proficiencyCategory;

      return matchesSearch && matchesProficiency;
    });
  }, [allWeakConcepts, conceptSearchQuery, conceptProficiencyFilter]);

  const paginatedConcepts = useMemo(() => {
    return filteredConcepts.slice((conceptsPage - 1) * 8, conceptsPage * 8);
  }, [filteredConcepts, conceptsPage]);

  // Filtered Squad Certificates
  const filteredCertificates = useMemo(() => {
    return squadCertificates.filter((cert) => {
      const engName = (cert.engineer_id?.fullName || cert.engineer_id?.full_name || cert.userId?.fullName || cert.engineer_id?.name || '').toLowerCase();
      const engEmail = (cert.engineer_id?.email || cert.userId?.email || '').toLowerCase();
      const certId = (cert.certificate_id || '').toLowerCase();
      const trackTitle = (cert.track_id?.title || cert.track_id?.name || cert.trackId?.title || '').toLowerCase();
      const q = certSearchQuery.toLowerCase().trim();

      const matchesSearch = !q || engName.includes(q) || engEmail.includes(q) || certId.includes(q) || trackTitle.includes(q);

      const tId = (cert.track_id?._id || cert.track_id || cert.trackId?._id || cert.trackId)?.toString();
      const matchesTrack = certTrackFilter === 'all' || tId === certTrackFilter;

      const certStatus = (cert.status || 'active').toLowerCase();
      const matchesStatus = certStatusFilter === 'all' || certStatus === certStatusFilter.toLowerCase();

      return matchesSearch && matchesTrack && matchesStatus;
    });
  }, [squadCertificates, certSearchQuery, certTrackFilter, certStatusFilter]);

  // Filtered Squad Assignments
  const filteredSquadAssignments = useMemo(() => {
    return squadAssignments.filter((item) => {
      const eng = item.engineer_id || item.userId || {};
      const mod = item.module_id || item.moduleId || {};
      const track = mod.track_id || mod.trackId || {};
      const assigner = item.assigned_by || item.assignedBy || {};

      const engName = (eng.fullName || eng.full_name || eng.name || '').toLowerCase();
      const engEmail = (eng.email || '').toLowerCase();
      const modTitle = (mod.title || '').toLowerCase();
      const trackTitle = (track.title || track.name || '').toLowerCase();
      const assignerName = (assigner.fullName || assigner.full_name || assigner.name || '').toLowerCase();
      const q = assignmentSearchQuery.toLowerCase().trim();

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
  }, [squadAssignments, assignmentSearchQuery, assignmentStatusFilter]);

  const paginatedSquadAssignments = useMemo(() => {
    return filteredSquadAssignments.slice((assignmentsPage - 1) * 8, assignmentsPage * 8);
  }, [filteredSquadAssignments, assignmentsPage]);

  // Assignments belonging to selected engineer for drill-down modal
  const engineerModalAssignments = useMemo(() => {
    if (!selectedEngineerForAssignments) return [];
    const engId = (selectedEngineerForAssignments._id || selectedEngineerForAssignments.id)?.toString();
    return squadAssignments.filter((a) => {
      const aEngId = (a.engineer_id?._id || a.engineer_id || a.userId?._id || a.userId)?.toString();
      return aEngId === engId;
    });
  }, [selectedEngineerForAssignments, squadAssignments]);

  // Certificates belonging to selected engineer for modal drill-down
  const engineerModalCertificates = useMemo(() => {
    if (!selectedEngineerForCerts) return [];
    const engId = (selectedEngineerForCerts._id || selectedEngineerForCerts.id)?.toString();
    return squadCertificates.filter((c) => {
      const cEngId = (c.engineer_id?._id || c.engineer_id || c.userId?._id || c.userId)?.toString();
      return cEngId === engId;
    });
  }, [selectedEngineerForCerts, squadCertificates]);

  // Authenticated PDF Download Handler
  const handleDownloadCertPdf = async (cert) => {
    const certId = cert._id || cert.certificate_id;
    try {
      setDownloadingCertId(certId);
      const res = await api.get(`/certificates/${certId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${cert.certificate_id || 'certificate'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      let errorMessage = 'Failed to download certificate PDF. Please try again.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          errorMessage = parsed.error?.message || parsed.message || errorMessage;
        } catch (parseErr) {
          // Keep fallback
        }
      } else if (err.response?.data?.message || err.response?.data?.error?.message) {
        errorMessage = err.response.data.error?.message || err.response.data.message;
      }
      alert(errorMessage);
    } finally {
      setDownloadingCertId(null);
    }
  };

  // Helper to resolve all modules for a given track dynamically
  const getModulesForTrack = (track) => {
    if (!track) return [];
    const trackIdStr = (track._id || track.id)?.toString();

    // 1. Check from modulesList where track_id matches
    const fromModulesList = modulesList.filter((m) => {
      const mTrackId = (m.track_id?._id || m.track_id || m.trackId?._id || m.trackId)?.toString();
      return mTrackId === trackIdStr;
    });

    if (fromModulesList.length > 0) {
      return fromModulesList;
    }

    // 2. Check if track.modules contains populated objects or IDs
    if (Array.isArray(track.modules)) {
      const populated = [];
      for (const m of track.modules) {
        if (m && typeof m === 'object' && m.title) {
          populated.push(m);
        } else if (m) {
          const lookedUp = modulesList.find((mod) => (mod._id || mod.id)?.toString() === m.toString());
          if (lookedUp) populated.push(lookedUp);
        }
      }
      return populated;
    }

    return [];
  };

  // Extract all modules for the dropdown selector with parent track title
  const availableModules = useMemo(() => {
    if (modulesList && modulesList.length > 0) {
      return modulesList.map((m) => {
        let parentTrack = tracksList.find((t) => {
          const tId = (t._id || t.id)?.toString();
          const mTrackId = (m.track_id?._id || m.track_id || m.trackId?._id || m.trackId)?.toString();
          return tId === mTrackId;
        });

        const trackTitle = parentTrack ? (parentTrack.name || parentTrack.title) : (m.track_id?.name || m.track_id?.title || m.trackId?.name || m.trackId?.title || 'Curriculum');
        return { ...m, trackTitle };
      });
    }

    return tracksList.flatMap((tr) => (tr.modules || []).map((m) => ({ ...m, trackTitle: tr.name || tr.title })));
  }, [modulesList, tracksList]);

  useEffect(() => {
    if (availableModules.length > 0 && !selectedModuleId) {
      setSelectedModuleId(availableModules[0]._id);
    }
  }, [availableModules, selectedModuleId]);

  // Helper to format module duration dynamically
  const formatModuleDuration = (mod) => {
    if (mod.estimated_minutes && mod.estimated_minutes > 0) {
      return `${mod.estimated_minutes} mins`;
    }
    if (mod.estimatedDurationMinutes && mod.estimatedDurationMinutes > 0) {
      return `${mod.estimatedDurationMinutes} mins`;
    }
    if (mod.video_duration_sec && mod.video_duration_sec > 0) {
      const mins = Math.max(1, Math.round(mod.video_duration_sec / 60));
      return `${mins} mins`;
    }
    if (mod.duration_sec && mod.duration_sec > 0) {
      const mins = Math.max(1, Math.round(mod.duration_sec / 60));
      return `${mins} mins`;
    }
    return 'Self-paced';
  };

  // Helper to format pass threshold percentage dynamically
  const formatPassThreshold = (mod) => {
    const threshold = mod.pass_threshold || mod.passingScorePercentage;
    return threshold ? `${threshold}%` : '80%';
  };

  const handleToggleEngineer = (engId) => {
    setSelectedEngineerIds((prev) =>
      prev.includes(engId) ? prev.filter((id) => id !== engId) : [...prev, engId]
    );
  };

  const handleSelectAllEngineers = () => {
    if (selectedEngineerIds.length === engineersList.length) {
      setSelectedEngineerIds([]);
    } else {
      setSelectedEngineerIds(engineersList.map((e) => e._id || e.id));
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssignSuccess('');
    setAssignError('');

    if (curriculumScope === 'module' && !selectedModuleId) {
      setAssignError('Please select a target module.');
      return;
    }

    if (curriculumScope === 'track' && !selectedTrackId) {
      setAssignError('Please select a target track.');
      return;
    }

    if (assignmentType === 'individual' && selectedEngineerIds.length === 0) {
      setAssignError('Please select at least one engineer from your squad or choose Entire Team.');
      return;
    }

    try {
      setAssignLoading(true);
      const payload = {
        deadline_at: deadlineAt || null,
      };

      if (curriculumScope === 'track') {
        payload.track_id = selectedTrackId;
      } else {
        payload.module_id = selectedModuleId;
      }

      if (assignmentType === 'team') {
        payload.team_id = user?.team_id;
        payload.engineer_ids = engineersList.map((e) => e._id || e.id);
      } else {
        payload.engineer_ids = selectedEngineerIds;
      }

      const res = await api.post('/admin/assignments', payload);
      setAssignSuccess(res.data.message || 'Assignment created successfully!');

      // Refresh dashboard live metrics
      await fetchTeamData();

      setTimeout(() => {
        setAssignSuccess('');
        setShowAssignModal(false);
        setSelectedEngineerIds([]);
        setDeadlineAt('');
      }, 1500);
    } catch (err) {
      console.error('Assignment error:', err);
      setAssignError(err.response?.data?.message || err.message || 'Failed to create assignment.');
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col lg:flex-row font-sans relative overflow-hidden">
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Slide-Out Navigation Drawer on Mobile / Fixed Sidebar on Desktop */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[78vw] max-w-xs sm:max-w-sm lg:w-72 bg-[#092857] text-white p-6 flex flex-col justify-between border-r border-blue-900/40 shrink-0 h-screen overflow-y-auto shadow-2xl lg:shadow-none transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto">
          {/* Drawer Brand Header + Close Button */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                EDGE Academy
              </h1>
              <p className="text-xs text-blue-300/70 font-medium mt-0.5">Technonex Team Portal</p>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white transition cursor-pointer"
              aria-label="Close navigation drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => {
                setActiveTab('overview');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'overview' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>{t('overviewMetrics')}</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('engineers');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'engineers' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>{t('engineers')} ({totalEngineers})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('concepts');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'concepts' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>{t('weakConceptsMap')}</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('curriculum');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'curriculum' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Curriculum Browser</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('assignments');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'assignments' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span>Squad Assignments ({activeAssignments})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('certificates');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'certificates' ? 'bg-white/15 text-white border border-white/20 shadow-sm' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <span>Squad Certificates ({earnedCertificatesTotal})</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Bottom Profile & Logout Footer */}
        <div className="pt-6 border-t border-blue-900/50 space-y-3 mt-auto">
          <button
            onClick={() => {
              setShowProfileModal(true);
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-white/10 transition cursor-pointer text-left group"
            title="Open Profile Settings"
          >
            <div className="h-9 w-9 rounded-xl bg-[#08306B] border border-blue-400/30 flex items-center justify-center font-bold text-white text-sm shadow-sm shrink-0 group-hover:border-white/50 transition">
              {(user?.fullName || user?.full_name || user?.email || 'T')[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate group-hover:text-blue-200 transition">
                {user?.fullName || user?.full_name || 'Team Lead'}
              </p>
              <p className="text-xs text-blue-300/60 truncate capitalize">
                {user?.role?.replace('_', ' ') || 'Team Lead'}
              </p>
            </div>
            <svg className="w-4 h-4 text-blue-300/50 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-blue-200/80 hover:text-white hover:bg-white/5 rounded-xl transition-colors group cursor-pointer"
          >
            <svg className="w-4 h-4 text-blue-300 group-hover:text-white transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar Header */}
        <header className="h-16 bg-white border-b border-slate-200 text-slate-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-xs">
          {/* Left: Mobile Hamburger Button */}
          <div className="flex items-center">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-slate-600 hover:text-slate-900 p-2 -ml-2 rounded-xl hover:bg-slate-100 transition lg:hidden cursor-pointer flex items-center justify-center"
              aria-label="Open navigation drawer"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Right: Notification Bell, Flag Language Switcher & Profile Badge */}
          <div className="flex items-center gap-3 sm:gap-5">
            <NotificationBell />
            <LanguageSwitcher />

            {/* Top-Right Profile Display */}
            <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-slate-200 select-none">
              <div className="h-8 w-8 rounded-full bg-[#08306B] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                {(user?.fullName || user?.full_name || user?.email || 'T')[0]?.toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-800 hidden sm:inline truncate max-w-[140px]">
                {user?.fullName || user?.full_name || user?.email || 'Team Lead'}
              </span>
            </div>
          </div>
        </header>

        {/* Right Main Content Area */}
        <main className="flex-1 p-5 sm:p-8 lg:p-10 xl:p-12 overflow-y-auto space-y-8">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center justify-between">
              <span>{error}</span>
              <button onClick={fetchTeamData} className="text-xs bg-rose-600 text-white px-3 py-1.5 rounded-xl hover:bg-rose-700 transition cursor-pointer">
                Retry
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center flex-wrap gap-2.5">
                <span>
                  {activeTab === 'engineers'
                    ? 'Engineer Progress & Concept Tracking'
                    : activeTab === 'concepts'
                    ? 'Weak Concepts Map'
                    : activeTab === 'curriculum'
                    ? 'Curriculum Browser'
                    : activeTab === 'assignments'
                    ? 'Squad Assignments & Deadlines'
                    : activeTab === 'certificates'
                    ? 'Squad Certificates & Compliance'
                    : 'Team Performance Dashboard'}
                </span>
                {activeTab === 'concepts' && allWeakConcepts.length > 0 && (
                  <span className="bg-blue-50 text-[#08306B] border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-extrabold align-middle">
                    {allWeakConcepts.length} Concept{allWeakConcepts.length === 1 ? '' : 's'} Tracked
                  </span>
                )}
                {activeTab === 'assignments' && squadAssignments.length > 0 && (
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-extrabold align-middle">
                    {squadAssignments.length} Assignment{squadAssignments.length === 1 ? '' : 's'} Total
                  </span>
                )}
                {activeTab === 'certificates' && squadCertificates.length > 0 && (
                  <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-extrabold align-middle">
                    {squadCertificates.length} Verified Credential{squadCertificates.length === 1 ? '' : 's'}
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {activeTab === 'engineers'
                  ? 'Track completion rates, quiz averages, and active training status for squad engineers'
                  : activeTab === 'concepts'
                  ? 'Aggregated quiz metrics across your squad, sorted from lowest to highest accuracy to pinpoint training opportunities'
                  : activeTab === 'curriculum'
                  ? 'Read-only view of published EDGE Academy tracks and training modules.'
                  : activeTab === 'assignments'
                  ? 'Monitor pending, in-progress, completed, and overdue training assignments for your squad.'
                  : activeTab === 'certificates'
                  ? 'View, verify, and download official credentials and certificates earned by engineers on your squad.'
                  : t('teamPerformanceSubtitle')}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setShowAssignModal(true)}
                className="bg-[#08306B] hover:bg-[#062452] text-white text-xs sm:text-sm font-extrabold px-4 sm:px-5 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Assign Curriculum</span>
              </button>
            </div>
          </div>

          {/* Metric Cards (Rendered on Overview tab only) */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('activeEngineers')}</p>
                <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#08306B]">{totalEngineers}</p>
                <span className="mt-1 inline-block text-[11px] font-semibold text-emerald-600">Active Squad Members</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('avgQuizScore')}</p>
                <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#08306B]">
                  {avgQuizScore}%
                </p>
                <span className="mt-1 inline-block text-[11px] font-semibold text-emerald-600">Team Pass Avg ({completionRate}% completed)</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Assignments</p>
                <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-blue-600">{activeAssignments}</p>
                <span className="mt-1 inline-block text-[11px] font-semibold text-blue-600">Pending / In Progress</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Earned Certificates</p>
                <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-600">
                  {earnedCertificatesTotal}
                </p>
                <span className="mt-1 inline-block text-[11px] font-semibold text-amber-600">Verified Credentials</span>
              </div>
            </div>
          )}

          {/* TAB 1: Engineers Table (Admin Users Design) */}
          {(activeTab === 'overview' || activeTab === 'engineers') && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center gap-3 w-full justify-between">
                <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                  <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={engineerSearchQuery}
                    onChange={(e) => {
                      setEngineerSearchQuery(e.target.value);
                      setEngineersPage(1);
                    }}
                    placeholder="Search squad engineers by name or email..."
                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none transition font-medium"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <select
                    value={engineerStatusFilter}
                    onChange={(e) => {
                      setEngineerStatusFilter(e.target.value);
                      setEngineersPage(1);
                    }}
                    className="w-full sm:w-auto min-w-[140px] max-w-full sm:max-w-[220px] md:max-w-[280px] truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 font-medium outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
                  >
                    <option value="all" className="truncate">All Statuses</option>
                    <option value="active" className="truncate">Active</option>
                    <option value="inactive" className="truncate">Inactive</option>
                  </select>

                  {(engineerSearchQuery || engineerStatusFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setEngineerSearchQuery('');
                        setEngineerStatusFilter('all');
                        setEngineersPage(1);
                      }}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200 shadow-2xs shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Users Table Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#08306B] border-t-transparent" />
                    <p className="text-xs text-slate-500 font-medium">Loading squad engineers...</p>
                  </div>
                ) : filteredEngineers.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 text-[#08306B] mx-auto flex items-center justify-center mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No squad engineers found</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {engineerSearchQuery || engineerStatusFilter !== 'all'
                        ? 'Try adjusting your search query or status filter.'
                        : 'No engineers are assigned to your team squad yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3.5">{t('engineer')}</th>
                          <th className="px-4 py-3.5">Track Progress</th>
                          <th className="px-4 py-3.5">Active Assignments</th>
                          <th className="px-4 py-3.5">Earned Certificates</th>
                          <th className="px-4 py-3.5">Avg Quiz Score</th>
                          <th className="px-4 py-3.5">Primary Weak Concept</th>
                          <th className="px-5 py-3.5 text-right">{t('common.status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {paginatedEngineers.map((eng) => (
                          <tr key={eng._id || eng.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 shadow-2xs">
                                  {(eng.fullName || eng.name || eng.email || 'E')[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{eng.fullName || eng.name}</p>
                                  <p className="text-[11px] text-slate-400 truncate">{eng.email}</p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 w-44">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-slate-800">{eng.progress || 0}%</span>
                                  <span className="text-slate-400 font-medium">
                                    {eng.completedModulesCount || 0}/{eng.totalAssignedCount || 0}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-[#08306B] h-full rounded-full transition-all duration-300"
                                    style={{ width: `${eng.progress || 0}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3.5">
                              <button
                                onClick={() => setSelectedEngineerForAssignments(eng)}
                                title="Click to view training assignments for this engineer"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition cursor-pointer"
                              >
                                <span>{eng.activeAssignmentsCount || 0} active</span>
                                {(eng.activeAssignmentsCount || 0) > 0 && (
                                  <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </button>
                            </td>

                            <td className="px-4 py-3.5">
                              <button
                                onClick={() => setSelectedEngineerForCerts(eng)}
                                title="Click to view certificates earned by this engineer"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition cursor-pointer"
                              >
                                <span>{eng.earnedCertificatesCount || 0} earned</span>
                                {(eng.earnedCertificatesCount || 0) > 0 && (
                                  <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                              </button>
                            </td>

                            <td className="px-4 py-3.5 font-bold text-slate-900">
                              {eng.averageQuizScore !== null && eng.averageQuizScore !== undefined
                                ? `${eng.averageQuizScore}%`
                                : <span className="text-slate-400 font-normal italic">No quiz data</span>}
                            </td>

                            <td className="px-4 py-3.5">
                              {eng.weakConcept && eng.weakConcept !== 'N/A' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  {eng.weakConcept}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>

                            <td className="px-5 py-3.5 text-right">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                  eng.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                              >
                                {eng.status || 'active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table Pagination Footer */}
                {!loading && filteredEngineers.length > 0 && (
                  <div className="p-3.5 sm:p-4 border-t border-slate-100">
                    <Pagination
                      currentPage={engineersPage}
                      totalItems={filteredEngineers.length}
                      pageSize={8}
                      onPageChange={setEngineersPage}
                      itemLabel="engineers"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Weak Concepts Table (Admin Users Design) */}
          {activeTab === 'concepts' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center gap-3 w-full justify-between">
                <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                  <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={conceptSearchQuery}
                    onChange={(e) => {
                      setConceptSearchQuery(e.target.value);
                      setConceptsPage(1);
                    }}
                    placeholder="Search concept tags (e.g. FIBER, OTDR, SAFETY)..."
                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none transition font-medium"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <select
                    value={conceptProficiencyFilter}
                    onChange={(e) => {
                      setConceptProficiencyFilter(e.target.value);
                      setConceptsPage(1);
                    }}
                    className="w-full sm:w-auto min-w-[160px] max-w-full sm:max-w-[240px] md:max-w-[280px] truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 font-medium outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
                  >
                    <option value="all" className="truncate">All Proficiency Levels</option>
                    <option value="critical" className="truncate">Critical Need (&lt; 60%)</option>
                    <option value="needs_focus" className="truncate">Needs Focus (60 - 79%)</option>
                    <option value="proficient" className="truncate">Proficient (≥ 80%)</option>
                  </select>

                  {(conceptSearchQuery || conceptProficiencyFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setConceptSearchQuery('');
                        setConceptProficiencyFilter('all');
                        setConceptsPage(1);
                      }}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200 shadow-2xs shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Concepts Table Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                  <div className="p-12 flex flex-col items-center justify-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#08306B] border-t-transparent" />
                    <p className="text-xs text-slate-500 font-medium">Aggregating squad concept accuracy...</p>
                  </div>
                ) : filteredConcepts.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 text-[#08306B] mx-auto flex items-center justify-center mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {allWeakConcepts.length === 0 ? 'No Quiz Activity Recorded Yet' : 'No matching concepts found'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      {allWeakConcepts.length === 0
                        ? 'When squad engineers complete module topic quizzes, concept proficiency and accuracy trends will appear here automatically.'
                        : 'Try adjusting your search criteria or proficiency level filters.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3.5">Concept Tag</th>
                          <th className="px-4 py-3.5">Proficiency Status</th>
                          <th className="px-4 py-3.5">Accuracy Rate</th>
                          <th className="px-4 py-3.5">Questions Correct / Total</th>
                          <th className="px-5 py-3.5 text-right">Engineers Tested</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {paginatedConcepts.map((item, idx) => {
                          const acc = item.accuracyPercentage !== undefined ? item.accuracyPercentage : 0;
                          const isCritical = acc < 60;
                          const isModerate = acc >= 60 && acc < 80;

                          const statusBadgeClass = isCritical
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : isModerate
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200';

                          const barColor = isCritical
                            ? 'bg-rose-500'
                            : isModerate
                              ? 'bg-amber-500'
                              : 'bg-emerald-500';

                          const statusLabel = isCritical
                            ? 'Critical Need'
                            : isModerate
                              ? 'Needs Focus'
                              : 'Proficient';

                          return (
                            <tr key={item.concept_tag || idx} className="hover:bg-slate-50/70 transition">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-xl bg-blue-50 text-[#08306B] border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 uppercase">{item.concept_tag}</p>
                                    <p className="text-[11px] text-slate-400">Concept ID #{idx + 1}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass}`}>
                                  {statusLabel}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 w-48">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-slate-800">{acc}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 rounded-full ${barColor}`}
                                      style={{ width: `${acc}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3.5">
                                <span className="font-semibold text-slate-800 text-xs">
                                  {item.totalCorrect || 0} of {item.totalAttempts || 0} correct
                                </span>
                              </td>

                              <td className="px-5 py-3.5 text-right">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {item.engineerCount || 0} engineer{item.engineerCount === 1 ? '' : 's'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table Pagination Footer */}
                {!loading && filteredConcepts.length > 0 && (
                  <div className="p-3.5 sm:p-4 border-t border-slate-100">
                    <Pagination
                      currentPage={conceptsPage}
                      totalItems={filteredConcepts.length}
                      pageSize={8}
                      onPageChange={setConceptsPage}
                      itemLabel="concepts"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Read-Only Curriculum Browser */}
          {activeTab === 'curriculum' && (
            <div className="space-y-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-end mb-4">
                  <span className="bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-xl font-bold border border-blue-200">
                    Read-Only Access
                  </span>
                </div>

                {tracksList.length === 0 ? (
                  <p className="text-slate-400 text-sm">No curriculum tracks available.</p>
                ) : (
                  <div className="space-y-8">
                    {tracksList.map((track) => {
                      const trackModules = getModulesForTrack(track);

                      return (
                        <div key={track._id} className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                              <span>{track.name || track.title}</span>
                              {(track.code || track.slug) && (
                                <span className="text-xs text-slate-400 font-normal">({track.code || track.slug})</span>
                              )}
                              <span className="text-xs font-semibold text-slate-500">
                                • {trackModules.length} Module{trackModules.length === 1 ? '' : 's'}
                              </span>
                            </h4>
                            <span className="bg-[#08306B] text-white text-xs px-2.5 py-1 rounded-full font-extrabold">
                              {track.tier}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mb-6">{track.description || 'No description provided.'}</p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {trackModules.length === 0 ? (
                              <div className="col-span-1 md:col-span-2 p-6 rounded-xl bg-white border border-slate-200 text-center">
                                <p className="text-xs text-slate-400 italic">No modules published in this track yet.</p>
                              </div>
                            ) : (
                              trackModules.map((mod) => (
                                <div key={mod._id || mod.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-xs font-bold text-slate-900">{mod.title}</h5>
                                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md capitalize">
                                      {mod.status || 'published'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 line-clamp-2">{mod.description || 'No description available.'}</p>
                                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-semibold border-t border-slate-100 pt-2">
                                    <span>{formatModuleDuration(mod)}</span>
                                    <span>Pass: {formatPassThreshold(mod)}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* TAB: Squad Assignments View */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center gap-3 w-full justify-between">
                <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                  <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={assignmentSearchQuery}
                    onChange={(e) => {
                      setAssignmentSearchQuery(e.target.value);
                      setAssignmentsPage(1);
                    }}
                    placeholder="Search by engineer name, email, module, or track..."
                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none transition font-medium"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <select
                    value={assignmentStatusFilter}
                    onChange={(e) => {
                      setAssignmentStatusFilter(e.target.value);
                      setAssignmentsPage(1);
                    }}
                    className="w-full sm:w-auto min-w-[140px] max-w-full sm:max-w-[220px] md:max-w-[280px] truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 font-medium outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
                  >
                    <option value="all" className="truncate">All Statuses</option>
                    <option value="pending" className="truncate">Pending</option>
                    <option value="in_progress" className="truncate">In Progress</option>
                    <option value="completed" className="truncate">Completed</option>
                    <option value="overdue" className="truncate">Overdue</option>
                  </select>
                </div>
              </div>

              {/* Assignments Table Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                {loadingAssignments ? (
                  <div className="p-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-[#08306B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs font-semibold">Loading squad assignments...</p>
                  </div>
                ) : filteredSquadAssignments.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No assignments found</p>
                    <p className="text-xs text-slate-400">
                      {assignmentSearchQuery || assignmentStatusFilter !== 'all'
                        ? 'Try adjusting your search query or status filter.'
                        : 'No curriculum assignments have been dispatched to your squad yet.'}
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
                        {paginatedSquadAssignments.map((item) => {
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
                                <p className="font-medium text-slate-800">{assigner.fullName || assigner.full_name || 'Team Lead'}</p>
                                <p className="text-[11px] text-slate-400 capitalize">{assigner.role || 'Lead'}</p>
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

                {/* Table Pagination Footer */}
                {!loadingAssignments && filteredSquadAssignments.length > 0 && (
                  <div className="p-3.5 sm:p-4 border-t border-slate-100">
                    <Pagination
                      currentPage={assignmentsPage}
                      totalItems={filteredSquadAssignments.length}
                      pageSize={8}
                      onPageChange={setAssignmentsPage}
                      itemLabel="assignments"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'certificates' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center gap-3 w-full justify-between">
                <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                  <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={certSearchQuery}
                    onChange={(e) => {
                      setCertSearchQuery(e.target.value);
                      setCertsPage(1);
                    }}
                    placeholder="Search by engineer name, email, or certificate ID..."
                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none transition font-medium"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <select
                    value={certTrackFilter}
                    onChange={(e) => {
                      setCertTrackFilter(e.target.value);
                      setCertsPage(1);
                    }}
                    className="w-full sm:w-auto min-w-[140px] max-w-full sm:max-w-[220px] md:max-w-[280px] truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 font-medium outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
                  >
                    <option value="all" className="truncate">All Tracks</option>
                    {tracksList.map((tr) => (
                      <option key={tr._id} value={tr._id} className="truncate">
                        {tr.name || tr.title}
                      </option>
                    ))}
                  </select>

                  <select
                    value={certStatusFilter}
                    onChange={(e) => {
                      setCertStatusFilter(e.target.value);
                      setCertsPage(1);
                    }}
                    className="w-full sm:w-auto min-w-[140px] max-w-full sm:max-w-[220px] md:max-w-[280px] truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 font-medium outline-none focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] cursor-pointer"
                  >
                    <option value="all" className="truncate">All Statuses</option>
                    <option value="active" className="truncate">Active</option>
                    <option value="revoked" className="truncate">Revoked</option>
                  </select>
                </div>
              </div>

              {/* Certificates Table Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                {loadingCertificates ? (
                  <div className="p-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-[#08306B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs font-semibold">Loading squad certificates...</p>
                  </div>
                ) : filteredCertificates.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No certificates found</p>
                    <p className="text-xs text-slate-400">
                      {certSearchQuery || certTrackFilter !== 'all' || certStatusFilter !== 'all'
                        ? 'Try adjusting your search query or filters.'
                        : 'No engineers on your squad have earned a certificate yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3.5">Recipient Engineer</th>
                          <th className="px-4 py-3.5">Certificate ID</th>
                          <th className="px-4 py-3.5">Curriculum Track</th>
                          <th className="px-4 py-3.5">Tier</th>
                          <th className="px-4 py-3.5">Issued Date</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-5 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {paginatedCertificates.map((cert) => {
                          const eng = cert.engineer_id || cert.userId || {};
                          const track = cert.track_id || cert.trackId || {};
                          const tierVal = track.tier || cert.tier || 'EDGE';
                          const isDownloading = downloadingCertId === (cert.certificate_id || cert._id);

                          return (
                            <tr key={cert._id || cert.certificate_id} className="hover:bg-slate-50/70 transition">
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
                                <span className="font-mono text-xs font-bold text-[#08306B] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                  {cert.certificate_id}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 text-slate-800 font-semibold">
                                {track.title || track.name || 'EDGE Curriculum Track'}
                              </td>

                              <td className="px-4 py-3.5">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    tierVal === 'EDGE'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : 'bg-blue-100 text-[#08306B] border border-blue-200'
                                  }`}
                                >
                                  {tierVal}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 text-slate-500">
                                {new Date(cert.issued_at || cert.createdAt || Date.now()).toLocaleDateString()}
                              </td>

                              <td className="px-4 py-3.5">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    cert.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  {cert.status || 'active'}
                                </span>
                              </td>

                              <td className="px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <a
                                    href={`/verify/${cert.certificate_id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-[#08306B] hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                                  >
                                    Verify
                                  </a>
                                  <button
                                    onClick={() => handleDownloadCertPdf(cert)}
                                    disabled={isDownloading || cert.status === 'revoked'}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold bg-[#08306B] text-white hover:bg-[#062452] rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
                                  >
                                    {isDownloading ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Saving...</span>
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        <span>PDF</span>
                                      </>
                                    )}
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

                {/* Table Pagination Footer */}
                {!loadingCertificates && filteredCertificates.length > 0 && (
                  <div className="p-3.5 sm:p-4 border-t border-slate-100">
                    <Pagination
                      currentPage={certsPage}
                      totalItems={filteredCertificates.length}
                      pageSize={8}
                      onPageChange={setCertsPage}
                      itemLabel="certificates"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ASSIGN CURRICULUM MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Assign Curriculum to Team</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Assign a single module or entire certification track to your squad.</p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {assignSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{assignSuccess}</span>
              </div>
            )}

            {assignError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-5">
              {/* Step 1: Curriculum Scope (Module vs Track) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">1. Select Curriculum Scope</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-2.5 ${
                      curriculumScope === 'module'
                        ? 'bg-blue-50/70 border-[#08306B] ring-1 ring-[#08306B]'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="curriculumScope"
                      value="module"
                      checked={curriculumScope === 'module'}
                      onChange={() => setCurriculumScope('module')}
                      className="text-[#08306B] focus:ring-[#08306B]"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Single Module</p>
                      <p className="text-[10px] text-slate-500">Assign a specific topic</p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-2.5 ${
                      curriculumScope === 'track'
                        ? 'bg-blue-50/70 border-[#08306B] ring-1 ring-[#08306B]'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="curriculumScope"
                      value="track"
                      checked={curriculumScope === 'track'}
                      onChange={() => setCurriculumScope('track')}
                      className="text-[#08306B] focus:ring-[#08306B]"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Entire Track</p>
                      <p className="text-[10px] text-slate-500">Sequential modules</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Dynamic Target Selection (Module vs Track) */}
              {curriculumScope === 'module' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Module *</label>
                  {availableModules.length === 0 ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                      No modules available to assign.
                    </div>
                  ) : (
                    <select
                      value={selectedModuleId}
                      onChange={(e) => setSelectedModuleId(e.target.value)}
                      required
                      className="w-full truncate bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B]"
                    >
                      <option value="" className="truncate">-- Choose Module --</option>
                      {availableModules.map((mod) => (
                        <option key={mod._id || mod.id} value={mod._id || mod.id} className="truncate">
                          [{mod.trackTitle}] {mod.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Track *</label>
                  <select
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    required
                    className="w-full truncate bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B]"
                  >
                    <option value="" className="truncate">-- Choose Track --</option>
                    {tracksList.map((tr) => {
                      const modCount = getModulesForTrack(tr).length;
                      return (
                        <option key={tr._id} value={tr._id} className="truncate">
                          {tr.name || tr.title} ({modCount} module{modCount === 1 ? '' : 's'})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Step 2: Target Recipients */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">2. Target Recipients</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-2.5 ${
                      assignmentType === 'individual'
                        ? 'bg-blue-50/70 border-[#08306B] ring-1 ring-[#08306B]'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="assignmentType"
                      value="individual"
                      checked={assignmentType === 'individual'}
                      onChange={() => setAssignmentType('individual')}
                      className="text-[#08306B] focus:ring-[#08306B]"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Select Engineers</p>
                      <p className="text-[10px] text-slate-500">Pick squad members</p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-2.5 ${
                      assignmentType === 'team'
                        ? 'bg-blue-50/70 border-[#08306B] ring-1 ring-[#08306B]'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="assignmentType"
                      value="team"
                      checked={assignmentType === 'team'}
                      onChange={() => setAssignmentType('team')}
                      className="text-[#08306B] focus:ring-[#08306B]"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Entire Team</p>
                      <p className="text-[10px] text-slate-500">{totalEngineers} team members</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Individual Engineers Checkbox List */}
              {assignmentType === 'individual' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Team Engineers</label>
                    <button
                      type="button"
                      onClick={handleSelectAllEngineers}
                      className="text-[11px] font-semibold text-[#08306B] hover:underline cursor-pointer"
                    >
                      {selectedEngineerIds.length === engineersList.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                    {engineersList.length === 0 ? (
                      <p className="text-xs text-slate-400">No engineers assigned to your team squad yet.</p>
                    ) : (
                      engineersList.map((eng) => (
                        <label key={eng._id || eng.id} className="flex items-center gap-3 text-xs text-slate-800 cursor-pointer hover:bg-slate-100/70 p-1.5 rounded-lg transition">
                          <input
                            type="checkbox"
                            checked={selectedEngineerIds.includes(eng._id || eng.id)}
                            onChange={() => handleToggleEngineer(eng._id || eng.id)}
                            className="rounded border-slate-300 text-[#08306B] focus:ring-[#08306B]"
                          />
                          <span className="font-semibold">{eng.fullName || eng.name}</span>
                          <span className="text-slate-400 text-[11px]">({eng.email})</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    Selected: <strong className="text-slate-800">{selectedEngineerIds.length}</strong> engineer(s)
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <p className="font-semibold text-slate-800">
                    Assigning to all <span className="text-[#08306B] font-bold">{totalEngineers}</span> members of your squad.
                  </p>
                </div>
              )}

              {/* Step 3: Deadline Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">3. Completion Deadline (Optional)</label>
                <input
                  type="date"
                  value={deadlineAt}
                  onChange={(e) => setDeadlineAt(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08306B]/20 focus:border-[#08306B]"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Assigned engineers will receive an automated in-app bell notification and email.</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="bg-[#08306B] hover:bg-[#062452] text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {assignLoading ? 'Dispatching...' : 'Dispatch Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENGINEER CERTIFICATES DRILL-DOWN MODAL */}
      {selectedEngineerForCerts && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#08306B] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {(selectedEngineerForCerts.fullName || selectedEngineerForCerts.full_name || selectedEngineerForCerts.name || 'E')[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedEngineerForCerts.fullName || selectedEngineerForCerts.full_name || selectedEngineerForCerts.name}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedEngineerForCerts.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEngineerForCerts(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Earned Certificates ({engineerModalCertificates.length})</h4>
              </div>

              {engineerModalCertificates.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-1">
                  <p className="text-xs font-semibold text-slate-700">No certificates issued yet</p>
                  <p className="text-[11px] text-slate-400">This engineer has not completed all modules required for a certificate.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {engineerModalCertificates.map((cert) => {
                    const track = cert.track_id || cert.trackId || {};
                    const tierVal = track.tier || cert.tier || 'EDGE';
                    const isDownloading = downloadingCertId === (cert.certificate_id || cert._id);

                    return (
                      <div
                        key={cert._id || cert.certificate_id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-[#08306B] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              {cert.certificate_id}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                tierVal === 'EDGE'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-100 text-[#08306B] border border-blue-200'
                              }`}
                            >
                              {tierVal}
                            </span>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                cert.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {cert.status || 'active'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-900">{track.title || track.name || 'Curriculum Track'}</p>
                          <p className="text-[11px] text-slate-400">
                            Issued on {new Date(cert.issued_at || cert.createdAt || Date.now()).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <a
                            href={`/verify/${cert.certificate_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-[#08306B] hover:bg-white rounded-xl border border-slate-200 transition"
                          >
                            Verify
                          </a>
                          <button
                            onClick={() => handleDownloadCertPdf(cert)}
                            disabled={isDownloading || cert.status === 'revoked'}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-[#08306B] text-white hover:bg-[#062452] rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                          >
                            {isDownloading ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Download PDF</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedEngineerForCerts(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENGINEER ASSIGNMENTS DRILL-DOWN MODAL */}
      {selectedEngineerForAssignments && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#08306B] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {(selectedEngineerForAssignments.fullName || selectedEngineerForAssignments.full_name || selectedEngineerForAssignments.name || 'E')[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedEngineerForAssignments.fullName || selectedEngineerForAssignments.full_name || selectedEngineerForAssignments.name}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedEngineerForAssignments.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEngineerForAssignments(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Curriculum Assignments ({engineerModalAssignments.length})
                </h4>
              </div>

              {engineerModalAssignments.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-1">
                  <p className="text-xs font-semibold text-slate-700">No active assignments found</p>
                  <p className="text-[11px] text-slate-400">This engineer has not been assigned any modules yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {engineerModalAssignments.map((assignment) => {
                    const mod = assignment.module_id || assignment.moduleId || {};
                    const track = mod.track_id || mod.trackId || {};
                    const assigner = assignment.assigned_by || assignment.assignedBy || {};
                    const statusVal = assignment.computed_status || assignment.status || 'pending';
                    const isOverdue = assignment.is_overdue || statusVal === 'overdue';

                    return (
                      <div
                        key={assignment._id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{mod.title || 'Training Module'}</span>
                            {track.tier && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  track.tier === 'EDGE'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-blue-100 text-[#08306B] border border-blue-200'
                                }`}
                              >
                                {track.tier}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Track: <strong>{track.title || track.name || 'General Curriculum'}</strong>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Assigned by {assigner.fullName || assigner.full_name || 'Team Lead'} on{' '}
                            {new Date(assignment.assigned_at || assignment.createdAt || Date.now()).toLocaleDateString()}
                          </p>
                          {assignment.deadline_at && (
                            <p className={`text-[11px] font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                              Deadline: {new Date(assignment.deadline_at).toLocaleDateString()} {isOverdue && '(Overdue)'}
                            </p>
                          )}
                        </div>

                        <div className="self-end sm:self-center shrink-0">
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedEngineerForAssignments(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  );
};

export default TeamLeadDashboard;
