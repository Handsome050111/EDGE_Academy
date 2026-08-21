import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import Pagination from '../../../components/Pagination';

const resolveAssetUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '') : '';
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const formatExactDuration = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return 'Not calculated yet';
  const mins = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${mins}m ${remainder}s (${seconds}s)`;
};

const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const ModuleCatalogTab = ({ showNotification }) => {
  const { t } = useTranslation();

  // Core Data States
  const [tracks, setTracks] = useState([]);
  const [modules, setModules] = useState([]);
  const [selectedTrackFilter, setSelectedTrackFilter] = useState('all');
  const [selectedModule, setSelectedModule] = useState(null);
  const [moduleQuestions, setModuleQuestions] = useState([]);
  const [moduleAttachments, setModuleAttachments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Pagination State (8 modules per page)
  const [catalogPage, setCatalogPage] = useState(1);
  const MODULES_PER_PAGE = 8;

  // Track Modal State
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [trackFormData, setTrackFormData] = useState({
    name: '',
    slug: '',
    description: '',
    tier: 'EDGE',
    is_published: true,
    display_order: 0,
  });

  // Module Form State
  const [moduleFormData, setModuleFormData] = useState({
    trackId: '',
    title: '',
    description: '',
    passingScorePercentage: '80',
    thumbnail_url: '',
  });

  // Media & Attachment Upload States
  const [videoFile, setVideoFile] = useState(null);
  const [detectedDurationSec, setDetectedDurationSec] = useState(null);
  const [cloudflareVideoId, setCloudflareVideoId] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Delete Confirm Modal State
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: '', // 'track' | 'module'
    item: null,
  });

  // Centralized reset for file-picker and media upload state
  const resetModuleMediaState = () => {
    setVideoFile(null);
    setDetectedDurationSec(null);
    setCloudflareVideoId('');
    setThumbnailFile(null);
    setThumbnailPreview('');
    setAttachmentFile(null);
  };

  useEffect(() => {
    loadTracksAndModules();
  }, []);

  // Handle ESC key press to close modals cleanly
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isEditModalOpen) {
          handleCloseModal();
        }
        if (showTrackModal) {
          setShowTrackModal(false);
        }
        if (deleteModal.isOpen) {
          setDeleteModal({ isOpen: false, type: '', item: null });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, showTrackModal, deleteModal.isOpen]);

  const loadTracksAndModules = async () => {
    setLoading(true);
    try {
      const [tracksRes, modulesRes] = await Promise.all([
        api.get('/tracks'),
        api.get('/modules'),
      ]);
      setTracks(tracksRes.data || []);
      setModules(modulesRes.data || []);
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to load curriculum');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Modules by Track
  const filteredModules = useMemo(() => {
    if (selectedTrackFilter === 'all') return modules;
    return modules.filter((m) => {
      const tId = (m.track_id?._id || m.track_id || m.trackId?._id || m.trackId)?.toString();
      return tId === selectedTrackFilter.toString();
    });
  }, [modules, selectedTrackFilter]);

  // Reset module page when filter changes
  useEffect(() => {
    setCatalogPage(1);
  }, [selectedTrackFilter]);

  // Paginated Modules
  const paginatedModules = useMemo(() => {
    const start = (catalogPage - 1) * MODULES_PER_PAGE;
    return filteredModules.slice(start, start + MODULES_PER_PAGE);
  }, [filteredModules, catalogPage]);

  // Load detailed information for selected working module
  const loadModuleDetails = async (modId) => {
    if (!modId) return;
    try {
      const modRes = await api.get(`/modules/${modId}`);
      const mod = modRes.data;
      setSelectedModule(mod);

      setModuleFormData({
        trackId: mod.track_id?._id || mod.track_id || mod.trackId?._id || mod.trackId || '',
        title: mod.title || '',
        description: mod.description || '',
        passingScorePercentage: String(mod.pass_threshold || mod.passingScorePercentage || '80'),
        thumbnail_url: mod.thumbnail_url || mod.thumbnailUrl || '',
      });

      resetModuleMediaState();
      setCloudflareVideoId(mod.video_provider_id && !mod.video_provider_id.startsWith('video_') ? mod.video_provider_id : '');

      // Load questions for publish guard
      try {
        const qRes = await api.get(`/admin/modules/${modId}/questions`);
        setModuleQuestions(qRes.data || []);
      } catch {
        setModuleQuestions([]);
      }

      // Load attachments
      try {
        const attRes = await api.get(`/admin/modules/${modId}/attachments`);
        setModuleAttachments(attRes.data || []);
      } catch {
        setModuleAttachments(mod.attachments || []);
      }
    } catch (err) {
      showNotification('error', 'Failed to load module details');
    }
  };

  // Open Create Module Dialog
  const handleOpenCreateModule = () => {
    setSelectedModule(null);
    resetModuleMediaState();
    setModuleFormData({
      trackId: selectedTrackFilter !== 'all' ? selectedTrackFilter : (tracks[0]?._id || ''),
      title: '',
      description: '',
      passingScorePercentage: '80',
      thumbnail_url: '',
    });
    setModuleQuestions([]);
    setModuleAttachments([]);
    setIsEditModalOpen(true);
  };

  // Open Edit Module Dialog
  const handleOpenEditModule = async (modId) => {
    await loadModuleDetails(modId);
    setIsEditModalOpen(true);
  };

  // Close Module Dialog
  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedModule(null);
    resetModuleMediaState();
    setModuleFormData({
      trackId: '',
      title: '',
      description: '',
      passingScorePercentage: '80',
      thumbnail_url: '',
    });
    setModuleQuestions([]);
    setModuleAttachments([]);
  };

  // Track CRUD Handlers
  const handleOpenCreateTrack = () => {
    setEditingTrack(null);
    setTrackFormData({
      name: '',
      slug: '',
      description: '',
      tier: 'EDGE',
      is_published: true,
      display_order: tracks.length + 1,
    });
    setShowTrackModal(true);
  };

  const handleOpenEditTrack = (track, e) => {
    if (e) e.stopPropagation();
    setEditingTrack(track);
    setTrackFormData({
      name: track.name || track.title || '',
      slug: track.slug || '',
      description: track.description || '',
      tier: track.tier || 'EDGE',
      is_published: track.is_published !== undefined ? track.is_published : true,
      display_order: track.display_order || 0,
    });
    setShowTrackModal(true);
  };

  const handleSaveTrack = async (e) => {
    e.preventDefault();
    if (!trackFormData.name.trim()) {
      showNotification('error', 'Track name is required');
      return;
    }

    setUploadLoading(true);
    try {
      const payload = {
        name: trackFormData.name.trim(),
        slug: trackFormData.slug.trim() || trackFormData.name.trim().replace(/[^a-zA-Z0-9]/g, '-').toUpperCase(),
        description: trackFormData.description.trim(),
        tier: trackFormData.tier,
        is_published: trackFormData.is_published,
        display_order: Number(trackFormData.display_order) || 0,
      };

      if (editingTrack?._id) {
        const res = await api.put(`/tracks/${editingTrack._id}`, payload);
        setTracks((prev) => prev.map((t) => (t._id === res.data._id ? res.data : t)));
        showNotification('success', `Track '${res.data.name}' updated successfully!`);
      } else {
        const res = await api.post('/tracks', payload);
        setTracks((prev) => [...prev, res.data]);
        setSelectedTrackFilter(res.data._id);
        setModuleFormData((prev) => ({ ...prev, trackId: res.data._id }));
        showNotification('success', `Track '${res.data.name}' created successfully!`);
      }
      setShowTrackModal(false);
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to save track');
    } finally {
      setUploadLoading(false);
    }
  };

  // Module CRUD Handlers
  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!moduleFormData.trackId || !moduleFormData.title.trim()) {
      showNotification('error', 'Parent track and module title are required.');
      return;
    }

    setUploadLoading(true);
    try {
      const payload = {
        trackId: moduleFormData.trackId,
        title: moduleFormData.title.trim(),
        description: moduleFormData.description.trim(),
        passingScorePercentage: Number(moduleFormData.passingScorePercentage),
        thumbnail_url: moduleFormData.thumbnail_url.trim() || null,
      };

      if (selectedModule?._id) {
        const res = await api.put(`/modules/${selectedModule._id}`, payload);
        const updated = res.data;
        setModules((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
        showNotification('success', `Module '${updated.title}' updated successfully!`);
        await loadTracksAndModules();
        handleCloseModal();
      } else {
        payload.isPublished = false;
        payload.status = 'draft';
        const res = await api.post('/modules', payload);
        const created = res.data;
        setModules((prev) => [...prev, created]);
        showNotification('success', `Module '${created.title}' created successfully!`);
        await loadTracksAndModules();
        handleCloseModal();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to save module');
    } finally {
      setUploadLoading(false);
    }
  };

  // Handle Video File Selection with Browser Duration Inspection
  const handleVideoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setDetectedDurationSec(null);

    try {
      const videoElem = document.createElement('video');
      videoElem.preload = 'metadata';
      videoElem.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoElem.src);
        if (videoElem.duration && !isNaN(videoElem.duration) && videoElem.duration > 0) {
          const exactSec = Math.round(videoElem.duration);
          setDetectedDurationSec(exactSec);
        }
      };
      videoElem.src = URL.createObjectURL(file);
    } catch (err) {
      console.warn('Browser video metadata inspection warning:', err);
    }
  };

  // Video Upload Handler
  const handleUploadVideo = async () => {
    if (!selectedModule?._id) {
      showNotification('error', 'Please select or create a module first.');
      return;
    }

    if (!videoFile && !cloudflareVideoId.trim()) {
      showNotification('error', 'Please select a video file or enter a Cloudflare Stream ID.');
      return;
    }

    setUploadLoading(true);
    try {
      let res;
      if (videoFile) {
        const form = new FormData();
        form.append('video', videoFile);
        if (detectedDurationSec) {
          form.append('video_duration_sec', detectedDurationSec);
        }
        res = await api.post(`/admin/modules/${selectedModule._id}/video`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post(`/admin/modules/${selectedModule._id}/video`, {
          video_provider_id: cloudflareVideoId.trim(),
        });
      }

      const updatedMod = res.data.module || res.data;
      setModules((prev) => prev.map((m) => (m._id === selectedModule._id ? updatedMod : m)));
      showNotification('success', `Video attached successfully! Duration: ${formatExactDuration(updatedMod.video_duration_sec || updatedMod.duration_sec)}`);
      await loadTracksAndModules();
      handleCloseModal();
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Video upload failed');
    } finally {
      setUploadLoading(false);
    }
  };

  // Handle Thumbnail File Selection
  const handleThumbnailFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  // Upload Custom Thumbnail from PC
  const handleUploadThumbnail = async () => {
    if (!selectedModule?._id) {
      showNotification('error', 'Please select or create a module first.');
      return;
    }
    if (!thumbnailFile) {
      showNotification('error', 'Please select an image file (PNG, JPG, WEBP).');
      return;
    }

    setUploadLoading(true);
    try {
      const form = new FormData();
      form.append('thumbnail', thumbnailFile);
      const res = await api.post(`/admin/modules/${selectedModule._id}/thumbnail`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updatedMod = res.data.module || res.data;
      setModules((prev) => prev.map((m) => (m._id === selectedModule._id ? updatedMod : m)));
      showNotification('success', 'Custom thumbnail image uploaded successfully!');
      await loadTracksAndModules();
      handleCloseModal();
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Thumbnail upload failed');
    } finally {
      setUploadLoading(false);
    }
  };

  // Attachment Upload Handler
  const handleUploadAttachment = async () => {
    if (!selectedModule?._id) {
      showNotification('error', 'Please select or create a module first.');
      return;
    }
    if (!attachmentFile) {
      showNotification('error', 'Please select a document file (PDF/DOCX/Images).');
      return;
    }

    setUploadLoading(true);
    try {
      const form = new FormData();
      form.append('attachment', attachmentFile);
      const res = await api.post(`/admin/modules/${selectedModule._id}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification('success', `Attachment '${res.data.attachment?.filename || 'Document'}' uploaded!`);
      setModuleAttachments((prev) => [res.data.attachment, ...prev]);
      setAttachmentFile(null);
      await loadTracksAndModules();
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Attachment upload failed');
    } finally {
      setUploadLoading(false);
    }
  };

  // Delete Attachment Handler
  const handleDeleteAttachment = async (attachmentId) => {
    if (!selectedModule?._id || !attachmentId) return;
    if (!window.confirm('Are you sure you want to delete this supporting document?')) return;

    setUploadLoading(true);
    try {
      await api.delete(`/admin/modules/${selectedModule._id}/attachments/${attachmentId}`);
      setModuleAttachments((prev) => prev.filter((a) => (a._id || a.id) !== attachmentId));
      showNotification('success', 'Attachment deleted successfully.');
      await loadTracksAndModules();
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to delete attachment');
    } finally {
      setUploadLoading(false);
    }
  };

  // Publish Module Guard Trigger
  const handlePublishModule = async () => {
    if (!selectedModule?._id) return;
    setUploadLoading(true);
    try {
      const res = await api.post(`/admin/modules/${selectedModule._id}/publish`);
      const publishedMod = res.data.module || res.data;
      setSelectedModule(publishedMod);
      setModules((prev) => prev.map((m) => (m._id === selectedModule._id ? publishedMod : m)));
      showNotification('success', 'Module published successfully and is now active for learners.');
      await loadTracksAndModules();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Publish guard rejected request';
      showNotification('error', msg);
    } finally {
      setUploadLoading(false);
    }
  };

  // Delete Handlers
  const handleConfirmDelete = async () => {
    const { type, item } = deleteModal;
    if (!item?._id) return;
    setUploadLoading(true);
    try {
      if (type === 'track') {
        await api.delete(`/tracks/${item._id}`);
        setTracks((prev) => prev.filter((t) => t._id !== item._id));
        setModules((prev) => prev.filter((m) => {
          const tId = (m.track_id?._id || m.track_id || m.trackId)?.toString();
          return tId !== item._id.toString();
        }));
        if (selectedTrackFilter.toString() === item._id.toString()) {
          setSelectedTrackFilter('all');
        }
        showNotification('success', `Track '${item.name}' deleted successfully.`);
      } else {
        await api.delete(`/modules/${item._id}`);
        setModules((prev) => prev.filter((m) => m._id !== item._id));
        if (selectedModule?._id === item._id) {
          handleCloseModal();
        }
        showNotification('success', `Module '${item.title}' deleted successfully.`);
      }
      setDeleteModal({ isOpen: false, type: '', item: null });
    } catch (err) {
      showNotification('error', err.response?.data?.message || err.message || 'Failed to delete item');
    } finally {
      setUploadLoading(false);
    }
  };

  const hasVideo = Boolean(selectedModule?.video_provider_id || selectedModule?.videoUrl);
  const activeQuestionCount = moduleQuestions.filter((q) => q.is_active !== false && !q.deleted_at).length;
  const canPublish = hasVideo && activeQuestionCount >= 5 && selectedModule?.status !== 'published';

  const currentThumbnail = thumbnailPreview || (selectedModule?.thumbnail_url ? resolveAssetUrl(selectedModule.thumbnail_url) : '');

  return (
    <div className="space-y-6">
      {/* Header with Track Filter & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Module & Curriculum CMS</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage learning tracks, instructional modules, custom video thumbnails, and study documents</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreateTrack}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Track
          </button>

          <button
            onClick={handleOpenCreateModule}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#08306B] text-white hover:bg-[#0a3d87] shadow-xs transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            New Module
          </button>
        </div>
      </div>

      {/* Tracks & Modules Browser Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <span className="text-xs font-bold text-slate-500 shrink-0">Filter by Track:</span>
          <button
            onClick={() => setSelectedTrackFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              selectedTrackFilter === 'all'
                ? 'bg-[#08306B] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Tracks ({modules.length})
          </button>
          {tracks.map((tr) => {
            const count = modules.filter((m) => {
              const tId = (m.track_id?._id || m.track_id || m.trackId?._id || m.trackId)?.toString();
              return tId === tr._id.toString();
            }).length;
            const isSelected = selectedTrackFilter === tr._id;

            return (
              <div
                key={tr._id}
                className={`inline-flex items-center rounded-xl border transition text-xs font-bold shrink-0 ${
                  isSelected
                    ? 'bg-[#08306B] text-white border-[#08306B] shadow-xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedTrackFilter(tr._id)}
                  className="px-3 py-1.5 text-left cursor-pointer focus:outline-none"
                >
                  {tr.name} ({count})
                </button>

                <div className="flex items-center gap-1 pr-2 pl-1 border-l border-black/10">
                  <button
                    type="button"
                    onClick={(e) => handleOpenEditTrack(tr, e)}
                    title="Edit Track Details"
                    className={`p-1 rounded transition cursor-pointer ${
                      isSelected
                        ? 'text-blue-100 hover:text-white hover:bg-white/20'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-300/60'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteModal({ isOpen: true, type: 'track', item: tr });
                    }}
                    title="Delete Track"
                    className={`p-1 rounded transition cursor-pointer ${
                      isSelected
                        ? 'text-rose-200 hover:text-rose-100 hover:bg-rose-500/30'
                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Showing {filteredModules.length} module{filteredModules.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Modules Table List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#08306B] border-t-transparent mx-auto" />
            <p className="text-xs text-slate-500 mt-2 font-medium">Loading curriculum catalog...</p>
          </div>
        ) : filteredModules.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">No modules found</p>
            <p className="text-xs text-slate-500">Create your first module or select a different track filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Module Title</th>
                  <th className="px-4 py-3.5">Parent Track</th>
                  <th className="px-4 py-3.5">Tier</th>
                  <th className="px-4 py-3.5">Duration</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedModules.map((m) => {
                  const parentTrack = tracks.find((t) => {
                    const tId = (m.track_id?._id || m.track_id || m.trackId?._id || m.trackId)?.toString();
                    return t._id.toString() === tId;
                  });
                  const isSelected = selectedModule?._id === m._id;
                  const isPublished = m.status === 'published' || m.is_published === true;
                  const durationSec = m.video_duration_sec || m.duration_sec || (m.estimated_minutes ? m.estimated_minutes * 60 : 0);

                  return (
                    <tr
                      key={m._id}
                      onClick={() => handleOpenEditModule(m._id)}
                      className={`cursor-pointer transition ${
                        isSelected ? 'bg-blue-50/70 font-semibold text-[#08306B]' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-blue-50 text-[#08306B] border border-blue-200 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {m.thumbnail_url ? (
                              <img src={resolveAssetUrl(m.thumbnail_url)} alt="thumb" className="w-full h-full object-cover" />
                            ) : (
                              (m.title || 'M')[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{m.title}</p>
                            <p className="text-[11px] text-slate-500 line-clamp-1">{m.description || 'No description'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-600">
                        {parentTrack?.name || m.track_id?.name || 'General Track'}
                      </td>

                      <td className="px-4 py-3.5">
                        {parentTrack ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              parentTrack.tier === 'EDGE'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-[#08306B] border border-blue-200'
                            }`}
                          >
                            {parentTrack.tier || '—'}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>

                      <td className="px-4 py-3.5 text-slate-600">
                        {durationSec > 0 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : 'Self-paced'}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isPublished
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEditModule(m._id)}
                            className="p-1.5 text-slate-500 hover:text-[#08306B] hover:bg-slate-100 rounded-lg transition"
                            title="Edit Module"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteModal({ isOpen: true, type: 'module', item: m })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Module"
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

        {/* Pagination Bar */}
        {!loading && filteredModules.length > 0 && (
          <div className="p-4 border-t border-slate-100">
            <Pagination
              currentPage={catalogPage}
              totalItems={filteredModules.length}
              pageSize={MODULES_PER_PAGE}
              onPageChange={setCatalogPage}
              itemLabel="modules"
            />
          </div>
        )}
      </div>

      {/* Module Editor Modal Dialog (Popup) */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={handleCloseModal}
        >
          <div
            className="max-w-5xl w-full max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  {selectedModule ? `Editing: ${selectedModule.title}` : 'Create New Module'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure module details, instructional video, custom thumbnail poster, and study documents
                </p>
              </div>

              <div className="flex items-center gap-3">
                {selectedModule && (
                  <div className="flex items-center gap-2.5">
                    {/* Quality Guard Status */}
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quality Guard</p>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className={hasVideo ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                          {hasVideo ? '✓ Video' : 'No Video'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className={activeQuestionCount >= 5 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                          {`${activeQuestionCount}/5 Questions`}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handlePublishModule}
                      disabled={!canPublish || uploadLoading}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        canPublish ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-200 text-slate-500'
                      }`}
                      title={canPublish ? 'Publish Module to Learners' : 'Requires video and at least 5 MCQs in Question Bank'}
                    >
                      {uploadLoading ? 'Publishing...' : 'Publish Module'}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl p-1.5 transition cursor-pointer"
                  aria-label="Close dialog"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Metadata Form */}
              <form id="module-edit-form" onSubmit={handleSaveModule} className="space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Track *</label>
                    <select
                      required
                      value={moduleFormData.trackId}
                      onChange={(e) => setModuleFormData((prev) => ({ ...prev, trackId: e.target.value }))}
                      className="w-full truncate px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none bg-white font-medium"
                    >
                      <option value="" className="truncate">-- Select Track --</option>
                      {tracks.map((t) => (
                        <option key={t._id} value={t._id} className="truncate">{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Module Title *</label>
                    <input
                      type="text"
                      required
                      value={moduleFormData.title}
                      onChange={(e) => setModuleFormData((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g. M1: Cable Types & Connectors"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none bg-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Threshold (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={moduleFormData.passingScorePercentage}
                      onChange={(e) => setModuleFormData((prev) => ({ ...prev, passingScorePercentage: e.target.value }))}
                      placeholder="80"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Learning Objectives</label>
                  <textarea
                    rows={2}
                    value={moduleFormData.description}
                    onChange={(e) => setModuleFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Outline what engineers will master in this module..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none resize-none bg-white"
                  />
                </div>
              </form>

              {/* Media & Attachments 3-Column Grid */}
              {selectedModule ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#08306B]"></span>
                      Module Assets & Media
                    </h4>
                    <span className="text-[11px] text-slate-400">Manage video, thumbnail poster, and supplementary files</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 1. Instructional Video Manager */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          1. Instructional Video Content
                        </h5>

                        {selectedModule.videoUrl || selectedModule.video_provider_id ? (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                            <p className="font-semibold text-emerald-800 flex items-center gap-1">
                              ✓ Video attached: <span className="font-normal text-slate-600 truncate">{selectedModule.video_provider_id || selectedModule.videoUrl}</span>
                            </p>
                            <p className="text-[11px] text-slate-700 font-medium">
                              Exact Duration: <strong className="text-slate-900">{formatExactDuration(selectedModule.video_duration_sec || selectedModule.duration_sec)}</strong>
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                            No video attached yet. Upload a local MP4/WebM or enter a Cloudflare Stream ID below.
                          </p>
                        )}

                        <div className="space-y-2 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Option A: Upload MP4 / WebM File</label>
                            <input
                              type="file"
                              accept="video/mp4,video/webm"
                              onChange={handleVideoFileChange}
                              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#08306B] file:text-white hover:file:bg-[#0a3d87] cursor-pointer"
                            />
                            {detectedDurationSec && (
                              <p className="text-[11px] text-emerald-700 font-bold mt-1">
                                Detected Duration: {formatExactDuration(detectedDurationSec)}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Option B: Cloudflare Stream Video UID</label>
                            <input
                              type="text"
                              value={cloudflareVideoId}
                              onChange={(e) => setCloudflareVideoId(e.target.value)}
                              placeholder="e.g. 5d537f14a468d955f654da5de0f8bc41"
                              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:border-[#08306B] outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleUploadVideo}
                        disabled={uploadLoading || (!videoFile && !cloudflareVideoId.trim())}
                        className="w-full py-2 mt-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 transition cursor-pointer disabled:opacity-50"
                      >
                        {uploadLoading ? 'Attaching Video...' : 'Attach Video to Module'}
                      </button>
                    </div>

                    {/* 2. Custom Thumbnail Manager */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          2. Custom Thumbnail Poster
                        </h5>

                        {/* Thumbnail Preview Area */}
                        <div className="aspect-video w-full rounded-xl bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center relative">
                          {currentThumbnail ? (
                            <img
                              src={currentThumbnail}
                              alt="Thumbnail Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center text-slate-400 p-4">
                              <svg className="w-8 h-8 mx-auto mb-1 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-[11px]">No custom thumbnail uploaded</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Image (PNG, JPG, WEBP)</label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleThumbnailFileChange}
                            className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#08306B] file:text-white hover:file:bg-[#0a3d87] cursor-pointer"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleUploadThumbnail}
                        disabled={!thumbnailFile || uploadLoading}
                        className="w-full py-2 mt-2 rounded-xl text-xs font-semibold bg-[#08306B] text-white hover:bg-[#0a3d87] transition cursor-pointer disabled:opacity-50"
                      >
                        {uploadLoading ? 'Uploading Thumbnail...' : 'Upload Thumbnail Image'}
                      </button>
                    </div>

                    {/* 3. Document Attachments Manager */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          3. Supplementary Study Documents
                        </h5>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Upload PDF / DOCX / Diagram</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept=".pdf,.docx,.doc,image/*"
                              onChange={(e) => setAttachmentFile(e.target.files[0])}
                              className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-800 cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={handleUploadAttachment}
                              disabled={!attachmentFile || uploadLoading}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#08306B] text-white hover:bg-[#0a3d87] transition cursor-pointer disabled:opacity-40 shrink-0"
                            >
                              Upload
                            </button>
                          </div>
                        </div>

                        <div className="pt-1">
                          <p className="text-[11px] font-bold text-slate-700 mb-2">
                            Attached Files ({moduleAttachments.length}):
                          </p>
                          {moduleAttachments.length === 0 ? (
                            <p className="text-xs text-slate-400 italic p-3 bg-white rounded-xl border border-slate-200 text-center">
                              No supporting documents attached yet.
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                              {moduleAttachments.map((att) => {
                                const fileUrl = resolveAssetUrl(att.storage_path || att.file_url);
                                return (
                                  <div
                                    key={att._id || att.id}
                                    className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition text-xs gap-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="h-7 w-7 rounded-lg bg-blue-50 text-[#08306B] flex items-center justify-center font-bold text-[10px] shrink-0">
                                        DOC
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-semibold text-slate-900 truncate">{att.filename || 'Document'}</p>
                                        <p className="text-[10px] text-slate-400">{formatFileSize(att.file_size_bytes)}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {fileUrl && (
                                        <a
                                          href={fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          download
                                          className="text-[#08306B] hover:underline font-bold text-[11px] px-2 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                        >
                                          Download
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteAttachment(att._id || att.id)}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                        title="Delete Attachment"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#08306B] flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#08306B] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Save basic module details first to enable video attachment, custom thumbnails, and document uploads.</span>
                </div>
              )}
            </div>

            {/* Sticky Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 shadow-xs">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="module-edit-form"
                disabled={uploadLoading}
                className="px-5 py-2.5 text-xs font-bold bg-[#08306B] text-white hover:bg-[#0a3d87] rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {uploadLoading ? 'Saving...' : selectedModule ? 'Update Module Details' : 'Create Module'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track Create/Edit Modal */}
      {showTrackModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowTrackModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingTrack ? 'Edit Learning Track' : 'Create Learning Track'}
              </h3>
              <button
                onClick={() => setShowTrackModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveTrack} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Track Name *</label>
                <input
                  type="text"
                  required
                  value={trackFormData.name}
                  onChange={(e) => setTrackFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. EDGE Certified Technician"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Track Slug / Certificate Code *</label>
                <input
                  type="text"
                  value={trackFormData.slug}
                  onChange={(e) => setTrackFormData((prev) => ({ ...prev, slug: e.target.value.toUpperCase() }))}
                  placeholder="e.g. EDGE-L1"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Track Description</label>
                <textarea
                  rows={3}
                  value={trackFormData.description}
                  onChange={(e) => setTrackFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Overview of this certification pathway..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Curriculum Tier *</label>
                <select
                  value={trackFormData.tier}
                  onChange={(e) => setTrackFormData((prev) => ({ ...prev, tier: e.target.value }))}
                  className="w-full truncate px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#08306B] focus:ring-1 focus:ring-[#08306B] outline-none bg-white font-medium"
                >
                  <option value="EDGE" className="truncate">EDGE — Level 1 (Certified Technician)</option>
                  <option value="CORE" className="truncate">CORE — Level 2 (Certified Engineer)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTrackModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="px-4 py-2 text-xs font-semibold bg-[#08306B] text-white hover:bg-[#0a3d87] rounded-xl shadow-xs transition cursor-pointer"
                >
                  {uploadLoading ? 'Saving...' : 'Save Track'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteModal({ isOpen: false, type: '', item: null })}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-slate-900">
              Delete {deleteModal.type === 'track' ? 'Learning Track' : 'Training Module'}?
            </h4>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete <strong className="text-slate-800">{deleteModal.item?.name || deleteModal.item?.title}</strong>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, type: '', item: null })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={uploadLoading}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                {uploadLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleCatalogTab;
