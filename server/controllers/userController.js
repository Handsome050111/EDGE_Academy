const User = require('../models/User');
const Team = require('../models/Team');
const Track = require('../models/Track');
const Module = require('../models/Module');
const VideoProgress = require('../models/VideoProgress');
const QuizAttempt = require('../models/QuizAttempt');
const Assignment = require('../models/Assignment');
const ConceptScore = require('../models/ConceptScore');
const Certificate = require('../models/Certificate');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validatePasswordStrength, buildAuditEntry } = require('../utils/security');
const { logAuditEvent } = require('../utils/audit');

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Get current user profile
// @route   GET /api/v1/me/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password_hash -password')
      .populate('team_id', 'name region code');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get comprehensive user progress matrix across tracks and modules
// @route   GET /api/v1/me/progress
// @access  Private
const getUserProgress = async (req, res) => {
  try {
    const engineerId = req.user._id;

    // Fetch published tracks and modules
    const tracks = await Track.find({
      $or: [{ is_published: true }, { isPublished: true }],
    }).sort({ display_order: 1, displayOrder: 1 });

    const allModules = await Module.find({
      status: 'published',
      deleted_at: null,
    }).sort({ display_order: 1, displayOrder: 1 });

    const videoProgresses = await VideoProgress.find({
      $or: [{ engineer_id: engineerId }, { userId: engineerId }],
    });
    const videoMap = {};
    videoProgresses.forEach((vp) => {
      const mId = (vp.module_id || vp.moduleId)?.toString();
      if (mId) videoMap[mId] = vp;
    });

    const quizAttempts = await QuizAttempt.find({
      $or: [{ engineer_id: engineerId }, { userId: engineerId }],
      status: 'completed',
    });
    const attemptMap = {};
    quizAttempts.forEach((qa) => {
      const mId = (qa.module_id || qa.moduleId)?.toString();
      if (mId) {
        if (!attemptMap[mId] || (qa.score_percent || 0) > (attemptMap[mId].score_percent || 0)) {
          attemptMap[mId] = qa;
        }
      }
    });

    const assignments = await Assignment.find({
      $or: [{ engineer_id: engineerId }, { userId: engineerId }],
    });
    const assignmentMap = {};
    assignments.forEach((a) => {
      const mId = (a.module_id || a.moduleId)?.toString();
      if (mId) assignmentMap[mId] = a;
    });

    const certificates = await Certificate.find({
      $or: [{ engineer_id: engineerId }, { userId: engineerId }],
      status: 'active',
    }).populate('track_id', 'name title slug code');

    const conceptScores = await ConceptScore.find({
      $or: [{ engineer_id: engineerId }, { userId: engineerId }],
    }).sort({ accuracy: 1 });

    let totalCompletedModules = 0;
    const tracksProgress = tracks.map((track) => {
      const trackModules = allModules.filter(
        (m) => (m.track_id || m.trackId)?.toString() === track._id.toString()
      );

      let completedInTrack = 0;
      const modulesData = trackModules.map((mod) => {
        const mId = mod._id.toString();
        const vp = videoMap[mId];
        const qa = attemptMap[mId];
        const assign = assignmentMap[mId];

        const isCompleted = Boolean(
          assign?.status === 'completed' || (qa && qa.passed)
        );
        if (isCompleted) completedInTrack++;

        let status = 'not_started';
        if (isCompleted) {
          status = 'completed';
        } else if ((vp && vp.percent_watched > 0) || assign?.status === 'in_progress' || qa) {
          status = 'in_progress';
        }

        return {
          id: mod._id,
          title: mod.title,
          slug: mod.slug,
          tier: mod.tier,
          status,
          percent_watched: vp ? vp.percent_watched : 0,
          video_completed: vp ? vp.completed : false,
          quiz_passed: qa ? qa.passed : false,
          best_quiz_score: qa ? (qa.score_percent !== undefined ? qa.score_percent : qa.scorePercentage) : null,
          deadline_at: assign ? assign.deadline_at : null,
        };
      });

      totalCompletedModules += completedInTrack;
      const progressPercent = trackModules.length > 0 ? Math.round((completedInTrack / trackModules.length) * 100) : 0;

      return {
        id: track._id,
        name: track.name || track.title,
        slug: track.slug || track.code,
        icon: track.icon,
        total_modules: trackModules.length,
        completed_modules: completedInTrack,
        progress_percent: progressPercent,
        modules: modulesData,
      };
    });

    const activeAssignments = assignments.filter((a) => a.status === 'pending' || a.status === 'in_progress').length;

    return res.json({
      engineer_id: engineerId,
      total_modules_completed: totalCompletedModules,
      active_assignments_count: activeAssignments,
      certificates_count: certificates.length,
      tracks: tracksProgress,
      certificates,
      weak_concepts: conceptScores.map((cs) => ({
        concept_tag: cs.concept_tag,
        accuracy: cs.accuracy,
        total_attempts: cs.total_count,
        correct_attempts: cs.correct_count,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

// @desc    Update current user profile (Name, Email, Locale, Password)
// @route   PUT /api/v1/me/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const { name, fullName, email, locale, currentPassword, newPassword, password } = req.body;
    const user = await User.findById(req.user._id).select('+password_hash +password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 1. Update Full Name
    const newName = fullName || name;
    if (newName) {
      user.full_name = newName.trim();
      user.fullName = newName.trim();
    }

    // 2. Update Email (Check Uniqueness)
    if (email && email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists && emailExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Email address is already in use by another account' });
      }
      user.email = email.toLowerCase().trim();
    }

    // 3. Update Locale
    if (locale && ['en', 'de'].includes(locale)) {
      user.locale = locale;
    }

    // 4. Password Change logic (requires currentPassword verification)
    const targetNewPassword = newPassword || password;
    if (targetNewPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password' });
      }

      const userPassHash = user.password_hash || user.password;
      const isMatch = await bcrypt.compare(currentPassword, userPassHash);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password provided is incorrect' });
      }

      const passwordCheck = validatePasswordStrength(targetNewPassword);
      if (!passwordCheck.valid) {
        return res.status(400).json({ message: passwordCheck.errors.join(' ') });
      }

      const salt = await bcrypt.genSalt(12);
      user.password_hash = await bcrypt.hash(targetNewPassword, salt);
    }

    const updatedUser = await user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password_hash;
    delete userResponse.password;

    const auditEntry = buildAuditEntry({
      actor: req.user,
      action: 'profile_updated',
      resourceType: 'UserProfile',
      resourceId: user._id.toString(),
      outcome: 'success',
      description: 'User updated profile details',
      metadata: { changedEmail: Boolean(email && email !== req.user.email), changedPassword: Boolean(targetNewPassword) },
    });
    await logAuditEvent(auditEntry);

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: userResponse._id,
        fullName: userResponse.full_name || userResponse.fullName,
        email: userResponse.email,
        role: userResponse.role,
        locale: userResponse.locale,
        language: userResponse.locale,
        token: generateToken(userResponse._id),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUserProfile,
  getUserProgress,
  updateUserProfile,
};

