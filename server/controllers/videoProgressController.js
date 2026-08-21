const VideoProgress = require('../models/VideoProgress');

// @desc    Save/update video playback progress (throttled from frontend every 10s)
// @route   POST /api/v1/modules/:id/video-progress
// @access  Private
const saveProgress = async (req, res) => {
  try {
    const { position_sec, percent_watched } = req.body;
    const module_id = req.params.id;
    const engineer_id = req.user._id;

    const existing = await VideoProgress.findOne({ engineer_id, module_id });

    const incomingPct = typeof percent_watched === 'number' ? Math.round(percent_watched) : 0;
    const finalPercent = Math.max(existing?.percent_watched || 0, incomingPct);
    const completed = finalPercent >= 95 || Boolean(existing?.completed);

    const progress = await VideoProgress.findOneAndUpdate(
      { engineer_id, module_id },
      {
        $set: {
          engineer_id,
          module_id,
          position_sec: position_sec !== undefined ? position_sec : (existing?.position_sec || 0),
          percent_watched: finalPercent,
          completed,
          last_watched_at: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Spec Section 7.2: Auto-transition pending Assignment to in_progress on first video progress
    const Assignment = require('../models/Assignment');
    await Assignment.updateOne(
      {
        $or: [
          { engineer_id, module_id },
          { userId: engineer_id, moduleId: module_id },
        ],
        status: 'pending',
      },
      {
        $set: {
          status: 'in_progress',
          started_at: new Date(),
        },
      }
    );

    res.json({
      position_sec: progress.position_sec,
      percent_watched: progress.percent_watched,
      completed: progress.completed,
    });

  } catch (error) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

// @desc    Get video playback progress for a module
// @route   GET /api/v1/modules/:id/video-progress
// @access  Private
const getProgress = async (req, res) => {
  try {
    const module_id = req.params.id;
    const engineer_id = req.user._id;

    const progress = await VideoProgress.findOne({ engineer_id, module_id });

    if (!progress) {
      return res.json({ position_sec: 0, percent_watched: 0, completed: false });
    }

    res.json({
      position_sec: progress.position_sec,
      percent_watched: progress.percent_watched,
      completed: progress.completed,
    });
  } catch (error) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

module.exports = { saveProgress, getProgress };
