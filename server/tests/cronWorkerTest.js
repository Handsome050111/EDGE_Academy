const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const QuizAttempt = require('../models/QuizAttempt');
const ConceptScore = require('../models/ConceptScore');
const Assignment = require('../models/Assignment');
const { autoAbandonExpiredQuizzes, generateMondayReviewQuizzes } = require('../services/cronService');

const runCronWorkerTest = async () => {
  try {
    console.log('🔄 Connecting to MongoDB for Cron Worker & Scheduler Test...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edge_academy');
    console.log('✅ Connected to MongoDB');

    // 1. Get or create test user
    let engineer = await User.findOne({ email: 'cron_test_engineer@technonex.com' });
    if (!engineer) {
      engineer = await User.create({
        fullName: 'Cron Test Engineer',
        email: 'cron_test_engineer@technonex.com',
        password: 'hashedpassword',
        role: 'engineer',
      });
    }

    console.log('\n--- 🧪 TEST 1: 60-Minute Quiz Auto-Abandonment Worker ---');

    // Create an unsubmitted QuizAttempt created 90 minutes ago
    const ninetyMinsAgo = new Date(Date.now() - 90 * 60 * 1000);
    const expiredAttempt = await QuizAttempt.create({
      engineer_id: engineer._id,
      userId: engineer._id,
      quiz_type: 'topic',
      type: 'topic',
      createdAt: ninetyMinsAgo,
      completed_at: null,
      completedAt: null,
    });

    console.log(`   Created unsubmitted attempt ${expiredAttempt._id} (started 90 minutes ago)`);

    // Record initial ConceptScore count for this engineer
    const initialConceptScores = await ConceptScore.find({
      $or: [{ engineer_id: engineer._id }, { userId: engineer._id }],
    });

    // Execute auto-abandonment worker
    const result1 = await autoAbandonExpiredQuizzes();

    // Verify attempt status
    const updatedAttempt = await QuizAttempt.findById(expiredAttempt._id);

    // Verify ConceptScore count was NOT modified
    const finalConceptScores = await ConceptScore.find({
      $or: [{ engineer_id: engineer._id }, { userId: engineer._id }],
    });

    if (
      updatedAttempt.status === 'abandoned' &&
      updatedAttempt.passed === false &&
      (updatedAttempt.completed_at || updatedAttempt.completedAt) &&
      finalConceptScores.length === initialConceptScores.length
    ) {
      console.log('✅ TEST 1 PASSED: Expired attempt (>60 min) was marked abandoned with 0 score');
      console.log(`   Status: ${updatedAttempt.status}, Passed: ${updatedAttempt.passed}`);
      console.log('   Confirmed: ConceptScore records were NOT updated or modified.');
    } else {
      console.error('❌ TEST 1 FAILED: Expected abandoned status, got:', updatedAttempt);
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 2: Monday 06:00 UTC Review Quiz Cron Job ---');

    // Create 3 completed assignments for this engineer
    let testTrack = await Track.findOne();
    if (!testTrack) {
      testTrack = await Track.create({
        title: 'Cron Track',
        code: 'CRON-101',
        tier: 'L1_CORE',
      });
    }

    const m1 = await Module.create({ trackId: testTrack._id, title: 'Cron Mod 1', tier: 'L1_CORE' });
    const m2 = await Module.create({ trackId: testTrack._id, title: 'Cron Mod 2', tier: 'L1_CORE' });
    const m3 = await Module.create({ trackId: testTrack._id, title: 'Cron Mod 3', tier: 'L1_CORE' });

    await Assignment.deleteMany({
      $or: [{ engineer_id: engineer._id }, { userId: engineer._id }],
    });

    await Assignment.create({ engineer_id: engineer._id, userId: engineer._id, module_id: m1._id, moduleId: m1._id, assigned_by: engineer._id, status: 'completed' });
    await Assignment.create({ engineer_id: engineer._id, userId: engineer._id, module_id: m2._id, moduleId: m2._id, assigned_by: engineer._id, status: 'completed' });
    await Assignment.create({ engineer_id: engineer._id, userId: engineer._id, module_id: m3._id, moduleId: m3._id, assigned_by: engineer._id, status: 'completed' });

    // Create an unsubmitted review quiz from previous week
    const pendingReviewAttempt = await QuizAttempt.create({
      engineer_id: engineer._id,
      userId: engineer._id,
      quiz_type: 'review',
      type: 'review',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      completed_at: null,
      completedAt: null,
    });

    console.log(`   Created pending review attempt ${pendingReviewAttempt._id} from previous week`);

    // Execute Monday Review Quiz cron logic
    const result2 = await generateMondayReviewQuizzes();

    const expiredReviewAttempt = await QuizAttempt.findById(pendingReviewAttempt._id);

    if (result2.eligibleCount >= 1 && expiredReviewAttempt.status === 'abandoned') {
      console.log('✅ TEST 2 PASSED: Monday cron expired previous week review quiz and verified eligible engineer');
      console.log(`   Eligible Engineers: ${result2.eligibleCount}, Expired Quizzes: ${result2.expiredAttemptsCount}`);
    } else {
      console.error('❌ TEST 2 FAILED: Expected review quiz expiration, got:', result2, expiredReviewAttempt);
      process.exit(1);
    }

    console.log('\n🎉 ALL CRON WORKER AND SCHEDULER TESTS PASSED SUCCESSFULLY!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test execution error:', error);
    process.exit(1);
  }
};

runCronWorkerTest();
