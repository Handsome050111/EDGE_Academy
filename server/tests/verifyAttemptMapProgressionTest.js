const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Module = require('../models/Module');
const QuizAttempt = require('../models/QuizAttempt');
const { getUserProgress } = require('../controllers/userController');

async function runTest() {
  await connectDB();

  try {
    console.log('\n--- 🧪 TEST: Attempt Progression & First-Pass Locking ---');
    let testUser = await User.findOne({ email: 'progression_test_eng@example.com' });
    if (!testUser) {
      testUser = await User.create({
        fullName: 'Progression Test Engineer',
        email: 'progression_test_eng@example.com',
        role: 'engineer',
        password_hash: 'hashedpassword',
      });
    }

    let testModule = await Module.findOne();
    if (!testModule) {
      console.log('No module found in DB');
      return;
    }

    // Clean any prior attempts
    await QuizAttempt.deleteMany({ engineer_id: testUser._id, module_id: testModule._id });

    const fetchScoreAndStatus = async () => {
      const req = { user: { _id: testUser._id } };
      let resData = null;
      const res = { status: () => res, json: (d) => { resData = d; } };
      await getUserProgress(req, res);
      const mod = resData?.tracks?.flatMap(t => t.modules).find(m => m.id.toString() === testModule._id.toString());
      return { score: mod?.best_quiz_score, status: mod?.status };
    };

    const now = Date.now();

    // 1. Attempt 1: Failed (40%)
    await QuizAttempt.create({
      engineer_id: testUser._id,
      module_id: testModule._id,
      quiz_type: 'topic',
      score_percent: 40,
      passed: false,
      status: 'completed',
      created_at: new Date(now - 400000),
    });

    let state = await fetchScoreAndStatus();
    console.log('After Attempt 1 (40% Failed):', state);
    if (state.score !== 40 || state.status !== 'in_progress') {
      throw new Error(`Expected 40% in_progress, got ${state.score} ${state.status}`);
    }

    // 2. Attempt 2: Failed (60%)
    await QuizAttempt.create({
      engineer_id: testUser._id,
      module_id: testModule._id,
      quiz_type: 'topic',
      score_percent: 60,
      passed: false,
      status: 'completed',
      created_at: new Date(now - 300000),
    });

    state = await fetchScoreAndStatus();
    console.log('After Attempt 2 (60% Failed):', state);
    if (state.score !== 60 || state.status !== 'in_progress') {
      throw new Error(`Expected 60% in_progress (updated to latest failed attempt), got ${state.score} ${state.status}`);
    }

    // 3. Attempt 3: Failed (75%)
    await QuizAttempt.create({
      engineer_id: testUser._id,
      module_id: testModule._id,
      quiz_type: 'topic',
      score_percent: 75,
      passed: false,
      status: 'completed',
      created_at: new Date(now - 200000),
    });

    state = await fetchScoreAndStatus();
    console.log('After Attempt 3 (75% Failed):', state);
    if (state.score !== 75 || state.status !== 'in_progress') {
      throw new Error(`Expected 75% in_progress (updated to latest failed attempt), got ${state.score} ${state.status}`);
    }

    // 4. Attempt 4: Passed (85%)
    await QuizAttempt.create({
      engineer_id: testUser._id,
      module_id: testModule._id,
      quiz_type: 'topic',
      score_percent: 85,
      passed: true,
      status: 'completed',
      created_at: new Date(now - 100000),
    });

    state = await fetchScoreAndStatus();
    console.log('After Attempt 4 (85% Passed - First Pass):', state);
    if (state.score !== 85 || state.status !== 'completed') {
      throw new Error(`Expected 85% completed (locked to first passing score), got ${state.score} ${state.status}`);
    }

    // 5. Attempt 5: Passed Retake (95%)
    await QuizAttempt.create({
      engineer_id: testUser._id,
      module_id: testModule._id,
      quiz_type: 'topic',
      score_percent: 95,
      passed: true,
      status: 'completed',
      created_at: new Date(now - 50000),
    });

    state = await fetchScoreAndStatus();
    console.log('After Attempt 5 (95% Passed Retake):', state);
    if (state.score !== 85 || state.status !== 'completed') {
      throw new Error(`Expected score to remain 85% from first pass, got ${state.score}`);
    }

    // 6. Attempt 6: Failed Retake (50%)
    await QuizAttempt.create({
      engineer_id: testUser._id,
      module_id: testModule._id,
      quiz_type: 'topic',
      score_percent: 50,
      passed: false,
      status: 'completed',
      created_at: new Date(now),
    });

    state = await fetchScoreAndStatus();
    console.log('After Attempt 6 (50% Failed Retake):', state);
    if (state.score !== 85 || state.status !== 'completed') {
      throw new Error(`Expected score to remain 85% from first pass, got ${state.score}`);
    }

    console.log('\n✅ ALL 6 PROGRESSION & LOCKING STAGES VERIFIED SUCCESSFULLY.');

    // Clean up
    await QuizAttempt.deleteMany({ engineer_id: testUser._id });
    await User.deleteMany({ _id: testUser._id });
  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
