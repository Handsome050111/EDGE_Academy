const cron = require('node-cron');
const QuizAttempt = require('../models/QuizAttempt');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const { createNotification } = require('../controllers/notificationController');

/**
 * 1. 60-Minute Quiz Auto-Abandonment Worker
 * Finds all QuizAttempt records with completed_at: null older than 60 minutes
 * and marks them as 'abandoned' without updating ConceptScore.
 */
const autoAbandonExpiredQuizzes = async () => {
  try {
    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 60 minutes ago

    const expiredAttempts = await QuizAttempt.find({
      completed_at: null,
      completedAt: null,
      createdAt: { $lt: cutoffTime },
    });

    if (expiredAttempts.length === 0) {
      return { count: 0, message: 'No expired quiz attempts found.' };
    }

    let updatedCount = 0;
    for (const attempt of expiredAttempts) {
      attempt.completed_at = new Date();
      attempt.completedAt = new Date();
      attempt.passed = false;
      attempt.score_percent = 0;
      attempt.scorePercentage = 0;
      attempt.status = 'abandoned';
      await attempt.save();
      updatedCount++;
    }

    console.log(`[Cron Worker] Auto-abandoned ${updatedCount} expired quiz attempt(s) older than 60 minutes.`);
    return { count: updatedCount, message: `Auto-abandoned ${updatedCount} expired quiz attempt(s).` };
  } catch (error) {
    console.error('[Cron Worker] Error running autoAbandonExpiredQuizzes:', error);
    throw error;
  }
};

/**
 * Initialize all cron schedulers
 */
const initCronJobs = () => {
  console.log('⏰ Initializing EDGE Academy background workers and cron schedulers...');

  // Worker 1: Run 60-Minute Quiz Auto-Abandonment check every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    await autoAbandonExpiredQuizzes();
  });

  console.log('✅ Cron workers registered: (1) Quiz Auto-Abandonment [every 15m]');
};

module.exports = {
  autoAbandonExpiredQuizzes,
  initCronJobs,
};
