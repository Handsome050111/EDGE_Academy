const Progress = require('../models/Progress');
const Track = require('../models/Track');

// @desc    Enroll user in a Track
// @route   POST /api/progress/enroll
// @access  Private
const enrollInTrack = async (req, res) => {
  try {
    const { trackId } = req.body;
    const userId = req.user._id;

    const track = await Track.findById(trackId);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    // Check if already enrolled
    let progress = await Progress.findOne({ userId, trackId });
    if (progress) {
      return res.status(400).json({ message: 'User already enrolled in this track' });
    }

    progress = await Progress.create({
      userId,
      trackId,
      completedModules: [],
    });

    res.status(201).json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark a module as completed (called after passing quiz)
// @route   POST /api/progress/complete-module
// @access  Private
const completeModule = async (req, res) => {
  try {
    const { trackId, moduleId, quizScore } = req.body;
    const userId = req.user._id;

    let progress = await Progress.findOne({ userId, trackId });
    if (!progress) {
      return res.status(404).json({ message: 'Enrollment record not found for this track' });
    }

    // Check if module already completed
    const alreadyCompleted = progress.completedModules.some(
      (m) => m.moduleId.toString() === moduleId
    );

    if (!alreadyCompleted) {
      progress.completedModules.push({ moduleId, quizScore });
    } else {
      // Update score if already completed
      const modIndex = progress.completedModules.findIndex(
        (m) => m.moduleId.toString() === moduleId
      );
      progress.completedModules[modIndex].quizScore = quizScore;
    }

    // Check if all track modules are completed
    const track = await Track.findById(trackId);
    if (track && progress.completedModules.length >= track.modules.length) {
      progress.isCompleted = true;
      progress.completedAt = Date.now();
    }

    await progress.save();
    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user's progress for a specific Track
// @route   GET /api/progress/:trackId
// @access  Private
const getTrackProgress = async (req, res) => {
  try {
    const progress = await Progress.findOne({
      userId: req.user._id,
      trackId: req.params.trackId,
    }).populate('completedModules.moduleId', 'title tier');

    if (!progress) {
      return res.status(404).json({ message: 'No progress found for this track' });
    }

    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  enrollInTrack,
  completeModule,
  getTrackProgress,
};