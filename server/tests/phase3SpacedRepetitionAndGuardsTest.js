const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');

const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const ModulePrerequisite = require('../models/ModulePrerequisite');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const AttemptResponse = require('../models/AttemptResponse');
const ConceptScore = require('../models/ConceptScore');
const Assignment = require('../models/Assignment');
const VideoProgress = require('../models/VideoProgress');

const {
  calculateQuestionWeights,
  weightedSampleWithoutReplacement,
  formatObfuscatedQuestions,
} = require('../utils/reviewEngine');
const { startTopicQuiz, startReviewQuiz } = require('../controllers/quizController');
const { saveProgress } = require('../controllers/videoProgressController');

const runTests = async () => {
  try {
    await connectDB();
    console.log('🧪 Starting Phase 3 Spaced Repetition, Obfuscation & Guards Verification Tests...\n');

    let passedTests = 0;
    let failedTests = 0;

    const assert = (condition, testName) => {
      if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passedTests++;
      } else {
        console.error(`  ❌ FAIL: ${testName}`);
        failedTests++;
      }
    };

    const mockRes = () => {
      let resData = null;
      let resStatus = 200;
      return {
        status: (code) => {
          resStatus = code;
          return {
            json: (data) => {
              resData = data;
              return data;
            },
          };
        },
        json: (data) => {
          resData = data;
          return data;
        },
        getData: () => resData,
        getStatus: () => resStatus,
      };
    };

    // ========================================================
    // 1. Spaced Repetition Algorithm & Diversity Cap Tests
    // ========================================================
    console.log('--- 1. Spaced Repetition Algorithm & Diversity Cap Tests ---');

    const dummyQuestions = [
      { _id: new mongoose.Types.ObjectId(), concept_tag: 'weak_concept', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', difficulty: 'hard' },
      { _id: new mongoose.Types.ObjectId(), concept_tag: 'strong_concept', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', difficulty: 'easy' },
      { _id: new mongoose.Types.ObjectId(), concept_tag: 'stale_concept', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', difficulty: 'medium' },
      { _id: new mongoose.Types.ObjectId(), concept_tag: 'fresh_concept', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', difficulty: 'medium' },
    ];

    const dummyConceptScores = [
      { concept_tag: 'weak_concept', accuracy: 0.1, total_count: 10, correct_count: 1 },
      { concept_tag: 'strong_concept', accuracy: 0.95, total_count: 20, correct_count: 19 },
    ];

    const dummyLastSeen = {
      weak_concept: 25, // > 21 days (stale -> 1.5x)
      strong_concept: 2, // < 7 days (fresh -> 0.3x)
      stale_concept: 30, // > 21 days (1.5x)
      fresh_concept: 4, // < 7 days (0.3x)
    };

    const weightedResults = calculateQuestionWeights({
      questions: dummyQuestions,
      conceptScores: dummyConceptScores,
      lastSeenMap: dummyLastSeen,
    });

    const weakWeight = weightedResults.find((r) => r.conceptTag === 'weak_concept').weight;
    const strongWeight = weightedResults.find((r) => r.conceptTag === 'strong_concept').weight;
    const staleWeight = weightedResults.find((r) => r.conceptTag === 'stale_concept').weight;
    const freshWeight = weightedResults.find((r) => r.conceptTag === 'fresh_concept').weight;

    // weak: (1 - 0.1) + 0.2 = 1.1 * 1.5 = 1.65
    // strong: (1 - 0.95) + 0.2 = 0.25 * 0.3 = 0.075
    assert(weakWeight > strongWeight * 10, `Weak concept weight (${weakWeight.toFixed(2)}) significantly exceeds strong concept weight (${strongWeight.toFixed(3)})`);
    assert(staleWeight > freshWeight * 3, `Stale concept weight (${staleWeight.toFixed(2)}) exceeds fresh concept weight (${freshWeight.toFixed(2)})`);

    // Diversity Cap test (30 questions across 5 concepts, max 3 per concept for target 15)
    const largeQuestionPool = [];
    for (let c = 1; c <= 5; c++) {
      for (let q = 1; q <= 6; q++) {
        largeQuestionPool.push({
          question: { _id: new mongoose.Types.ObjectId(), concept_tag: `concept_${c}` },
          conceptTag: `concept_${c}`,
          weight: 1.0,
        });
      }
    }

    const sampled15 = weightedSampleWithoutReplacement(largeQuestionPool, 15, 3);
    assert(sampled15.length === 15, 'Sampled exactly 15 questions for review quiz');

    const conceptHistogram = {};
    sampled15.forEach((q) => {
      conceptHistogram[q.concept_tag] = (conceptHistogram[q.concept_tag] || 0) + 1;
    });

    const maxOccurrences = Math.max(...Object.values(conceptHistogram));
    assert(maxOccurrences <= 3, `Enforced diversity cap: max occurrences for any concept is ${maxOccurrences} (<= 3)`);

    // ========================================================
    // 2. Quiz Answer Obfuscation Security Tests
    // ========================================================
    console.log('\n--- 2. Quiz Answer Obfuscation Security Tests ---');

    const sensitiveQuestions = [
      {
        _id: new mongoose.Types.ObjectId(),
        question_text: 'What is the standard procedure?',
        option_a: 'Option A',
        option_b: 'Option B',
        option_c: 'Option C',
        option_d: 'Option D',
        correct_option: 'A',
        explanation: 'Sensitive confidential explanation',
        concept_tag: 'c1',
        difficulty: 'medium',
      },
    ];

    const obfuscated = formatObfuscatedQuestions(sensitiveQuestions);
    const firstQ = obfuscated[0];

    assert(firstQ.correct_option === undefined, 'correct_option stripped from quiz payload');
    assert(firstQ.correctOption === undefined, 'correctOption stripped from quiz payload');
    assert(firstQ.explanation === undefined, 'explanation stripped from quiz payload');
    assert(Array.isArray(firstQ.options) && firstQ.options.length === 4, '4 shuffled options provided in payload');
    assert(firstQ.options.every((opt) => opt.key && opt.text), 'Option objects contain key and text');

    // ========================================================
    // 3. Prerequisite Checking & Admin Override Tests
    // ========================================================
    console.log('\n--- 3. Prerequisite Enforcement & Admin Override Tests ---');

    const testEngineer = await User.findOne({ email: 'ali.sultan@technonex.de' });
    const testTrack = await Track.findOne({ is_published: true });

    // Create 2 test modules: Module A (Prerequisite) and Module B (Dependent)
    const modA = await Module.create({
      track_id: testTrack._id,
      title: 'Prerequisite Module A',
      slug: `mod-a-${Date.now()}`,
      tier: 'L1_CORE',
      pass_threshold: 80,
      status: 'published',
    });

    const modB = await Module.create({
      track_id: testTrack._id,
      title: 'Dependent Module B',
      slug: `mod-b-${Date.now()}`,
      tier: 'L2_ADVANCED',
      pass_threshold: 80,
      status: 'published',
    });

    // Create 5 questions for modB so quiz can start
    for (let i = 1; i <= 5; i++) {
      await Question.create({
        module_id: modB._id,
        question_text: `Mod B Question ${i}?`,
        option_a: 'Correct',
        option_b: 'Wrong',
        option_c: 'Wrong',
        option_d: 'Wrong',
        correct_option: 'A',
        concept_tag: `mod_b_concept_${i}`,
        is_active: true,
      });
    }

    // Set 100% video progress on modB so video watch guard passes
    await VideoProgress.create({
      engineer_id: testEngineer._id,
      module_id: modB._id,
      percent_watched: 100,
      completed: true,
    });

    // Set Module A as prerequisite for Module B
    const prereqRelation = await ModulePrerequisite.create({
      module_id: modB._id,
      prerequisite_module_id: modA._id,
    });

    // Clear any previous attempts or assignments on modA / modB
    await Assignment.deleteMany({ engineer_id: testEngineer._id, module_id: { $in: [modA._id, modB._id] } });
    await QuizAttempt.deleteMany({ engineer_id: testEngineer._id, module_id: { $in: [modA._id, modB._id] } });

    // Test 3A: Attempt quiz on Mod B without completing Mod A -> Must return 403 PREREQUISITES_NOT_MET
    const reqPrereqFail = { user: testEngineer, params: { id: modB._id.toString() } };
    const resPrereqFail = mockRes();
    await startTopicQuiz(reqPrereqFail, resPrereqFail);

    assert(resPrereqFail.getStatus() === 403, 'Quiz start rejected with 403 when prerequisite is uncompleted');
    const prereqFailData = resPrereqFail.getData();
    assert(prereqFailData?.error?.code === 'PREREQUISITES_NOT_MET', 'Error code is PREREQUISITES_NOT_MET');
    assert(prereqFailData?.error?.missing_prerequisites?.length === 1, 'Lists missing prerequisite module');

    // Test 3B: Create Admin Assignment for Mod B (Assignment Override) -> Must bypass prerequisite check
    const overrideAssignment = await Assignment.create({
      engineer_id: testEngineer._id,
      module_id: modB._id,
      assigned_by: testEngineer._id,
      status: 'in_progress',
    });

    const resOverride = mockRes();
    await startTopicQuiz(reqPrereqFail, resOverride);
    assert(resOverride.getStatus() === 200, 'Admin Assignment Override bypasses prerequisite check and starts quiz');
    const overrideData = resOverride.getData();
    assert(overrideData && overrideData.attempt_id && overrideData.questions.length > 0, 'Quiz attempt generated successfully');

    // Clean up test quiz attempt
    if (overrideData?.attempt_id) {
      await QuizAttempt.deleteOne({ _id: overrideData.attempt_id });
    }

    // ========================================================
    // 4. Assignment Lifecycle Transition on Video Play
    // ========================================================
    console.log('\n--- 4. Assignment Lifecycle Transition on Video Play ---');

    const pendingAssignment = await Assignment.create({
      engineer_id: testEngineer._id,
      module_id: modA._id,
      assigned_by: testEngineer._id,
      status: 'pending',
    });

    const videoReq = {
      user: testEngineer,
      params: { id: modA._id.toString() },
      body: { position_sec: 15, percent_watched: 10 },
    };
    const videoRes = mockRes();
    await saveProgress(videoReq, videoRes);

    assert(videoRes.getStatus() === 200, 'saveProgress API returned 200 OK');

    const updatedAssignment = await Assignment.findById(pendingAssignment._id);
    assert(updatedAssignment.status === 'in_progress', 'Assignment status transitioned from pending to in_progress');
    assert(updatedAssignment.started_at !== null && updatedAssignment.started_at !== undefined, 'started_at timestamp populated on assignment');

    // Clean up created test entities
    await Assignment.deleteMany({ _id: { $in: [overrideAssignment._id, pendingAssignment._id] } });
    await VideoProgress.deleteMany({ engineer_id: testEngineer._id, module_id: { $in: [modA._id, modB._id] } });
    await ModulePrerequisite.deleteOne({ _id: prereqRelation._id });
    await Question.deleteMany({ module_id: modB._id });
    await Module.deleteMany({ _id: { $in: [modA._id, modB._id] } });

    console.log('\n==================================================');
    console.log(`🏁 Phase 3 Verification Completed: ${passedTests} Passed, ${failedTests} Failed.`);
    console.log('==================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Verification Error:', error);
    process.exit(1);
  }
};

runTests();
