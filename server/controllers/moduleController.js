const Module = require('../models/Module');
const Track = require('../models/Track');
const Question = require('../models/Question');
const ModuleAttachment = require('../models/ModuleAttachment');
const ModulePrerequisite = require('../models/ModulePrerequisite');
const AuditLog = require('../models/AuditLog');
const { getClientIp } = require('../utils/audit');

// @desc    Create a new module and link to Track
// @route   POST /api/modules
// @access  Private/Admin/SuperAdmin/TeamLead
const createModule = async (req, res) => {
  try {
    const {
      track_id,
      trackId,
      title,
      slug,
      description,
      // tier removed — tier is now a Track-level property, not Module-level
      estimatedDurationMinutes,
      estimated_duration_min,
      video_url,
      videoUrl,
      cloudflareVideoId,
      video_provider_id,
      thumbnail_url,
      thumbnailUrl,
      attachments,
      pass_threshold,
      passingScorePercentage,
      quiz_question_count,
      is_published,
      isPublished,
      status,
    } = req.body;

    const parentTrackId = track_id || trackId;

    // 1. Verify that parent track exists
    const track = await Track.findById(parentTrackId);
    if (!track) {
      return res.status(404).json({ error: { code: 'TRACK_NOT_FOUND', message: 'Parent Track not found' } });
    }

    const providerId = video_provider_id || cloudflareVideoId || video_url || videoUrl || null;
    let thumbUrl = thumbnail_url || thumbnailUrl || null;
    if (!thumbUrl && providerId && !providerId.startsWith('/uploads/') && !providerId.endsWith('.mp4') && !providerId.endsWith('.webm') && !providerId.startsWith('video_')) {
      thumbUrl = `https://videodelivery.net/${providerId}/thumbnails/thumbnail.jpg`;
    }

    // 2. Create the new Module
    const module = new Module({
      track_id: track._id,
      title: title ? title.trim() : 'Untitled Module',
      slug: slug || `module-${Date.now()}`,
      description: description ? description.trim() : '',
      estimated_duration_min: estimated_duration_min || estimatedDurationMinutes || 15,
      video_provider_id: providerId,
      thumbnail_url: thumbUrl,
      pass_threshold: pass_threshold || passingScorePercentage || 80,
      quiz_question_count: quiz_question_count || 6,
      status: status || (isPublished === false || is_published === false ? 'draft' : 'published'),
    });

    const createdModule = await module.save();

    // 3. Push module ID to parent Track's modules array
    if (track.modules && !track.modules.includes(createdModule._id)) {
      track.modules.push(createdModule._id);
      await track.save();
    }

    // Log Audit Event
    if (req.user) {
      await AuditLog.create({
        user_id: req.user._id,
        action: 'CREATE_MODULE',
        entity: 'Module',
        entity_id: createdModule._id,
        details: { title: createdModule.title, track: track.name },
        ip_address: getClientIp(req),
        user_agent: req.headers ? req.headers['user-agent'] : 'System',
      }).catch(() => {});
    }

    res.status(201).json(createdModule);
  } catch (error) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

// @desc    Get all modules (optionally filter by trackId via query ?trackId=xxx)
// @route   GET /api/modules
// @access  Private
const getModules = async (req, res) => {
  try {
    const filter = req.query.trackId
      ? { $or: [{ track_id: req.query.trackId }, { trackId: req.query.trackId }] }
      : {};
    const modules = await Module.find(filter)
      .populate('track_id', 'name title slug code')
      .populate('trackId', 'name title slug code')
      .sort({ display_order: 1, created_at: 1 });
    res.json(modules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single module by ID
// @route   GET /api/modules/:id
// @access  Private
const getModuleById = async (req, res) => {
  try {
    const moduleDoc = await Module.findById(req.params.id)
      .populate('track_id', 'name title slug code')
      .populate('trackId', 'name title slug code');

    if (!moduleDoc) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const moduleObj = moduleDoc.toObject();

    // Generate signed video / streaming URL (expires in 4h = 14400s)
    const EXPIRES_IN_SEC = 14400; // 4 hours
    const expiresAt = Math.floor(Date.now() / 1000) + EXPIRES_IN_SEC;

    if (moduleObj.videoUrl && (moduleObj.videoUrl.startsWith('/uploads/') || moduleObj.videoUrl.startsWith('http'))) {
      moduleObj.signed_video_url = moduleObj.videoUrl;
      moduleObj.streamUrl = moduleObj.videoUrl;
    } else if (moduleObj.video_provider_id && (moduleObj.video_provider_id.endsWith('.mp4') || moduleObj.video_provider_id.endsWith('.webm') || moduleObj.video_provider_id.startsWith('video_'))) {
      const vidPath = `/uploads/videos/${moduleObj.video_provider_id}`;
      moduleObj.signed_video_url = vidPath;
      moduleObj.streamUrl = vidPath;
      moduleObj.videoUrl = vidPath;
    } else if (moduleObj.cloudflareVideoId || (moduleObj.video_provider_id && !moduleObj.video_provider_id.startsWith('cf_stream_'))) {
      const providerId = moduleObj.cloudflareVideoId || moduleObj.video_provider_id;
      moduleObj.signed_video_url = `https://iframe.videodelivery.net/${providerId}?exp=${expiresAt}&token=signed_tnx_${expiresAt}`;
      moduleObj.streamUrl = moduleObj.signed_video_url;
    } else if (moduleObj.videoUrl) {
      moduleObj.signed_video_url = moduleObj.videoUrl;
      moduleObj.streamUrl = moduleObj.videoUrl;
    } else {
      moduleObj.signed_video_url = null;
      moduleObj.streamUrl = null;
    }

    // Auto-populate thumbnail_url if Cloudflare video is present but thumbnail_url is empty
    if (!moduleObj.thumbnail_url && (moduleObj.cloudflareVideoId || (moduleObj.video_provider_id && !moduleObj.video_provider_id.startsWith('/uploads/') && !moduleObj.video_provider_id.endsWith('.mp4') && !moduleObj.video_provider_id.endsWith('.webm') && !moduleObj.video_provider_id.startsWith('video_')))) {
      const providerId = moduleObj.cloudflareVideoId || moduleObj.video_provider_id;
      moduleObj.thumbnail_url = `https://videodelivery.net/${providerId}/thumbnails/thumbnail.jpg`;
    }

    moduleObj.chapters = (Array.isArray(moduleObj.chapters) && moduleObj.chapters.length > 0)
      ? moduleObj.chapters
      : [];

    // Load attached documents
    const attachments = await ModuleAttachment.find({
      $or: [{ module_id: moduleDoc._id }, { moduleId: moduleDoc._id }],
      deleted_at: null,
    }).sort({ created_at: -1 });

    moduleObj.attachments = attachments || [];

    res.json(moduleObj);

  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Module not found' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update module details
// @route   PUT /api/modules/:id
// @access  Private/Admin/SuperAdmin/TeamLead
const updateModule = async (req, res) => {
  try {
    const module = await Module.findById(req.params.id);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const oldTrackId = module.track_id || module.trackId;
    const newTrackId = req.body.track_id || req.body.trackId;

    if (req.body.thumbnailUrl && !req.body.thumbnail_url) {
      req.body.thumbnail_url = req.body.thumbnailUrl;
    }

    const newProviderId = req.body.video_provider_id || req.body.cloudflareVideoId;
    if (!req.body.thumbnail_url && newProviderId && !newProviderId.startsWith('/uploads/') && !newProviderId.endsWith('.mp4') && !newProviderId.endsWith('.webm') && !newProviderId.startsWith('video_')) {
      req.body.thumbnail_url = `https://videodelivery.net/${newProviderId}/thumbnails/thumbnail.jpg`;
    }

    // Note: req.body.tier is intentionally ignored \u2014 tier belongs to Track, not Module.
    // Mongoose strict mode will strip the 'tier' key from req.body since it's not in the Module schema.
    Object.assign(module, req.body);

    const updatedModule = await module.save();

    // If track was changed, update track associations
    if (newTrackId && oldTrackId && oldTrackId.toString() !== newTrackId.toString()) {
      await Track.findByIdAndUpdate(oldTrackId, { $pull: { modules: module._id } }).catch(() => {});
      await Track.findByIdAndUpdate(newTrackId, { $addToSet: { modules: module._id } }).catch(() => {});
    }

    // Log Audit Event
    if (req.user) {
      await AuditLog.create({
        user_id: req.user._id,
        action: 'UPDATE_MODULE',
        entity: 'Module',
        entity_id: updatedModule._id,
        details: { title: updatedModule.title },
        ip_address: getClientIp(req),
        user_agent: req.headers ? req.headers['user-agent'] : 'System',
      }).catch(() => {});
    }

    res.json(updatedModule);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Module not found' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete module & remove reference from parent Track
// @route   DELETE /api/modules/:id
// @access  Private/Admin/SuperAdmin
const deleteModule = async (req, res) => {
  try {
    const module = await Module.findById(req.params.id);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Pull module reference from parent Track before deletion
    const trackIdToPull = module.track_id || module.trackId;
    if (trackIdToPull) {
      await Track.findByIdAndUpdate(trackIdToPull, {
        $pull: { modules: module._id },
      });
    }

    // Cascade delete associated questions, attachments, prerequisites
    await Question.deleteMany({ $or: [{ module_id: module._id }, { moduleId: module._id }] }).catch(() => {});
    await ModuleAttachment.deleteMany({ $or: [{ module_id: module._id }, { moduleId: module._id }] }).catch(() => {});
    await ModulePrerequisite.deleteMany({ $or: [{ module_id: module._id }, { prerequisite_module_id: module._id }] }).catch(() => {});

    await module.deleteOne();

    // Log Audit Event
    if (req.user) {
      await AuditLog.create({
        user_id: req.user._id,
        action: 'DELETE_MODULE',
        entity: 'Module',
        entity_id: module._id,
        details: { title: module.title },
        ip_address: getClientIp(req),
        user_agent: req.headers ? req.headers['user-agent'] : 'System',
      }).catch(() => {});
    }

    res.json({ message: 'Module removed successfully' });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Module not found' });
    }
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createModule,
  getModules,
  getModuleById,
  updateModule,
  deleteModule,
};