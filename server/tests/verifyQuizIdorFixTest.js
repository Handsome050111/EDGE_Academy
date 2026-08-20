const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Module = require('../models/Module');
const QuizAttempt = require('../models/QuizAttempt');
const AttemptResponse = require('../models/AttemptResponse');
const ConceptScore = require('../models/ConceptScore');
const Assignment = require('../models/Assignment');
const { submitQuizAttempt } = require('../controllers/quizController');

async function runTest() {
  await connectDB();

  try {
    // 1. Create or find Engineer A and Engineer B
    let engineerA = await User.findOne({ email: 'idor_test_eng_a@example.com' });
    if (!engineerA) {
      engineerA = await User.create({
        fullName: 'IDOR Test Engineer A',
        email: 'idor_test_eng_a@example.com',
        role: 'engineer',
        password_hash: 'hashedpassword',
      });
    }

    let engineerB = await User.findOne({ email: 'idor_test_eng_b@example.com' });
    if (!engineerB) {
      engineerB = await User.create({
        fullName: 'IDOR Test Engineer B',
        email: 'idor_test_eng_b@example.com',
        role: 'engineer',
        password_hash: 'hashedpassword',
      });
    }

    // 2. Find any test module
    let testModule = await Module.findOne();

    // 3. Create a QuizAttempt belonging to Engineer A
    const attemptA = await QuizAttempt.create({
      engineer_id: engineerA._id,
      quiz_type: 'topic',
      module_id: testModule._id,
      started_at: new Date(),
      status: 'in_progress',
    });

    console.log(`Created QuizAttempt ${attemptA._id} for Engineer A (${engineerA.email})`);

    // 4. Test IDOR Attempt: Engineer B attempts to submit Engineer A's attempt
    const reqB = {
      params: { id: attemptA._id.toString() },
      user: { _id: engineerB._id, role: 'engineer' },
      body: { answers: [] },
    };

    let statusCode = 200;
    let responseData = null;
    const resB = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await submitQuizAttempt(reqB, resB);

    console.log('Engineer B submitting Engineer A attempt result status:', statusCode);
    console.log('Response body:', responseData);

    if (statusCode === 403 && responseData?.error?.code === 'FORBIDDEN') {
      console.log('✅ TEST PASSED: Engineer B was blocked with 403 FORBIDDEN when attempting to submit Engineer A quiz attempt.');
    } else {
      console.error('❌ TEST FAILED: Expected 403 FORBIDDEN, received status:', statusCode);
      process.exit(1);
    }

    // Confirm no AttemptResponse records were created
    const responses = await AttemptResponse.find({ attempt_id: attemptA._id });
    if (responses.length === 0) {
      console.log('✅ TEST PASSED: No AttemptResponses or side-effects were created.');
    } else {
      console.error('❌ TEST FAILED: AttemptResponses were created unexpectedly.');
      process.exit(1);
    }

    // Confirm attempt is still in_progress
    const freshAttempt = await QuizAttempt.findById(attemptA._id);
    if (freshAttempt.status === 'in_progress') {
      console.log('✅ TEST PASSED: Attempt status remains untouched as in_progress.');
    } else {
      console.error('❌ TEST FAILED: Attempt status changed unexpectedly to:', freshAttempt.status);
      process.exit(1);
    }

    // 5. Test Owner Submission: Engineer A submits their own attempt
    const reqA = {
      params: { id: attemptA._id.toString() },
      user: { _id: engineerA._id, role: 'engineer' },
      body: { answers: [] },
    };

    let statusCodeA = 200;
    let responseDataA = null;
    const resA = {
      status(code) {
        statusCodeA = code;
        return this;
      },
      json(data) {
        responseDataA = data;
        return this;
      },
    };

    await submitQuizAttempt(reqA, resA);

    console.log('Engineer A submitting own attempt result status:', statusCodeA);
    if (statusCodeA === 200 && responseDataA?.passed !== undefined) {
      console.log('✅ TEST PASSED: Engineer A successfully submitted their own attempt.');
    } else {
      console.error('❌ TEST FAILED: Engineer A submission failed with status:', statusCodeA);
      process.exit(1);
    }

    // Clean up test data
    await QuizAttempt.deleteMany({ _id: attemptA._id });
    await User.deleteMany({ _id: { $in: [engineerA._id, engineerB._id] } });
    console.log('Test clean-up complete.');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
