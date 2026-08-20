const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');
const Module = require('../models/Module');
const Question = require('../models/Question');
const ModuleAttachment = require('../models/ModuleAttachment');
const { logAudit } = require('../utils/audit');

// @desc    Upload / proxy video for a module with exact duration calculation
// @route   POST /api/v1/admin/modules/:id/video
// @access  Private/Admin
const uploadModuleVideo = async (req, res) => {
  try {
    const moduleId = req.params.id;
    const module = await Module.findById(moduleId);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    if (!req.file && !req.body.video_provider_id && !req.body.videoUrl) {
      return res.status(400).json({ message: 'Video file, videoUrl or video_provider_id is required' });
    }

    let videoUrl = req.body.videoUrl || module.videoUrl;
    let videoProviderId = req.body.video_provider_id || module.video_provider_id;
    let thumbnailUrl = req.body.thumbnail_url || req.body.thumbnailUrl;
    let videoDurationSec = module.video_duration_sec || 0;

    // 1. Check if client explicitly sent detected duration
    if (req.body.video_duration_sec && !isNaN(Number(req.body.video_duration_sec)) && Number(req.body.video_duration_sec) > 0) {
      videoDurationSec = Math.round(Number(req.body.video_duration_sec));
    }

    // 2. If video file was uploaded, set file path and parse exact duration
    if (req.file) {
      videoUrl = `/uploads/videos/${req.file.filename}`;
      videoProviderId = req.file.filename;

      try {
        const metadata = await mm.parseFile(req.file.path);
        if (metadata?.format?.duration && !isNaN(metadata.format.duration) && metadata.format.duration > 0) {
          videoDurationSec = Math.round(metadata.format.duration);
        }
      } catch (metaErr) {
        console.warn('music-metadata duration parsing fallback:', metaErr.message);
      }
    }

    // Auto-populate Cloudflare Stream thumbnail if not provided and videoProviderId is a Cloudflare UID
    if (!thumbnailUrl && videoProviderId && !videoProviderId.startsWith('/uploads/') && !videoProviderId.endsWith('.mp4') && !videoProviderId.endsWith('.webm') && !videoProviderId.startsWith('video_')) {
      thumbnailUrl = `https://videodelivery.net/${videoProviderId}/thumbnails/thumbnail.jpg`;
    } else if (!thumbnailUrl) {
      thumbnailUrl = module.thumbnail_url;
    }

    module.videoUrl = videoUrl;
    module.video_provider_id = videoProviderId;
    module.video_duration_sec = videoDurationSec;
    module.duration_sec = videoDurationSec;
    module.estimated_minutes = Math.max(1, Math.round(videoDurationSec / 60));
    if (thumbnailUrl) {
      module.thumbnail_url = thumbnailUrl;
      module.thumbnailUrl = thumbnailUrl;
    }
    await module.save();

    await logAudit({
      req,
      action: 'UPLOAD_MODULE_VIDEO',
      resourceType: 'Module',
      resourceId: module._id,
      outcome: 'success',
      description: `Attached video to module ${module.title}`,
      metadata: { video_provider_id: videoProviderId, videoUrl, video_duration_sec: videoDurationSec, thumbnail_url: module.thumbnail_url },
    });

    return res.status(200).json({
      message: 'Module video uploaded and attached successfully',
      module,
      videoUrl: module.videoUrl,
      video_provider_id: videoProviderId,
      video_duration_sec: videoDurationSec,
      duration_sec: videoDurationSec,
      estimated_minutes: module.estimated_minutes,
      thumbnail_url: module.thumbnail_url,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Upload custom thumbnail image from PC for a module
// @route   POST /api/v1/admin/modules/:id/thumbnail
// @access  Private/Admin
const uploadModuleThumbnail = async (req, res) => {
  try {
    const moduleId = req.params.id;
    const module = await Module.findById(moduleId);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    if (!req.file && !req.body?.thumbnail_url) {
      return res.status(400).json({ message: 'Thumbnail image file or URL is required' });
    }

    let thumbnailUrl = req.body?.thumbnail_url;
    if (req.file) {
      thumbnailUrl = `/uploads/thumbnails/${req.file.filename}`;
    }

    module.thumbnail_url = thumbnailUrl;
    module.thumbnailUrl = thumbnailUrl;
    await module.save();

    await logAudit({
      req,
      action: 'UPLOAD_MODULE_THUMBNAIL',
      resourceType: 'Module',
      resourceId: module._id,
      outcome: 'success',
      description: `Uploaded custom thumbnail image for module ${module.title}`,
      metadata: { thumbnail_url: thumbnailUrl },
    });

    return res.status(200).json({
      message: 'Thumbnail image uploaded successfully',
      thumbnail_url: thumbnailUrl,
      module,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all supporting document attachments for a module
// @route   GET /api/v1/admin/modules/:id/attachments
// @access  Private/Admin/TeamLead
const getModuleAttachments = async (req, res) => {
  try {
    const moduleId = req.params.id;
    const attachments = await ModuleAttachment.find({
      $or: [{ module_id: moduleId }, { moduleId: moduleId }],
      deleted_at: null,
    }).sort({ created_at: -1 });

    res.json(attachments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload supporting document attachment for a module
// @route   POST /api/v1/admin/modules/:id/attachments
// @access  Private/Admin
const uploadModuleAttachment = async (req, res) => {
  try {
    const moduleId = req.params.id;
    const module = await Module.findById(moduleId);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Attachment file is required (PDF, DOCX, or Image)' });
    }

    const storagePath = `/uploads/attachments/${req.file.filename}`;

    const attachment = await ModuleAttachment.create({
      module_id: module._id,
      filename: req.file.originalname,
      storage_path: storagePath,
      file_type: req.file.mimetype,
      file_size_bytes: req.file.size,
    });

    await logAudit({
      req,
      action: 'UPLOAD_MODULE_ATTACHMENT',
      resourceType: 'ModuleAttachment',
      resourceId: attachment._id,
      outcome: 'success',
      description: `Uploaded attachment '${attachment.filename}' for module ${module.title}`,
      metadata: { moduleId: module._id, filename: attachment.filename, file_size_bytes: attachment.file_size_bytes },
    });

    return res.status(201).json({
      message: 'Attachment uploaded successfully',
      attachment,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a module attachment
// @route   DELETE /api/v1/admin/modules/:moduleId/attachments/:attachmentId
// @access  Private/Admin
const deleteModuleAttachment = async (req, res) => {
  try {
    const { moduleId, attachmentId } = req.params;
    const attachment = await ModuleAttachment.findOne({
      _id: attachmentId,
      $or: [{ module_id: moduleId }, { moduleId: moduleId }],
    });

    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    // Unlink file from disk if local upload
    if (attachment.storage_path && attachment.storage_path.startsWith('/uploads/')) {
      const fullPath = path.join(__dirname, '..', attachment.storage_path);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.warn('Could not unlink attachment file:', e.message);
        }
      }
    }

    await attachment.deleteOne();

    await logAudit({
      req,
      action: 'DELETE_MODULE_ATTACHMENT',
      resourceType: 'ModuleAttachment',
      resourceId: attachmentId,
      outcome: 'success',
      description: `Deleted attachment '${attachment.filename}'`,
    });

    return res.status(200).json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Publish module with validation guard (video attached + >= 5 active questions)
// @route   POST /api/v1/admin/modules/:id/publish
// @access  Private/Admin
const publishModule = async (req, res) => {
  try {
    const moduleId = req.params.id;
    const module = await Module.findById(moduleId);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Count active questions for this module matching module_id or moduleId
    const activeQuestionCount = await Question.countDocuments({
      $or: [{ module_id: module._id }, { moduleId: module._id }],
      is_active: { $ne: false },
      deleted_at: null,
    });

    const hasVideo = Boolean(
      module.video_url ||
      module.videoUrl ||
      module.video_provider_id ||
      module.signed_video_url ||
      module.streamUrl ||
      module.cloudflareVideoId
    );
    const hasMinQuestions = activeQuestionCount >= 5;

    if (!hasVideo || !hasMinQuestions) {
      const errorMsg = `Module must have a video attached and at least 5 active questions to publish. Video attached: ${hasVideo ? 'Yes' : 'No'}, Active questions found: ${activeQuestionCount} (minimum 5 required).`;
      
      await logAudit({
        req,
        action: 'PUBLISH_MODULE',
        resourceType: 'Module',
        resourceId: module._id,
        outcome: 'failure',
        description: `Publish validation guard rejected module ${module.title}`,
        metadata: { hasVideo, activeQuestionCount, requiredMinQuestions: 5 },
      });

      return res.status(422).json({
        message: errorMsg,
        error: errorMsg,
        validation: {
          hasVideo,
          activeQuestionCount,
          minQuestionsRequired: 5,
        },
      });
    }

    module.status = 'published';
    module.is_published = true;
    module.isPublished = true;
    module.published_at = new Date();
    await module.save();

    await logAudit({
      req,
      action: 'PUBLISH_MODULE',
      resourceType: 'Module',
      resourceId: module._id,
      outcome: 'success',
      description: `Module ${module.title} published successfully`,
      metadata: { published_at: module.published_at, activeQuestionCount },
    });

    return res.status(200).json({
      message: 'Module published successfully',
      module,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message, error: error.message });
  }
};

module.exports = {
  uploadModuleVideo,
  uploadModuleThumbnail,
  getModuleAttachments,
  uploadModuleAttachment,
  deleteModuleAttachment,
  publishModule,
};
