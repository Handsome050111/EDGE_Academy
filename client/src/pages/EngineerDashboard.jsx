import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NotificationBell from '../components/NotificationBell';
import QuizModal from '../components/QuizModal';
import ProfileModal from '../components/ProfileModal';
import VideoPlayer, { formatTime, resolveVideoUrl } from '../components/VideoPlayer';
import Pagination from '../components/Pagination';
import api from '../services/api';

export const formatDuration = (mod) => {
  if (!mod) return '0 min';
  if (mod.video_duration_sec && !isNaN(mod.video_duration_sec) && Number(mod.video_duration_sec) > 0) {
    const mins = Math.round(Number(mod.video_duration_sec) / 60);
    return mins > 0 ? `${mins} min` : `${mod.video_duration_sec} sec`;
  }
  if (mod.duration_sec && !isNaN(mod.duration_sec) && Number(mod.duration_sec) > 0) {
    const mins = Math.round(Number(mod.duration_sec) / 60);
    return mins > 0 ? `${mins} min` : `${mod.duration_sec} sec`;
  }
  const est = mod.estimatedDurationMinutes || mod.estimated_duration_min || mod.estimated_minutes;
  if (est && !isNaN(est) && Number(est) > 0) {
    return `${est} min`;
  }
  return '0 min';
};

const EngineerDashboard = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' | 'tracks' | 'certificates'
  const [expandedTrack, setExpandedTrack] = useState('');
  const [activeModule, setActiveModule] = useState(null);
  const [activeLessonData, setActiveLessonData] = useState({
    moduleTitle: '',
    title: '',
    description: '',
    duration: '',
    streamUrl: '',
    thumbnail_url: null,
    attachments: [],
    chapters: [],
  });

  const [showQuizModal, setShowQuizModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [verifySearchId, setVerifySearchId] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Live aggregated dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [certificatesList, setCertificatesList] = useState([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [certificatesPage, setCertificatesPage] = useState(1);

  // Video playback speed, position, and resume state
  const [percentWatched, setPercentWatched] = useState(0);
  const [videoPosition, setVideoPosition] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [resumeNotice, setResumeNotice] = useState('');
  const targetSeekPositionRef = useRef(0);
  const maxPercentWatchedRef = useRef(0);
  const videoRef = useRef(null);
  const throttleRef = useRef(null);

  // Sequential Module Locking + Track-Level CORE-requires-EDGE locking
  const enrichedTracks = useMemo(() => {
    if (!dashboardData?.enrolledTracks) return [];

    const tracks = dashboardData.enrolledTracks;

    // Determine whether EDGE track is fully complete
    const edgeTrack = tracks.find((t) => t.tier === 'EDGE');
    const isEdgeComplete = edgeTrack
      ? (edgeTrack.modules || []).length > 0 &&
        (edgeTrack.modules || []).every((m) => m.status === 'completed')
      : false;

    return tracks.map((track) => {
      const isCoreTier = track.tier === 'CORE';
      // CORE track is track-locked if EDGE is not fully complete
      const isTrackLocked = isCoreTier && !isEdgeComplete;

      let previousModulePassed = true;
      const modules = (track.modules || []).map((m, idx) => {
        const isCompleted = m.status === 'completed';
        // Assignment override: a module with an active assignment is always accessible
        const isAssigned = Boolean(m.hasAssignment);
        // Module-level sequential lock (within-track)
        const isSequentiallyLocked = idx > 0 && !previousModulePassed;
        previousModulePassed = isCompleted;

        // Final lock determination:
        //  - Assignment override unlocks both track-level AND sequential locks
        //  - Otherwise: locked if the track is track-locked OR if sequentially locked
        const isLocked = !isAssigned && (isTrackLocked || isSequentiallyLocked);

        return {
          ...m,
          isLocked,
          isAssigned,
          isTrackLocked: isTrackLocked && !isAssigned,
          lockReason: isTrackLocked && !isAssigned ? 'EDGE_REQUIRED' : null,
          effectiveStatus: isLocked ? 'locked' : m.status,
        };
      });

      return {
        ...track,
        isTrackLocked: isTrackLocked && !modules.some((m) => m.isAssigned),
        lockReason: isTrackLocked ? 'EDGE_REQUIRED' : null,
        modules,
      };
    });
  }, [dashboardData]);

  // Flattened ordered modules across tracks for sequential prev/next navigation
  const allModulesList = useMemo(() => {
    return enrichedTracks.flatMap((t) => t.modules || []);
  }, [enrichedTracks]);

  const paginatedCertificates = useMemo(() => {
    return certificatesList.slice((certificatesPage - 1) * 8, certificatesPage * 8);
  }, [certificatesList, certificatesPage]);

  // Fetch Live Learner Dashboard Data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoadingDashboard(true);
      const res = await api.get('/me/dashboard');
      if (res.data) {
        setDashboardData(res.data);
        if (res.data.enrolledTracks && res.data.enrolledTracks.length > 0) {
          setExpandedTrack(res.data.enrolledTracks[0]._id);
        }
        if (res.data.activeModule) {
          const mod = res.data.activeModule;
          setActiveModule(mod._id);
          setActiveLessonData({
            moduleTitle: mod.moduleTitle || mod.title,
            title: mod.title,
            description: mod.description || '',
            duration: formatDuration(mod),
            streamUrl: mod.streamUrl || mod.signed_video_url || '',
            thumbnail_url: mod.thumbnail_url || mod.thumbnailUrl || null,
            attachments: mod.attachments || [],
            chapters: Array.isArray(mod.chapters) ? mod.chapters : [],
          });
          const savedPos = mod.position_sec || 0;
          const savedPct = mod.percent_watched || 0;
          maxPercentWatchedRef.current = savedPct;
          setPercentWatched(savedPct);
          setVideoPosition(savedPos);
          targetSeekPositionRef.current = savedPos;
        }
      }
    } catch (err) {
      console.error('Error fetching learner dashboard:', err);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const handleModuleSelect = async (modId) => {
    // Check if the module is locked
    const targetMod = allModulesList.find((m) => m._id === modId);
    if (targetMod && targetMod.isLocked) {
      alert(t('engineerDashboard.lockedModuleAlert'));
      return;
    }

    setActiveModule(modId);
    try {
      const [modRes, progRes] = await Promise.all([
        api.get(`/modules/${modId}`),
        api.get(`/modules/${modId}/video-progress`).catch(() => ({ data: { position_sec: 0, percent_watched: 0 } })),
      ]);

      if (modRes.data) {
        const mod = modRes.data;
        const videoSrc = mod.signed_video_url || mod.videoUrl || mod.streamUrl || '';
        const savedPos = progRes.data?.position_sec || 0;
        const savedPct = progRes.data?.percent_watched || 0;

        setActiveLessonData({
          moduleTitle: mod.trackId?.title || mod.track_id?.name || mod.title,
          title: mod.title,
          description: mod.description || '',
          duration: formatDuration(mod),
          streamUrl: videoSrc,
          thumbnail_url: mod.thumbnail_url || mod.thumbnailUrl || null,
          attachments: mod.attachments || [],
          chapters: Array.isArray(mod.chapters) ? mod.chapters : [],
        });
        maxPercentWatchedRef.current = savedPct;
        setPercentWatched(savedPct);
        setVideoPosition(savedPos);
        targetSeekPositionRef.current = savedPos;
      }
    } catch (err) {
      console.error('Error fetching selected module:', err);
    }
  };

  // Fetch Certificates on tab select or load
  const fetchCertificates = useCallback(async () => {
    try {
      setLoadingCertificates(true);
      const res = await api.get('/certificates/my-certificates');
      if (res.data) {
        setCertificatesList(res.data);
      }
    } catch (err) {
      console.error('Error fetching certificates:', err);
    } finally {
      setLoadingCertificates(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchCertificates();
  }, [fetchDashboardData, fetchCertificates]);

  useEffect(() => {
    if (currentTab === 'certificates') {
      fetchCertificates();
    }
  }, [currentTab, fetchCertificates]);

  // Throttled video progress save (every 10 seconds)
  const saveVideoProgress = useCallback(async (positionSec, pctWatched) => {
    if (!activeModule) return;
    try {
      await api.post(`/modules/${activeModule}/video-progress`, {
        position_sec: Math.round(positionSec),
        percent_watched: Math.round(pctWatched),
      });
    } catch { /* silent fail for progress saves */ }
  }, [activeModule]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const livePct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    const currentRounded = Math.round(livePct);
    const monotonicPct = Math.max(maxPercentWatchedRef.current, currentRounded);
    maxPercentWatchedRef.current = monotonicPct;
    setPercentWatched(monotonicPct);
    setVideoPosition(video.currentTime);

    if (!throttleRef.current) {
      throttleRef.current = setTimeout(() => {
        saveVideoProgress(video.currentTime, maxPercentWatchedRef.current);
        throttleRef.current = null;
      }, 10000);
    }
  }, [saveVideoProgress]);

  const handleVideoEnded = useCallback(async () => {
    maxPercentWatchedRef.current = 100;
    setPercentWatched(100);
    const duration = videoRef.current?.duration || videoPosition;
    setVideoPosition(duration);
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
      throttleRef.current = null;
    }
    // Await server-side save so the 95%+ completion is committed to database before user clicks Take Quiz
    await saveVideoProgress(duration, 100);
  }, [saveVideoProgress, videoPosition]);

  const currentModule = useMemo(() => {
    return allModulesList.find((m) => m._id === activeModule);
  }, [allModulesList, activeModule]);

  const hasPassedQuiz = currentModule?.status === 'completed';
  const isVideoWatched = percentWatched >= 95;
  const quizUnlocked = isVideoWatched;

  const handleLessonChange = (direction) => {
    const currentIndex = allModulesList.findIndex((m) => m._id === activeModule);
    if (currentIndex === -1) return;

    if (direction === 'prev') {
      if (currentIndex > 0) {
        handleModuleSelect(allModulesList[currentIndex - 1]._id);
      }
    } else if (direction === 'next') {
      if (currentIndex < allModulesList.length - 1) {
        const nextMod = allModulesList[currentIndex + 1];
        if (nextMod.isLocked) {
          alert(t('engineerDashboard.lockedModuleAlert'));
          return;
        }
        handleModuleSelect(nextMod._id);
      }
    }
  };

  const handleMarkLessonComplete = async () => {
    if (!activeModule) return;
    try {
      maxPercentWatchedRef.current = 100;
      setPercentWatched(100);
      const pos = videoRef.current?.duration || videoPosition;
      await saveVideoProgress(pos, 100);
      alert(t('engineerDashboard.lessonCompleted'));
    } catch (err) {
      alert(t('common.error') + ': ' + err.message);
    }
  };

  const handleStartQuiz = () => {
    if (!quizUnlocked && !hasPassedQuiz) {
      alert(t('engineerDashboard.quizLockedAlert', { percent: percentWatched }));
      return;
    }
    setShowQuizModal(true);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verifySearchId.trim()) {
      setVerifyResult({
        valid: false,
        message: 'Please enter a certificate ID to verify.',
      });
      return;
    }
    try {
      setVerifyLoading(true);
      const res = await api.get(`/certificates/verify/${verifySearchId.trim()}`);
      if (res.data) {
        setVerifyResult({
          valid: res.data.valid,
          certificate: res.data.certificate,
        });
      }
    } catch (err) {
      setVerifyResult({
        valid: false,
        message: err.response?.data?.message || t('engineerDashboard.noCertificateFound', { id: verifySearchId }),
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDownloadPdf = async (cert) => {
    const certId = cert._id || cert.certificate_id || cert.id;
    try {
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
      let errorMessage = t('engineerDashboard.downloadError') || 'Failed to download certificate PDF. Please try again.';
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
    }
  };

  const renderStatusBadge = (effectiveStatus) => {
    switch (effectiveStatus) {
      case 'completed':
        return (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold inline-block border bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
            {t('engineerDashboard.statusCompleted')}
          </span>
        );
      case 'in_progress':
        return (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold inline-block border bg-blue-500/20 text-blue-300 border-blue-400/30">
            {t('engineerDashboard.statusInProgress')}
          </span>
        );
      case 'locked':
        return (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1 border bg-slate-700/50 text-slate-300 border-slate-600/40">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {t('engineerDashboard.statusLocked')}
          </span>
        );
      default:
        return (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold inline-block border bg-slate-500/20 text-slate-300 border-slate-400/30">
            {t('engineerDashboard.statusAvailable')}
          </span>
        );
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F8FAFC] flex flex-col lg:flex-row font-sans relative">
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Slide-Out Navigation Drawer on Mobile / Fixed Full-Height Sidebar on Desktop */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[78vw] max-w-xs sm:max-w-sm lg:w-72 bg-[#092857] text-white p-6 flex flex-col justify-between border-r border-blue-900/40 shrink-0 h-screen overflow-y-auto shadow-2xl lg:shadow-none transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto">
          {/* Drawer Header with Title + Subtext + Close Button */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                {t('engineerDashboard.title')}
              </h1>
              <p className="text-xs text-blue-300/70 font-medium mt-0.5">{t('engineerDashboard.subtitle')}</p>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white transition cursor-pointer"
              aria-label={t('engineerDashboard.closeNav')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Primary Navigation Tabs */}
          <nav className="space-y-1 mb-6 border-b border-blue-900/60 pb-4">
            <button
              onClick={() => {
                setCurrentTab('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentTab === 'dashboard' ? 'bg-white/20 text-white shadow-xs' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>{t('dashboard')}</span>
            </button>
            <button
              onClick={() => {
                setCurrentTab('tracks');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentTab === 'tracks' ? 'bg-white/20 text-white shadow-xs' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>{t('myTracks')}</span>
            </button>
            <button
              onClick={() => {
                setCurrentTab('certificates');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentTab === 'certificates' ? 'bg-white/20 text-white shadow-xs' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <span>{t('myCertificates')}</span>
            </button>
          </nav>

          {/* Dynamic Sidebar Tracks with Sequential Locking */}
          <div className="space-y-4">
            {loadingDashboard ? (
              <div className="rounded-2xl bg-white/10 border border-white/20 p-4 text-xs text-blue-200">
                {t('engineerDashboard.loadingTracks')}
              </div>
            ) : enrichedTracks.length === 0 ? (
              <div className="rounded-2xl bg-white/10 border border-white/20 p-4 text-xs text-blue-200 leading-relaxed">
                <strong>{t('engineerDashboard.noAssignedTracks')}</strong>
                <p className="text-[11px] text-blue-300/80 mt-1">
                  {t('engineerDashboard.noAssignedTracksDesc')}
                </p>
              </div>
            ) : (
              enrichedTracks.map((track) => (
                <div key={track._id} className="rounded-2xl bg-white/10 border border-white/20 p-4 shadow-sm">
                  <button
                    onClick={() => setExpandedTrack(expandedTrack === track._id ? '' : track._id)}
                    className="w-full flex items-center justify-between text-left mb-2 cursor-pointer"
                  >
                    <span className="text-sm font-bold text-white truncate">{track.title}</span>
                    <span className="text-xs text-blue-300 font-mono">
                      {track.progressPercent || 0}% {expandedTrack === track._id ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Module List Accordion Content */}
                  {expandedTrack === track._id && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-white/10">
                      {track.modules && track.modules.length > 0 ? (
                        track.modules.map((m) => {
                          const isSelected = activeModule === m._id;
                          const isLocked = m.isLocked;
                          const thumb = m.thumbnail_url || (m.video_provider_id ? `https://videodelivery.net/${m.video_provider_id}/thumbnails/thumbnail.jpg` : null);

                          return (
                            <button
                              key={m._id}
                              onClick={() => {
                                if (isLocked) {
                                  alert(t('engineerDashboard.lockedModuleAlert'));
                                  return;
                                }
                                handleModuleSelect(m._id);
                                setMobileMenuOpen(false);
                              }}
                              disabled={isLocked}
                              className={`w-full p-2.5 rounded-xl text-left transition flex items-center gap-3 ${
                                isLocked
                                  ? 'opacity-60 cursor-not-allowed bg-white/5 border border-white/5'
                                  : isSelected
                                  ? 'bg-white/25 ring-1 ring-white/40 shadow-xs cursor-pointer'
                                  : 'hover:bg-white/10 cursor-pointer'
                              }`}
                            >
                              <div className="h-10 w-14 rounded-lg bg-slate-900 overflow-hidden shrink-0 border border-white/10 flex items-center justify-center relative">
                                {thumb ? (
                                  <img src={resolveVideoUrl(thumb)} alt={m.title} className="w-full h-full object-cover" />
                                ) : isLocked ? (
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="text-xs font-bold text-white truncate">{m.title}</span>
                                </div>
                                {renderStatusBadge(m.effectiveStatus)}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-[11px] text-blue-300/60 italic py-1">{t('engineerDashboard.noModulesInTrack')}</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Bottom Profile & Logout Footer */}
        <div className="pt-6 border-t border-blue-900/50 space-y-3 mt-auto">
          <button
            onClick={() => {
              setShowProfileModal(true);
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-white/10 transition cursor-pointer text-left group"
            title={t('profile')}
          >
            <div className="h-9 w-9 rounded-xl bg-[#08306B] border border-blue-400/30 flex items-center justify-center font-bold text-white text-sm shadow-sm shrink-0 group-hover:border-white/50 transition">
              {(user?.fullName || 'E')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate group-hover:text-blue-200 transition">{user?.fullName || t('engineer')}</p>
              <p className="text-xs text-blue-300/60 truncate capitalize">{user?.role?.replace('_', ' ') || t('engineer')}</p>
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
            <span>{t('logout')}</span>
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
              aria-label={t('engineerDashboard.openNav')}
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Right: Notification Bell, Language Switcher & Profile Badge */}
          <div className="flex items-center gap-3 sm:gap-5">
            <NotificationBell />
            <LanguageSwitcher />

            {/* Static Top-Right Profile Display */}
            <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-slate-200 select-none">
              <div className="h-8 w-8 rounded-full bg-[#08306B] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                {(user?.fullName || 'E')[0]}
              </div>
              <span className="text-xs font-semibold text-slate-800 hidden sm:inline truncate max-w-[120px]">
                {user?.fullName || t('engineer')}
              </span>
            </div>
          </div>
        </header>

        {/* Right Main Content: DASHBOARD TAB */}
        {currentTab === 'dashboard' && (
          <main className="flex-1 p-5 sm:p-8 lg:p-10 xl:p-12 overflow-y-auto flex flex-col gap-8">
            {!activeModule || enrichedTracks.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm text-center space-y-4">
                <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto border border-blue-100">
                  <svg className="w-8 h-8 text-[#08306B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {t('engineerDashboard.welcomeTitle', { name: user?.fullName || t('engineer') })}
                </h2>
                <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
                  {t('engineerDashboard.welcomeNoModules')}
                </p>
              </div>
            ) : (
              /* Active Video & Lesson Content */
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">
                      {activeLessonData.moduleTitle}
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{activeLessonData.title}</h1>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">
                      {t('engineerDashboard.durationLabel', { duration: activeLessonData.duration })}
                    </span>
                  </div>
                </div>

                {/* Video Player Component */}
                <VideoPlayer
                  streamUrl={activeLessonData.streamUrl}
                  thumbnailUrl={activeLessonData.thumbnail_url}
                  title={activeLessonData.title}
                  videoRef={videoRef}
                  playbackRate={playbackRate}
                  setPlaybackRate={setPlaybackRate}
                  videoPosition={videoPosition}
                  percentWatched={percentWatched}
                  resumeNotice={resumeNotice}
                  onRestart={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.play().catch(() => {});
                    }
                    setVideoPosition(0);
                    setResumeNotice('');
                  }}
                  onLoadedMetadata={() => {
                    if (!videoRef.current) return;
                    videoRef.current.playbackRate = playbackRate;
                    const seekPos = targetSeekPositionRef.current || videoPosition || 0;
                    if (seekPos > 3 && (!videoRef.current.duration || seekPos < videoRef.current.duration - 5)) {
                      videoRef.current.currentTime = seekPos;
                      setResumeNotice(t('videoPlayer.resumedAt', { time: formatTime(seekPos) }));
                      setTimeout(() => setResumeNotice(''), 6000);
                    }
                  }}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                />

                {/* CONDITIONAL CHAPTER MARKERS */}
                {activeLessonData.chapters && activeLessonData.chapters.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        {t('engineerDashboard.chapterMarkers', { count: activeLessonData.chapters.length })}
                      </h3>
                      <span className="text-[11px] font-medium text-slate-500">
                        {t('engineerDashboard.chapterSubtitle')}
                      </span>
                    </div>

                    {/* Interactive Chapter Timeline Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {activeLessonData.chapters.map((chap, idx) => {
                        const nextChap = activeLessonData.chapters[idx + 1];
                        const isCurrent =
                          videoPosition >= chap.timestamp_sec &&
                          (!nextChap || videoPosition < nextChap.timestamp_sec);

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (videoRef.current) {
                                videoRef.current.currentTime = chap.timestamp_sec;
                                videoRef.current.play().catch(() => {});
                              }
                              setVideoPosition(chap.timestamp_sec);
                            }}
                            className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                              isCurrent
                                ? 'bg-blue-50/80 border-[#08306B] shadow-xs ring-1 ring-[#08306B]/30'
                                : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                                  isCurrent
                                    ? 'bg-[#08306B] text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {formatTime(chap.timestamp_sec)}
                              </span>
                              {isCurrent && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping"></span>
                                  {t('engineerDashboard.playing')}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs font-bold truncate ${isCurrent ? 'text-[#08306B]' : 'text-slate-800'}`}>
                              {chap.title}
                            </p>
                            {chap.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                {chap.description}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lesson Navigation Controls Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => handleLessonChange('prev')}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      {t('engineerDashboard.prevLesson')}
                    </button>
                    <button
                      onClick={() => handleLessonChange('next')}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      {t('engineerDashboard.nextLesson')}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={handleMarkLessonComplete}
                      className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer ${
                        isVideoWatched
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-[#08306B] hover:bg-[#062452] text-white'
                      }`}
                    >
                      {isVideoWatched ? t('engineerDashboard.lessonCompleted') : t('engineerDashboard.markAsCompleted')}
                    </button>

                    <button
                      onClick={handleStartQuiz}
                      className={`flex-1 sm:flex-none text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer ${
                        quizUnlocked || hasPassedQuiz ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-400 cursor-not-allowed opacity-75'
                      }`}
                    >
                      {hasPassedQuiz ? (t('engineerDashboard.retakeQuizPractice') || 'Retake Quiz (Practice)') : t('engineerDashboard.takeModuleQuiz')} {!quizUnlocked && !hasPassedQuiz && `(${percentWatched}%/95%)`}
                    </button>
                  </div>
                </div>

                {/* Supporting Attachments Section */}
                <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    {t('engineerDashboard.supportingAttachments')}
                  </h3>
                  {activeLessonData.attachments?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">{t('engineerDashboard.noAttachments')}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeLessonData.attachments.map((att) => (
                        <a
                          key={att._id || att.storage_path}
                          href={resolveVideoUrl(att.storage_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 transition text-xs group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <svg className="w-4 h-4 text-slate-400 group-hover:text-[#08306B] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-semibold text-slate-800 truncate group-hover:text-[#08306B]">
                              {att.filename}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                            {att.file_size_bytes ? (att.file_size_bytes / (1024 * 1024)).toFixed(1) + ' MB' : t('engineerDashboard.attachment')}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        )}

        {/* MY TRACKS TAB VIEW */}
        {currentTab === 'tracks' && (
          <div className="flex-1 p-6 sm:p-10 lg:p-14 overflow-y-auto space-y-8 max-w-7xl mx-auto w-full">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">{t('myLearningTracksPage')}</h1>
              <p className="text-base text-slate-500 mt-2">{t('tracksPageSubtitle')}</p>
            </div>

            <div className="space-y-6">
              {enrichedTracks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
                  {t('engineerDashboard.noAssignedTracks')}
                </div>
              ) : (
                  enrichedTracks.map((track) => (
                  <div key={track._id} className={`rounded-3xl border bg-white p-6 sm:p-8 shadow-sm ${track.isTrackLocked ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-2xl font-bold text-slate-900">{track.title}</h2>
                          <span className="bg-[#08306B]/10 text-[#08306B] border border-[#08306B]/20 text-xs px-3 py-1 rounded-full font-bold">
                            {track.tier}
                          </span>
                          {track.isTrackLocked && (
                            <span className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-300 text-xs px-2.5 py-1 rounded-full font-semibold">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              Complete EDGE first
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-sm md:text-base">{track.description}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-2xl font-extrabold text-[#08306B]">{track.progressPercent}%</span>
                        <p className="text-xs text-slate-500 font-medium">{t('passThreshold', { percent: 80 })}</p>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-8">
                      <div className="bg-[#08306B] h-full transition-all duration-500" style={{ width: `${track.progressPercent}%` }}></div>
                    </div>

                    <div className="space-y-3">
                      {track.modules.map((m) => {
                        const isLocked = m.isLocked;
                        const isAssigned = m.isAssigned;
                        return (
                          <div
                            key={m._id}
                            onClick={() => {
                              if (isLocked) {
                                const msg = m.lockReason === 'EDGE_REQUIRED'
                                  ? 'Complete the EDGE track before accessing CORE modules.'
                                  : t('engineerDashboard.lockedModuleAlert');
                                alert(msg);
                                return;
                              }
                              handleModuleSelect(m._id);
                              setCurrentTab('dashboard');
                            }}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition cursor-pointer ${
                              isLocked
                                ? 'bg-slate-100/70 border-slate-200/80 opacity-70 cursor-not-allowed'
                                : isAssigned
                                ? 'border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50/70 hover:border-indigo-400'
                                : 'border-slate-200 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {isLocked ? (
                                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              ) : (
                                <span className={`w-3 h-3 rounded-full shrink-0 ${m.status === 'completed' ? 'bg-emerald-500' : m.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                              )}
                              <span className={`font-bold text-sm md:text-base ${isLocked ? 'text-slate-500' : 'text-slate-800'}`}>
                                {m.title}
                              </span>
                              {isAssigned && !isLocked && (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700 border border-indigo-300 px-2 py-0.5 rounded-full ml-1">
                                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  Assigned
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4">
                              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                                isLocked
                                  ? 'bg-slate-200 text-slate-500'
                                  : m.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : m.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-200 text-slate-600'
                              }`}>
                                {isLocked
                                  ? m.lockReason === 'EDGE_REQUIRED' ? 'EDGE Required' : t('engineerDashboard.statusLocked')
                                  : m.status === 'completed'
                                  ? t('engineerDashboard.statusCompleted')
                                  : m.status === 'in_progress'
                                  ? t('engineerDashboard.statusInProgress')
                                  : t('engineerDashboard.statusAvailable')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MY CERTIFICATES TAB VIEW */}
        {currentTab === 'certificates' && (
          <div className="flex-1 p-6 sm:p-10 lg:p-14 overflow-y-auto space-y-10 max-w-7xl mx-auto w-full">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">{t('myCertificatesPage')}</h1>
              <p className="text-base text-slate-500 mt-2">{t('certificatesPageSubtitle')}</p>
            </div>

            {/* Public Verification Bar */}
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-[#08306B] mb-2">{t('publicVerification')}</h3>
              <p className="text-sm text-slate-600 mb-4">{t('publicVerificationDesc')}</p>
              <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <input
                  type="text"
                  placeholder={t('engineerDashboard.verifyPlaceholder')}
                  value={verifySearchId}
                  onChange={(e) => {
                    setVerifySearchId(e.target.value);
                    if (verifyResult) setVerifyResult(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#08306B]"
                />
                <button
                  type="submit"
                  disabled={verifyLoading}
                  className="bg-[#08306B] hover:bg-[#062452] text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  {verifyLoading ? t('engineerDashboard.verifying') : t('verifyId')}
                </button>
              </form>

              {verifyResult && (
                <div className="mt-4 p-4 rounded-xl border bg-white text-xs">
                  {verifyResult.valid ? (
                    <div className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>
                        {t('engineerDashboard.validCertificate', {
                          id: verifyResult.certificate?.certificate_id,
                          track: verifyResult.certificate?.track_id?.title || t('tracks'),
                        })}
                      </span>
                    </div>
                  ) : (
                    <div className="text-rose-600 font-semibold flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{verifyResult.message || t('engineerDashboard.invalidCertificate')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Certificates List Grid */}
            {loadingCertificates ? (
              <div className="p-8 text-center text-slate-500">{t('engineerDashboard.loadingCertificates')}</div>
            ) : certificatesList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
                {t('engineerDashboard.noCertificatesEarned')}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paginatedCertificates.map((cert) => (
                    <div key={cert._id || cert.certificate_id} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold font-mono bg-blue-50 text-[#08306B] border border-blue-200 px-3 py-1 rounded-full">
                            {cert.certificate_id}
                          </span>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase">
                            {cert.status || t('common.active')}
                          </span>
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-900 mb-2">{cert.track_id?.title || cert.trackTitle || 'EDGE Certified Technician'}</h3>
                        <p className="text-sm text-slate-500 mb-4">
                          {t('engineerDashboard.tierLabel', { tier: cert.tier || 'EDGE' })} · {t('engineerDashboard.issuedOn', { date: new Date(cert.issued_at || cert.issuedAt).toLocaleDateString() })}
                        </p>

                        <div className="text-xs text-slate-400 space-y-1 border-t border-slate-100 pt-3">
                          {cert.director_name && <p>{t('engineerDashboard.director', { name: cert.director_name })}</p>}
                          {cert.instructor_name && <p>{t('engineerDashboard.instructor', { name: cert.instructor_name })}</p>}
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{t('verifiedAuthentic')}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/verify/${cert.certificate_id}`;
                              navigator.clipboard.writeText(url);
                              alert(t('engineerDashboard.verificationLinkCopied', { url }));
                            }}
                            className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer"
                          >
                            {t('engineerDashboard.copyVerificationLink')}
                          </button>

                          <button
                            onClick={() => handleDownloadPdf(cert)}
                            className="bg-[#08306B] hover:bg-[#062452] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>{t('downloadPdf')}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Certificates Pagination */}
                <Pagination
                  currentPage={certificatesPage}
                  totalItems={certificatesList.length}
                  pageSize={8}
                  onPageChange={setCertificatesPage}
                  itemLabel={t('myCertificates')}
                />
              </div>
            )}
          </div>
        )}

        {/* Quiz Modal */}
        {showQuizModal && (
          <QuizModal
            moduleId={activeModule}
            onClose={() => setShowQuizModal(false)}
            onComplete={() => {
              setShowQuizModal(false);
              fetchDashboardData();
            }}
          />
        )}

        {/* Profile Modal */}
        <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
      </div>
    </div>
  );
};

export default EngineerDashboard;
