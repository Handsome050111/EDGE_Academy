const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Module = require('../models/Module');
const Track = require('../models/Track');
const VideoProgress = require('../models/VideoProgress');
const QuizAttempt = require('../models/QuizAttempt');
const AttemptResponse = require('../models/AttemptResponse');
const ConceptScore = require('../models/ConceptScore');
const Question = require('../models/Question');
const Assignment = require('../models/Assignment');
const { saveProgress } = require('../controllers/videoProgressController');
const { submitQuizAttempt } = require('../controllers/quizController');
const { getUserProgress } = require('../controllers/userController');

async function runTest() {
  await connectDB();

  try {
    console.log('\n--- 🧪 TEST FIX 2: Monotonic Video Progress Save ---');
    let testUser = await User.findOne({ email: 'eng_fixes_test@example.com' });
    if (!testUser) {
      testUser = await User.create({
        fullName: 'Engineer Fixes Tester',
        email: 'eng_fixes_test@example.com',
        role: 'engineer',
        password_hash: 'hashedpassword',
      });
    }

    let testModule = await Module.findOne();
    if (!testModule) {
      console.log('No module found in DB, skipping module-dependent test.');
      return;
    }

    // Clear any previous test progress
    await VideoProgress.deleteMany({ engineer_id: testUser._id, module_id: testModule._id });

    // Step 1: Save 100% progress
    const req1 = {
      params: { id: testModule._id.toString() },
      user: { _id: testUser._id },
      body: { position_sec: 120, percent_watched: 100 },
    };
    let resData1 = null;
    const res1 = { status: () => res1, json: (d) => { resData1 = d; } };
    await saveProgress(req1, res1);

    console.log('Saved 100% video progress:', resData1);

    // Step 2: Simulate rewind to 20%
    const req2 = {
      params: { id: testModule._id.toString() },
      user: { _id: testUser._id },
      body: { position_sec: 24, percent_watched: 20 },
    };
    let resData2 = null;
    const res2 = { status: () => res2, json: (d) => { resData2 = d; } };
    await saveProgress(req2, res2);

    console.log('Saved 20% rewind video progress:', resData2);

    const vpDoc = await VideoProgress.findOne({ engineer_id: testUser._id, module_id: testModule._id });
    if (vpDoc.percent_watched === 100 && vpDoc.completed === true && vpDoc.position_sec === 24) {
      console.log('✅ FIX 2 PASSED: percent_watched remains 100% (monotonic) while position_sec accurately updated to 24s.');
    } else {
      console.error('❌ FIX 2 FAILED: percent_watched dropped or state incorrect:', vpDoc);
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST FIX 6: First-Passing Score Authority & Practice Retake ---');
    // Ensure test question exists
    let testQ = await Question.findOne({ module_id: testModule._id });
    if (!testQ) {
      testQ = await Question.create({
        module_id: testModule._id,
        question_text: 'What is EDGE standard?',
        options: [
          { key: 'A', text: 'Option A' },
          { key: 'B', text: 'Option B' },
        ],
        correct_option: 'A',
        concept_tag: 'TEST_CONCEPT_UAT',
        difficulty: 'medium',
      });
    }

    // Reset concept score for test concept
    await ConceptScore.deleteMany({ engineer_id: testUser._id, concept_tag: testQ.concept_tag });
    await QuizAttempt.deleteMany({ engineer_id: testUser._id, module_id: testModule._id });
    await Assignment.deleteMany({ engineer_id: testUser._id, module_id: testModule._id });

    // 1. First Attempt (Pass with 100%)
    const attempt1 = await QuizAttempt.create({
      engineer_id: testUser._id,
      quiz_type: 'topic',
      module_id: testModule._id,
      started_at: new Date(Date.now() - 3600000), // 1 hour ago
      status: 'in_progress',
    });

    const reqSub1 = {
      params: { id: attempt1._id.toString() },
      user: { _id: testUser._id },
      body: {
        answers: [{ question_id: testQ._id.toString(), selected_option: testQ.correct_option, response_time_ms: 1000 }],
      },
    };
    let resSubData1 = null;
    const resSub1 = { status: () => resSub1, json: (d) => { resSubData1 = d; } };
    await submitQuizAttempt(reqSub1, resSub1);

    console.log('First Attempt Result:', resSubData1);
    const firstAttemptDoc = await QuizAttempt.findById(attempt1._id);
    const originalCompletedAt = firstAttemptDoc.completed_at;

    const csAfter1 = await ConceptScore.findOne({ engineer_id: testUser._id, concept_tag: testQ.concept_tag });
    console.log('ConceptScore after first pass:', { total: csAfter1.total_count, correct: csAfter1.correct_count });

    // 2. Second Attempt (Practice Retake - Incorrect Choice -> Score 0%)
    const wrongOption = testQ.correct_option === 'A' ? 'B' : 'A';
    const attempt2 = await QuizAttempt.create({
      engineer_id: testUser._id,
      quiz_type: 'topic',
      module_id: testModule._id,
      started_at: new Date(),
      status: 'in_progress',
    });

    const reqSub2 = {
      params: { id: attempt2._id.toString() },
      user: { _id: testUser._id },
      body: {
        answers: [{ question_id: testQ._id.toString(), selected_option: wrongOption, response_time_ms: 1000 }],
      },
    };
    let resSubData2 = null;
    const resSub2 = { status: () => resSub2, json: (d) => { resSubData2 = d; } };
    await submitQuizAttempt(reqSub2, resSub2);

    console.log('Second Attempt (Retake) Result:', resSubData2);

    // Verify retake flag
    if (resSubData2.is_practice_retake === true) {
      console.log('✅ Retake correctly identified as practice retake.');
    } else {
      console.error('❌ Failed: is_practice_retake was not set to true.');
      process.exit(1);
    }

    // Verify ConceptScore did NOT change
    const csAfter2 = await ConceptScore.findOne({ engineer_id: testUser._id, concept_tag: testQ.concept_tag });
    if (csAfter2.total_count === 1 && csAfter2.correct_count === 1) {
      console.log('✅ ConceptScore was NOT polluted by practice retake attempt.');
    } else {
      console.error('❌ Failed: ConceptScore was modified by retake:', csAfter2);
      process.exit(1);
    }

    // Verify getUserProgress returns 100% (first pass) not 0% (retake)
    const reqProgress = { user: { _id: testUser._id } };
    let progressData = null;
    const resProgress = { status: () => resProgress, json: (d) => { progressData = d; } };
    await getUserProgress(reqProgress, resProgress);

    const modProgress = progressData?.tracks?.flatMap(t => t.modules).find(m => m.id.toString() === testModule._id.toString());
    console.log('User progress for module:', modProgress);

    if (modProgress && modProgress.best_quiz_score === 100 && modProgress.status === 'completed') {
      console.log('✅ FIX 6 PASSED: Official recorded score remains 100% from first passing attempt.');
    } else {
      console.error('❌ FIX 6 FAILED: Official score was overwritten or incorrect:', modProgress);
      process.exit(1);
    }

    // Clean up test data
    await VideoProgress.deleteMany({ engineer_id: testUser._id });
    await QuizAttempt.deleteMany({ engineer_id: testUser._id });
    await AttemptResponse.deleteMany({ attempt_id: { $in: [attempt1._id, attempt2._id] } });
    await ConceptScore.deleteMany({ engineer_id: testUser._id });
    await User.deleteMany({ _id: testUser._id });
    console.log('\nAll test clean-up completed successfully.');
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
