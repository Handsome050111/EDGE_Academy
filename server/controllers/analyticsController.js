const Progress = require('../models/Progress');
const User = require('../models/User');

// @desc    Get leaderboard of top users by completed modules and quiz performance
// @route   GET /api/analytics/leaderboard
// @access  Private
const getLeaderboard = async (req, res) => {
  try {
    const progressDocs = await Progress.find()
      .populate('userId', 'fullName email')
      .lean();

    const userStatsMap = new Map();

    progressDocs.forEach((entry) => {
      const user = entry.userId;
      const userIdKey = user && user._id ? user._id.toString() : entry.userId?.toString();

      if (!userIdKey) {
        return;
      }

      if (!userStatsMap.has(userIdKey)) {
        userStatsMap.set(userIdKey, {
          userId: {
            _id: user?._id || entry.userId,
            name: user?.fullName || user?.name || 'Unknown User',
            email: user?.email || '',
          },
          completedModules: 0,
          averageQuizScore: 0,
          quizScoreTotal: 0,
          quizScoreCount: 0,
          completedTracks: 0,
          enrolledTracks: 0,
        });
      }

      const stats = userStatsMap.get(userIdKey);
      stats.enrolledTracks += 1;
      stats.completedModules += entry.completedModules?.length || 0;

      if (entry.isCompleted) {
        stats.completedTracks += 1;
      }

      const quizScores = (entry.completedModules || [])
        .map((moduleItem) => moduleItem.quizScore)
        .filter((score) => typeof score === 'number');

      if (quizScores.length > 0) {
        stats.quizScoreTotal += quizScores.reduce((sum, score) => sum + score, 0);
        stats.quizScoreCount += quizScores.length;
      }
    });

    const leaderboard = Array.from(userStatsMap.values())
      .map((entry) => {
        const averageQuizScore = entry.quizScoreCount > 0
          ? Number((entry.quizScoreTotal / entry.quizScoreCount).toFixed(2))
          : 0;

        return {
          ...entry,
          averageQuizScore,
        };
      })
      .sort((a, b) => {
        if (b.completedModules !== a.completedModules) {
          return b.completedModules - a.completedModules;
        }
        if (b.averageQuizScore !== a.averageQuizScore) {
          return b.averageQuizScore - a.averageQuizScore;
        }
        return b.completedTracks - a.completedTracks;
      })
      .slice(0, 10);

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get stats for a single user
// @route   GET /api/analytics/users/:userId  (authenticated user's own ID or permitted role)
// @route   GET /api/analytics/users/me       (always the logged-in user's own stats)
// @access  Private — owner, Admin, or team-scoped TeamLead
const getUserStats = async (req, res) => {
  try {
    // /users/me arrives with req.params.userId === undefined; fall back to own ID.
    const targetId = req.params.userId || req.user._id;
    const requesterId = req.user._id.toString();
    const targetIdStr = targetId.toString();
    const requesterRole = (req.user.role || '').toLowerCase().replace('_', '');

    const isOwner = requesterId === targetIdStr;
    const isAdmin = requesterRole === 'admin';
    const isTeamLead = requesterRole === 'teamlead' || requesterRole === 'team_lead';

    // Fast path: non-owner, non-admin, non-teamlead → reject immediately (403, not 404)
    if (!isOwner && !isAdmin && !isTeamLead) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this user\'s stats.',
        },
      });
    }

    // Fetch target user — include team fields for the TeamLead scope check below.
    // team_id and team_lead_id are NOT included in the response.
    const user = await User.findById(targetId).select('fullName email team_id team_lead_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // TeamLead scope check: target engineer must belong to this TeamLead's team.
    // Reuses the exact same pattern as the certificate PDF download ownership check.
    if (isTeamLead && !isOwner) {
      const leadTeamId = req.user.team_id?.toString();
      const engineerTeamId = user.team_id?.toString();
      const engineerLeadId = user.team_lead_id?.toString();
      const isManagedEngineer =
        engineerLeadId === requesterId ||
        (leadTeamId && engineerTeamId && engineerTeamId === leadTeamId);
      if (!isManagedEngineer) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this user\'s stats.',
          },
        });
      }
    }

    const progressDocs = await Progress.find({ userId: targetId }).lean();

    const totalEnrolledTracks = progressDocs.length;
    const completedTracks = progressDocs.filter((entry) => entry.isCompleted).length;

    const allQuizScores = progressDocs.flatMap((entry) =>
      (entry.completedModules || [])
        .map((moduleItem) => moduleItem.quizScore)
        .filter((score) => typeof score === 'number')
    );

    const averageQuizScore = allQuizScores.length > 0
      ? Number((allQuizScores.reduce((sum, score) => sum + score, 0) / allQuizScores.length).toFixed(2))
      : 0;

    // Response shape is unchanged — team_id/team_lead_id are intentionally excluded.
    res.json({
      userId: user._id,
      name: user.fullName,
      email: user.email,
      totalEnrolledTracks,
      completedTracks,
      averageQuizScore,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLeaderboard,
  getUserStats,
};
