const Track = require('../models/Track');
const Module = require('../models/Module');
const Assignment = require('../models/Assignment');
const Progress = require('../models/Progress');
const VideoProgress = require('../models/VideoProgress');
const QuizAttempt = require('../models/QuizAttempt');
const ConceptScore = require('../models/ConceptScore');
const ModuleAttachment = require('../models/ModuleAttachment');

// @desc    Get aggregated learner dashboard data (Strict Assigned Only)
// @route   GET /api/v1/me/dashboard
// @access  Private (Engineer)
const getLearnerDashboard = async (req, res) => {
  try {
    const engineer_id = req.user._id;

    // 1. Fetch all assignments and explicit track progress records for this engineer
    const assignments = await Assignment.find({
      $or: [{ engineer_id }, { userId: engineer_id }],
    });

    const progressRecords = await Progress.find({
      $or: [{ userId: engineer_id }, { user_id: engineer_id }],
    });

    const assignedModuleIds = assignments
      .map((a) => (a.module_id || a.moduleId)?.toString())
      .filter(Boolean);

    const progressCompletedModuleIds = progressRecords
      .flatMap((p) => (p.completedModules || []).map((m) => m.moduleId?.toString()))
      .filter(Boolean);

    const allRelevantModuleIds = [...new Set([...assignedModuleIds, ...progressCompletedModuleIds])];

    // Find the modules assigned to the user
    const assignedModules = await Module.find({
      _id: { $in: allRelevantModuleIds },
      deleted_at: null,
    }).select('_id title track_id trackId');

    const explicitTrackIds = progressRecords
      .map((p) => (p.trackId || p.track_id)?.toString())
      .filter(Boolean);

    const moduleTrackIds = assignedModules
      .map((m) => (m.track_id || m.trackId)?.toString())
      .filter(Boolean);

    const assignedTrackIds = [...new Set([...explicitTrackIds, ...moduleTrackIds])];

    // If no tracks or modules assigned to this engineer, return empty assigned tracks
    let enrolledTracks = [];

    if (assignedTrackIds.length > 0) {
      const tracks = await Track.find({
        _id: { $in: assignedTrackIds },
        deleted_at: null,
      })
        .populate({
          path: 'modules',
          match: { deleted_at: null },
        })
        .sort({ display_order: 1, created_at: 1 });

      const completedAssignments = assignments.filter((a) => a.status === 'completed');
      const completedModuleIds = [
        ...new Set([
          ...completedAssignments.map((a) => (a.module_id || a.moduleId)?.toString()),
          ...progressCompletedModuleIds,
        ]),
      ];

      enrolledTracks = tracks
        .map((track) => {
          const isExplicitTrackEnrollment = explicitTrackIds.includes(track._id.toString());
          const trackModules = (track.modules || []).filter((m) => {
            if (isExplicitTrackEnrollment) return true;
            return allRelevantModuleIds.includes(m._id.toString());
          });

          if (trackModules.length === 0) return null;

          const totalModules = trackModules.length;
          const completedCount = trackModules.filter((m) => completedModuleIds.includes(m._id.toString())).length;
          const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

          return {
            _id: track._id,
            title: track.title || track.name,
            code: track.code || track.slug,
            tier: track.tier || 'EDGE',
            description: track.description,
            totalModules,
            completedCount,
            progressPercent,
            modules: trackModules.map((m) => ({
              _id: m._id,
              title: m.title,
              thumbnail_url: m.thumbnail_url || m.thumbnailUrl || (m.video_provider_id && !m.video_provider_id.startsWith('/uploads/') && !m.video_provider_id.endsWith('.mp4') && !m.video_provider_id.endsWith('.webm') && !m.video_provider_id.startsWith('video_') ? `https://videodelivery.net/${m.video_provider_id}/thumbnails/thumbnail.jpg` : null),
              video_duration_sec: m.video_duration_sec || 0,
              estimated_minutes: m.estimated_minutes || m.estimated_duration_min || 0,
              status: completedModuleIds.includes(m._id.toString())
                ? 'completed'
                : assignments.some((a) => (a.module_id || a.moduleId)?.toString() === m._id.toString())
                ? 'in_progress'
                : 'available',
              // hasAssignment: true when an active Assignment exists for this engineer+module.
              // Used by the frontend to show unlock-badge and by the backend override check.
              hasAssignment: assignments.some(
                (a) => (a.module_id || a.moduleId)?.toString() === m._id.toString()
              ),
            })),
          };
        })
        .filter(Boolean);
    }

    // 2. Active / Next Assigned Module
    let activeAssignment = assignments.find((a) => a.status === 'in_progress' || a.status === 'pending');
    let activeModuleDoc = null;

    if (activeAssignment) {
      activeModuleDoc = await Module.findById(activeAssignment.module_id || activeAssignment.moduleId).populate(
        'trackId track_id',
        'title name code slug'
      );
    } else if (enrolledTracks.length > 0 && enrolledTracks[0].modules.length > 0) {
      const firstModId = enrolledTracks[0].modules[0]._id;
      activeModuleDoc = await Module.findById(firstModId).populate('trackId track_id', 'title name code slug');
    }

    let activeModule = null;
    if (activeModuleDoc && activeModuleDoc.deleted_at == null) {
      const attachments = await ModuleAttachment.find({
        $or: [{ module_id: activeModuleDoc._id }, { moduleId: activeModuleDoc._id }],
      });
      const videoProgress = await VideoProgress.findOne({
        $or: [{ engineer_id, module_id: activeModuleDoc._id }, { engineer_id, moduleId: activeModuleDoc._id }],
      });

      const EXPIRES_IN_SEC = 14400; // 4 hours
      const expiresAt = Math.floor(Date.now() / 1000) + EXPIRES_IN_SEC;
      let signed_video_url = null;

      if (activeModuleDoc.videoUrl) {
        signed_video_url = activeModuleDoc.videoUrl;
      } else if (activeModuleDoc.video_provider_id && (activeModuleDoc.video_provider_id.endsWith('.mp4') || activeModuleDoc.video_provider_id.startsWith('video_'))) {
        signed_video_url = `/uploads/videos/${activeModuleDoc.video_provider_id}`;
      } else if (activeModuleDoc.cloudflareVideoId || (activeModuleDoc.video_provider_id && !activeModuleDoc.video_provider_id.startsWith('cf_stream_'))) {
        const providerId = activeModuleDoc.cloudflareVideoId || activeModuleDoc.video_provider_id;
        signed_video_url = `https://iframe.videodelivery.net/${providerId}?exp=${expiresAt}&token=signed_tnx_${expiresAt}`;
      }

      const chapters = (Array.isArray(activeModuleDoc.chapters) && activeModuleDoc.chapters.length > 0)
        ? activeModuleDoc.chapters
        : [];

      activeModule = {
        _id: activeModuleDoc._id,
        title: activeModuleDoc.title,
        moduleTitle: (activeModuleDoc.trackId?.title || activeModuleDoc.track_id?.name || activeModuleDoc.title),
        description: activeModuleDoc.description,
        tier: activeModuleDoc.tier,
        estimated_minutes: activeModuleDoc.estimated_minutes || 0,
        video_duration_sec: activeModuleDoc.video_duration_sec || 0,
        duration_sec: activeModuleDoc.video_duration_sec || 0,
        duration: activeModuleDoc.video_duration_sec
          ? `${Math.round(activeModuleDoc.video_duration_sec / 60)} mins`
          : `${activeModuleDoc.estimated_minutes || 0} mins`,
        thumbnail_url: activeModuleDoc.thumbnail_url || activeModuleDoc.thumbnailUrl || (activeModuleDoc.video_provider_id && !activeModuleDoc.video_provider_id.startsWith('/uploads/') && !activeModuleDoc.video_provider_id.endsWith('.mp4') && !activeModuleDoc.video_provider_id.endsWith('.webm') && !activeModuleDoc.video_provider_id.startsWith('video_') ? `https://videodelivery.net/${activeModuleDoc.video_provider_id}/thumbnails/thumbnail.jpg` : null),
        streamUrl: signed_video_url || '',
        signed_video_url,
        attachments: attachments || [],
        chapters,
        percent_watched: videoProgress ? videoProgress.percent_watched : 0,
        position_sec: videoProgress ? videoProgress.position_sec : 0,
        completed: videoProgress ? videoProgress.completed : false,
      };
    }


    // 3. Weak Concepts (Top 5 lowest accuracy concept tags)
    const conceptScores = await ConceptScore.find({
      $or: [{ engineer_id }, { userId: engineer_id }],
    }).sort({ accuracy: 1 }).limit(5);

    const weakConcepts = conceptScores.map((cs) => ({
      concept_tag: cs.concept_tag,
      accuracy_percent: Math.round((cs.accuracy || 0) * 100),
      total_count: cs.total_count,
    }));

    // 4. Weekly Review Quiz Status (Spaced repetition review)
    const recentReviewAttempt = await QuizAttempt.findOne({
      $or: [{ engineer_id }, { userId: engineer_id }],
      quiz_type: 'review',
    }).sort({ created_at: -1 });

    const reviewEligible = weakConcepts.length > 0;
    const reviewQuizStatus = {
      is_eligible: reviewEligible,
      reason: reviewEligible ? 'Weak concepts identified for repetition' : 'No weak concepts identified',
      last_attempt_at: recentReviewAttempt ? recentReviewAttempt.created_at : null,
    };

    res.json({
      enrolledTracks,
      activeModule,
      weakConcepts,
      reviewQuizStatus,
    });
  } catch (error) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

module.exports = {
  getLearnerDashboard,
};

