const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const VideoProgress = require('../models/VideoProgress');
const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');

const runVerification = async () => {
  try {
    console.log('🔄 Connecting to MongoDB for Engineer Security Guards test...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edge_academy');
    console.log('✅ Connected to MongoDB');

    // 1. Get or create test engineer user
    let engineer = await User.findOne({ email: 'test_guard_engineer@technonex.com' });
    if (!engineer) {
      engineer = await User.create({
        fullName: 'Guard Test Engineer',
        email: 'test_guard_engineer@technonex.com',
        password: 'hashedpassword',
        role: 'engineer',
      });
    }

    // 2. Get or create test track
    let testTrack = await Track.findOne({ title: 'Security Guard Test Track' });
    if (!testTrack) {
      testTrack = await Track.create({
        title: 'Security Guard Test Track',
        code: 'SEC-GUARD-101',
        description: 'Track for testing security guards',
        tier: 'L1_CORE',
      });
    }

    // 3. Get or create test module
    let testModule = await Module.findOne({ title: 'Test Security Guard Module' });
    if (!testModule) {
      testModule = await Module.create({
        trackId: testTrack._id,
        title: 'Test Security Guard Module',
        slug: 'test-security-guard-module',
        description: 'Module for testing backend security guards',
        tier: 'L1_CORE',
        video_provider_id: 'test_cloudflare_uid_123',
        pass_threshold: 80,
        status: 'published',
      });
    }

    // Add 5 questions if none exist
    const qCount = await Question.countDocuments({ moduleId: testModule._id });
    if (qCount < 5) {
      for (let i = 1; i <= 5; i++) {
        await Question.create({
          moduleId: testModule._id,
          question_text: `Test Question ${i}?`,
          option_a: 'Option A',
          option_b: 'Option B',
          option_c: 'Option C',
          option_d: 'Option D',
          correct_option: 'A',
          difficulty: 'medium',
          concept_tag: 'test_concept',
          is_active: true,
        });
      }
    }

    console.log('\n--- 🧪 TEST 1: Video 95% Watch Guard (Under 95% watched) ---');
    // Clear video progress and existing attempts for test module
    await VideoProgress.deleteMany({ engineer_id: engineer._id, module_id: testModule._id });
    await QuizAttempt.deleteMany({ engineer_id: engineer._id, module_id: testModule._id });
    await QuizAttempt.deleteMany({ userId: engineer._id, moduleId: testModule._id });

    // Set video progress to 45%
    await VideoProgress.create({
      engineer_id: engineer._id,
      module_id: testModule._id,
      position_sec: 45,
      percent_watched: 45,
      completed: false,
    });

    const startTopicQuizLogic = require('../controllers/quizController').startTopicQuiz;

    // Mock Express req and res objects
    let resStatus = null;
    let resJson = null;

    const mockReq = {
      params: { id: testModule._id.toString() },
      user: { _id: engineer._id },
    };

    const mockRes = {
      status: (code) => {
        resStatus = code;
        return {
          json: (data) => {
            resJson = data;
            return data;
          },
        };
      },
      json: (data) => {
        resJson = data;
        return data;
      },
    };

    await startTopicQuizLogic(mockReq, mockRes);

    if (resStatus === 403 && resJson?.error?.code === 'VIDEO_INCOMPLETE') {
      console.log('✅ TEST 1 PASSED: Quiz start blocked with 403 Forbidden because video is 45% watched (<95%)');
      console.log('   Response Payload:', JSON.stringify(resJson));
    } else {
      console.error('❌ TEST 1 FAILED: Expected 403 VIDEO_INCOMPLETE, got status:', resStatus, resJson);
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 2: Video 95% Watch Guard (95%+ watched) ---');
    await VideoProgress.findOneAndUpdate(
      { engineer_id: engineer._id, module_id: testModule._id },
      { $set: { percent_watched: 98, completed: true } }
    );

    resStatus = 200;
    resJson = null;
    await startTopicQuizLogic(mockReq, mockRes);

    if (resJson?.attempt_id && resJson?.questions?.length > 0) {
      console.log('✅ TEST 2 PASSED: Quiz start succeeded when video is 98% watched');
      console.log(`   Attempt ID: ${resJson.attempt_id}, Questions Count: ${resJson.questions.length}`);
    } else {
      console.error('❌ TEST 2 FAILED: Expected quiz start success, got:', resStatus, resJson);
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 3: 15-Minute Retake Cooldown Guard ---');
    // Create a failed quiz attempt completed 2 minutes ago
    await QuizAttempt.deleteMany({ engineer_id: engineer._id, module_id: testModule._id });
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);

    await QuizAttempt.create({
      engineer_id: engineer._id,
      quiz_type: 'topic',
      module_id: testModule._id,
      passed: false,
      score_percent: 40,
      completed_at: twoMinsAgo,
    });

    resStatus = null;
    resJson = null;
    await startTopicQuizLogic(mockReq, mockRes);

    if (resStatus === 429 && resJson?.error?.code === 'COOLDOWN_ACTIVE') {
      console.log('✅ TEST 3 PASSED: Quiz start blocked with 429 Too Many Requests due to active 15-min cooldown');
      console.log('   Response Payload:', JSON.stringify(resJson));
      console.log(`   Remaining Cooldown Seconds: ${resJson.error.cooldown_remaining_seconds}s (~13 mins)`);
    } else {
      console.error('❌ TEST 3 FAILED: Expected 429 COOLDOWN_ACTIVE, got status:', resStatus, resJson);
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 4: Cloudflare Stream 4-Hour Signed URL Expiry ---');
    const getModuleByIdLogic = require('../controllers/moduleController').getModuleById;

    resStatus = 200;
    resJson = null;
    await getModuleByIdLogic(mockReq, mockRes);

    if (resJson?.signed_video_url && resJson?.expires_in_seconds === 14400) {
      console.log('✅ TEST 4 PASSED: Module controller returned 4-hour signed video URL');
      console.log(`   Signed Video URL: ${resJson.signed_video_url}`);
      console.log(`   URL Expires At: ${resJson.url_expires_at} (14400s / 4h window)`);
    } else {
      console.error('❌ TEST 4 FAILED: Expected signed_video_url with 14400s expiry, got:', resJson);
      process.exit(1);
    }

    console.log('\n🎉 ALL SECURITY GUARD VERIFICATION TESTS PASSED SUCCESSFULLY!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test execution error:', error);
    process.exit(1);
  }
};

runVerification();
