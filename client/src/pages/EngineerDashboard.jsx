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
import Logo from '../components/Logo';

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

  // Quiz result review modal (My Tracks tab)
  const [quizResultModal, setQuizResultModal] = useState(null); // { moduleId, moduleTitle }
  const [quizResultData, setQuizResultData] = useState(null);
  const [quizResultLoading, setQuizResultLoading] = useState(false);

  // Collapsible tracks accordion state for My Tracks page (trackId -> boolean)
  const [collapsedTracks, setCollapsedTracks] = useState({});

  const toggleTrackCollapse = (trackId) => {
    setCollapsedTracks((prev) => ({
      ...prev,
      [trackId]: !prev[trackId],
    }));
  };

  // Video playback speed, position, and resume state
  const [percentWatched, setPercentWatched] = useState(0);
  const [videoPosition, setVideoPosition] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [resumeNotice, setResumeNotice] = useState('');
  const targetSeekPositionRef = useRef(0);
  const maxPercentWatchedRef = useRef(0);
  const videoRef = useRef(null);
  const throttleRef = useRef(null);

  // All published tracks and modules are fully accessible across both EDGE and CORE tiers
  const enrichedTracks = useMemo(() => {
    if (!dashboardData?.enrolledTracks) return [];

    const tracks = dashboardData.enrolledTracks;

    return tracks.map((track) => {
      const modules = (track.modules || []).map((m) => {
        const isCompleted = m.status === 'completed';
        const isAssigned = Boolean(m.hasAssignment);

        return {
          ...m,
          isLocked: false,
          isAssigned,
          isTrackLocked: false,
          lockReason: null,
          effectiveStatus: m.status,
        };
      });

      return {
        ...track,
        isTrackLocked: false,
        lockReason: null,
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
    // Auto-expand the parent track in the sidebar
    const parentTrack = enrichedTracks.find((t) =>
      (t.modules || []).some((m) => m._id === modId)
    );
    if (parentTrack) {
      setExpandedTrack(parentTrack._id);
    }

    // Switch view to dashboard where video player and lesson content live
    setCurrentTab('dashboard');
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

  const handleContinueTrack = (track) => {
    if (!track) return;

    // Find the next uncompleted module, or the first module
    const nextMod =
      (track.modules || []).find((m) => !m.isCompleted) ||
      (track.modules || [])[0];

    if (nextMod) {
      setExpandedTrack(track._id);
      handleModuleSelect(nextMod._id);
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
    const prevMax = maxPercentWatchedRef.current;
    const monotonicPct = Math.max(prevMax, currentRounded);
    maxPercentWatchedRef.current = monotonicPct;
    setPercentWatched(monotonicPct);
    setVideoPosition(video.currentTime);

    // When the watched % first crosses the 95% quiz-unlock threshold, flush to
    // the server immediately (cancel the pending 10-second throttle first).
    // Without this, the DB can still hold < 95% when the engineer clicks
    // "Take Quiz" right after the button unlocks, causing a server-side 403.
    if (prevMax < 95 && monotonicPct >= 95) {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
      saveVideoProgress(video.currentTime, monotonicPct);
      return;
    }

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
  const quizUnlocked = percentWatched >= 95;

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
        handleModuleSelect(nextMod._id);
      }
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

  const openQuizResult = async (moduleId, moduleTitle) => {
    setQuizResultModal({ moduleId, moduleTitle });
    setQuizResultData(null);
    setQuizResultLoading(true);
    try {
      const res = await api.get(`/modules/${moduleId}/quiz-result`);
      setQuizResultData(res.data);
    } catch (err) {
      setQuizResultData({ error: err.response?.data?.error?.message || 'Could not load quiz results.' });
    } finally {
      setQuizResultLoading(false);
    }
  };

  const closeQuizResult = () => {
    setQuizResultModal(null);
    setQuizResultData(null);
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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[78vw] max-w-xs sm:max-w-sm lg:w-72 bg-[#092857] text-white p-5 flex flex-col justify-between border-r border-blue-900/40 shrink-0 h-screen overflow-y-auto shadow-2xl lg:shadow-none transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto">
          {/* Drawer Header with Title + Subtext + Close Button */}
          <div className="flex items-start justify-between mb-7">
            <div>
              <div className="flex items-center gap-2">
                <Logo size="full" variant="light" className="h-9" />
              </div>
              <p className="text-xs font-normal text-slate-400 tracking-normal mt-0.5">{t('engineerDashboard.subtitle')}</p>
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm tracking-normal transition cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-slate-300 hover:text-white hover:bg-white/5 font-normal'
              }`}
            >
              <svg className={`w-5 h-5 shrink-0 stroke-[1.75] ${currentTab === 'dashboard' ? 'text-white' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>{t('dashboard')}</span>
            </button>
            <button
              onClick={() => {
                setCurrentTab('tracks');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm tracking-normal transition cursor-pointer ${
                currentTab === 'tracks'
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-slate-300 hover:text-white hover:bg-white/5 font-normal'
              }`}
            >
              <svg className={`w-5 h-5 shrink-0 stroke-[1.75] ${currentTab === 'tracks' ? 'text-white' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>{t('myTracks')}</span>
            </button>
            <button
              onClick={() => {
                setCurrentTab('certificates');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm tracking-normal transition cursor-pointer ${
                currentTab === 'certificates'
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-slate-300 hover:text-white hover:bg-white/5 font-normal'
              }`}
            >
              <svg className={`w-5 h-5 shrink-0 stroke-[1.75] ${currentTab === 'certificates' ? 'text-white' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
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
                <div key={track._id} className="rounded-2xl bg-white/10 border border-white/20 p-3.5 shadow-xs">
                  <button
                    onClick={() => setExpandedTrack(expandedTrack === track._id ? '' : track._id)}
                    className="w-full text-left cursor-pointer group space-y-2"
                  >
                    {/* Top Row: Track Title + Expand Chevron */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold text-white tracking-tight leading-snug break-words flex-1">
                        {track.title}
                      </span>
                      <span className="p-1 rounded-lg bg-white/5 group-hover:bg-white/15 text-slate-300 group-hover:text-white transition shrink-0 mt-0.5">
                        <svg
                          className={`w-3.5 h-3.5 transform transition-transform duration-200 ${
                            expandedTrack === track._id ? 'rotate-180 text-white' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </div>

                    {/* Bottom Row: Progress Bar + Percentage Badge */}
                    <div className="flex items-center justify-between gap-2.5 pt-0.5">
                      <div className="flex-1 bg-black/20 h-1.5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all duration-500 shadow-xs"
                          style={{ width: `${Math.min(100, Math.max(0, track.progressPercent || 0))}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-medium text-slate-200 shrink-0 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
                        {track.progressPercent || 0}%
                      </span>
                    </div>
                  </button>

                  {/* Module List Accordion Content */}
                  {expandedTrack === track._id && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-white/10">
                      {track.modules && track.modules.length > 0 ? (
                        track.modules.map((m) => {
                          const isSelected = activeModule === m._id;
                          const thumb = m.thumbnail_url || (m.video_provider_id ? `https://videodelivery.net/${m.video_provider_id}/thumbnails/thumbnail.jpg` : null);

                          return (
                            <button
                              key={m._id}
                              onClick={() => {
                                handleModuleSelect(m._id);
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full p-2.5 rounded-xl text-left transition flex items-start gap-3 cursor-pointer ${
                                isSelected
                                  ? 'bg-white/25 ring-1 ring-white/40 shadow-xs'
                                  : 'hover:bg-white/10'
                              }`}
                            >
                              {/* Thumbnail Container with robust fallback */}
                              <div className="h-9 w-12 rounded-lg bg-slate-900 overflow-hidden shrink-0 border border-white/10 flex items-center justify-center relative mt-0.5 shadow-xs">
                                {thumb ? (
                                  <img
                                    src={resolveVideoUrl(thumb)}
                                    alt=""
                                    aria-hidden="true"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.parentElement?.querySelector('.thumb-fallback');
                                      if (fallback) {
                                        fallback.classList.remove('hidden');
                                        fallback.classList.add('flex');
                                      }
                                    }}
                                    className="w-full h-full object-cover"
                                  />
                                ) : null}
                                <div className={`thumb-fallback w-full h-full flex items-center justify-center bg-slate-800/90 text-blue-300 ${thumb ? 'hidden' : 'flex'}`}>
                                  <svg className="w-3.5 h-3.5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              </div>

                              {/* Title & Status */}
                              <div className="flex-1 min-w-0 space-y-1">
                                <p className="text-xs font-medium text-white leading-snug break-words line-clamp-2" title={m.title}>
                                  {m.title}
                                </p>
                                <div>
                                  {renderStatusBadge(m.effectiveStatus)}
                                </div>
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

        {/* Compact Enterprise Sidebar Footer */}
        <div className="pt-3.5 border-t border-white/10 mt-auto flex items-center justify-between gap-1.5">
          <button
            onClick={() => {
              setShowProfileModal(true);
              setMobileMenuOpen(false);
            }}
            className="flex-1 flex items-center gap-2.5 p-1.5 -ml-1 rounded-xl hover:bg-white/5 transition cursor-pointer text-left min-w-0 group"
            title={t('profile')}
          >
            <div className="h-8 w-8 rounded-lg bg-[#08306B] border border-blue-400/30 flex items-center justify-center font-medium text-white text-xs shadow-xs shrink-0 group-hover:border-white/50 transition">
              {(user?.fullName || 'E')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate group-hover:text-slate-200 transition">{user?.fullName || t('engineer')}</p>
              <p className="text-[11px] font-normal text-slate-400 truncate capitalize">{user?.role?.replace('_', ' ') || t('engineer')}</p>
            </div>
          </button>

          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer shrink-0"
            title={t('logout')}
            aria-label={t('logout')}
          >
            <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
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
              <span className="text-sm font-medium text-slate-700 hidden sm:inline truncate max-w-[120px]">
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
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {t('engineerDashboard.welcomeTitle', { name: user?.fullName || t('engineer') })}
                </h2>
                <p className="text-sm font-normal text-slate-500 max-w-lg mx-auto leading-relaxed">
                  {t('engineerDashboard.welcomeNoModules')}
                </p>
              </div>
            ) : (
              /* Active Video & Lesson Content */
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">
                      {activeLessonData.moduleTitle}
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-2">{activeLessonData.title}</h1>
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
                          download={att.filename || true}
                          target="_blank"
                          rel="noopener noreferrer"
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
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t('myLearningTracksPage')}</h1>
              <p className="text-sm font-normal text-slate-500 mt-1">{t('tracksPageSubtitle')}</p>
            </div>

            <div className="space-y-8">
              {enrichedTracks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
                  {t('engineerDashboard.noAssignedTracks')}
                </div>
              ) : (
                enrichedTracks.map((track) => {
                  const isTrackOpen = !collapsedTracks[track._id];

                  return (
                    <div key={track._id} className={`rounded-3xl border bg-white shadow-sm transition-all duration-300 ${track.isTrackLocked ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
                      {/* Track Header (Clickable toggle) */}
                      <div
                        onClick={() => toggleTrackCollapse(track._id)}
                        className="p-5 sm:p-7 transition cursor-pointer select-none"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                              <h2 className="text-xl font-bold text-slate-900">{track.title}</h2>
                              <span className="bg-[#08306B]/10 text-[#08306B] border border-[#08306B]/20 text-xs px-2.5 py-0.5 rounded-full font-semibold">{track.tier}</span>
                              {track.isTrackLocked && (
                                <span className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                  Complete EDGE first
                                </span>
                              )}
                            </div>
                            <p className="text-slate-500 text-sm">{track.description}</p>
                          </div>
                          <div className="flex items-center gap-3.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <div className="text-right">
                              <span className="text-2xl sm:text-3xl font-bold text-[#08306B]">{track.progressPercent}%</span>
                              <p className="text-xs text-slate-400 font-medium mt-0.5">{track.completedCount}/{track.totalModules} modules</p>
                            </div>
                            {!track.isTrackLocked && (
                              <button
                                onClick={() => handleContinueTrack(track)}
                                className="px-4 py-2.5 bg-[#08306B] hover:bg-[#062452] text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5 shrink-0"
                              >
                                <span>{track.progressPercent > 0 ? (track.progressPercent === 100 ? 'Review' : 'Continue') : 'Start'}</span>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                              </button>
                            )}
                            {/* Dropdown Toggle Button */}
                            <button
                              type="button"
                              onClick={() => toggleTrackCollapse(track._id)}
                              className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                              title={isTrackOpen ? 'Collapse modules' : 'Expand modules'}
                              aria-label={isTrackOpen ? 'Collapse modules' : 'Expand modules'}
                              aria-expanded={isTrackOpen}
                            >
                              <svg
                                className={`w-4 h-4 transform transition-transform duration-300 ${
                                  isTrackOpen ? 'rotate-180 text-[#08306B]' : 'rotate-0 text-slate-500'
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {/* Track progress bar */}
                        <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${track.progressPercent === 100 ? 'bg-emerald-500' : 'bg-[#08306B]'}`}
                            style={{ width: `${track.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Smooth Collapsible Module Rows Container */}
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${
                          isTrackOpen ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="p-4 sm:p-6 space-y-2">
                            {track.modules.map((m, idx) => {
                              const isCompleted = m.status === 'completed';
                              const thumb = m.thumbnail_url;
                              const score = m.best_quiz_score;

                              return (
                                <div
                                  key={m._id}
                                  className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 rounded-xl border transition gap-3 cursor-pointer ${
                                    isCompleted
                                      ? 'border-emerald-200 bg-white hover:border-emerald-300 hover:shadow-2xs'
                                      : 'border-slate-200 bg-white hover:border-[#08306B]/30 hover:shadow-2xs'
                                  }`}
                                  onClick={() => handleModuleSelect(m._id)}
                                >
                                  {/* Left: Thumbnail + Title & Description */}
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Compact Thumbnail Container */}
                                    <div className="relative w-16 sm:w-20 aspect-video rounded-lg bg-slate-900 overflow-hidden shrink-0 border border-slate-100 shadow-2xs">
                                      {thumb ? (
                                        <img
                                          src={resolveVideoUrl(thumb)}
                                          alt=""
                                          aria-hidden="true"
                                          className="w-full h-full object-cover transition group-hover:scale-105 duration-300"
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                                          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                        </div>
                                      )}
                                      {/* Module number badge */}
                                      <div className="absolute top-1 left-1">
                                        <span className="text-[8px] font-bold bg-black/75 text-white px-1 py-0.2 rounded backdrop-blur-xs">
                                          {String(idx + 1).padStart(2, '0')}
                                        </span>
                                      </div>
                                      {/* Completed check overlay */}
                                      {isCompleted && (
                                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-xs">
                                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                      )}
                                    </div>

                                    {/* Module Title & Description */}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-slate-900 text-xs sm:text-sm leading-snug truncate group-hover:text-[#08306B] transition">
                                        {m.title}
                                      </h4>
                                      {m.description ? (
                                        <p className="text-[11px] text-slate-500 line-clamp-1 font-normal mt-0.5">
                                          {m.description}
                                        </p>
                                      ) : (
                                        <p className="text-[11px] text-slate-400 italic font-normal mt-0.5">
                                          {t('noDescription') || 'No description provided'}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: Quiz Score Badge + Action Buttons */}
                                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-between sm:justify-end">
                                    {/* Quiz Score Badge */}
                                    {score !== null && score !== undefined ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs ${
                                          score >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}>
                                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                                          {score}% Quiz
                                        </span>
                                      </div>
                                    ) : null}

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1.5">
                                      {isCompleted && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); openQuizResult(m._id, m.title); }}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer shrink-0 shadow-2xs"
                                          title="View quiz results"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                          Results
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleModuleSelect(m._id); }}
                                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer shadow-2xs ${
                                          isCompleted
                                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            : 'bg-[#08306B] text-white hover:bg-[#062452]'
                                        }`}
                                      >
                                        {isCompleted ? t('review') : t('start')}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* QUIZ RESULT REVIEW MODAL */}
        {quizResultModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeQuizResult}>
            <div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-3 z-10">
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight line-clamp-2">{quizResultModal.moduleTitle}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Quiz Results — First Passing Attempt</p>
                </div>
                <button onClick={closeQuizResult} className="shrink-0 text-slate-400 hover:text-slate-700 transition cursor-pointer text-xl leading-none mt-0.5">&times;</button>
              </div>

              <div className="p-6 space-y-5">
                {quizResultLoading ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
                    <svg className="w-8 h-8 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    <span className="text-sm">Loading results…</span>
                  </div>
                ) : quizResultData?.error ? (
                  <div className="py-10 text-center text-red-600 text-sm">{quizResultData.error}</div>
                ) : quizResultData ? (
                  <>
                    {/* Score summary */}
                    <div className={`rounded-xl p-4 flex items-center gap-4 ${quizResultData.score_percent >= 80 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black shrink-0 ${quizResultData.score_percent >= 80 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                        {quizResultData.score_percent}%
                      </div>
                      <div>
                        <p className={`font-bold text-sm ${quizResultData.score_percent >= 80 ? 'text-emerald-800' : 'text-amber-800'}`}>
                          {quizResultData.score_percent >= 80 ? '✓ Passed' : 'Attempted'}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {quizResultData.correct_count} correct out of {quizResultData.total_questions} questions
                        </p>
                        {quizResultData.completed_at && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(quizResultData.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Question-by-question breakdown */}
                    <div className="space-y-3">
                      {(quizResultData.responses || []).map((r, i) => (
                        <div
                          key={i}
                          className={`rounded-xl border p-4 ${r.was_correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'}`}
                        >
                          <div className="flex items-start gap-2 mb-3">
                            <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${r.was_correct ? 'bg-emerald-500' : 'bg-red-500'}`}>
                              {r.was_correct
                                ? <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                : <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                              }
                            </div>
                            <p className="text-sm font-medium text-slate-900 leading-snug flex-1">
                              <span className="text-xs text-slate-400 mr-1.5 font-normal">Q{r.displayed_order}.</span>
                              {r.question_text}
                            </p>
                          </div>

                          {/* Options list */}
                          <div className="space-y-1.5 pl-7">
                            {(r.options || []).map((opt) => {
                              const isSelected = opt.key === r.selected_option;
                              const isCorrect = opt.key === r.correct_option;
                              return (
                                <div
                                  key={opt.key}
                                  className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs transition ${
                                    isCorrect
                                      ? 'bg-emerald-100 text-emerald-900 font-semibold'
                                      : isSelected && !isCorrect
                                      ? 'bg-red-100 text-red-900 font-semibold'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  <span className={`shrink-0 font-bold ${isCorrect ? 'text-emerald-700' : isSelected ? 'text-red-700' : 'text-slate-400'}`}>{opt.key}.</span>
                                  <span className="flex-1">{opt.text}</span>
                                  {isCorrect && <span className="text-emerald-600 text-[10px] font-bold shrink-0">✓ Correct</span>}
                                  {isSelected && !isCorrect && <span className="text-red-600 text-[10px] font-bold shrink-0">✗ Your answer</span>}
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation */}
                          {r.explanation && (
                            <div className="mt-3 pl-7">
                              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                <p className="text-xs font-semibold text-blue-700 mb-0.5">Explanation</p>
                                <p className="text-xs text-blue-900 leading-relaxed">{r.explanation}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* MY CERTIFICATES TAB VIEW */}
        {currentTab === 'certificates' && (
          <div className="flex-1 p-6 sm:p-10 lg:p-14 overflow-y-auto space-y-10 max-w-7xl mx-auto w-full">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t('myCertificatesPage')}</h1>
              <p className="text-sm font-normal text-slate-500 mt-1">{t('certificatesPageSubtitle')}</p>
            </div>

            {/* Public Verification Bar */}
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 sm:p-8 shadow-xs">
              <h3 className="text-base font-semibold text-[#08306B] mb-1">{t('publicVerification')}</h3>
              <p className="text-sm font-normal text-slate-600 mb-4">{t('publicVerificationDesc')}</p>
              <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <input
                  type="text"
                  placeholder={t('engineerDashboard.verifyPlaceholder')}
                  value={verifySearchId}
                  onChange={(e) => {
                    setVerifySearchId(e.target.value);
                    if (verifyResult) setVerifyResult(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-normal focus:outline-none focus:ring-1 focus:ring-[#08306B]"
                />
                <button
                  type="submit"
                  disabled={verifyLoading}
                  className="bg-[#08306B] hover:bg-[#062452] text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-xs transition cursor-pointer whitespace-nowrap"
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
                          <span className="text-xs font-medium font-mono bg-blue-50 text-[#08306B] border border-blue-200 px-3 py-1 rounded-full">
                            {cert.certificate_id}
                          </span>
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full capitalize">
                            {cert.status || t('common.active')}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900 mb-1.5">{cert.track_id?.title || cert.trackTitle || 'EDGE Certified Technician'}</h3>
                        <p className="text-xs font-normal text-slate-500 mb-3">
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
              const currentIndex = allModulesList.findIndex((m) => m._id === activeModule);
              fetchDashboardData().then(() => {
                if (currentIndex !== -1 && currentIndex < allModulesList.length - 1) {
                  const nextMod = allModulesList[currentIndex + 1];
                  handleModuleSelect(nextMod._id);
                }
              });
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
