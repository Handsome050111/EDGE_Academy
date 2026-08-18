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
// @route   GET /api/analytics/users/:userId
// @access  Private
const getUserStats = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    const user = await User.findById(userId).select('fullName email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const progressDocs = await Progress.find({ userId }).lean();

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
