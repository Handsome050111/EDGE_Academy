const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../../models/User');
const Module = require('../../models/Module');
const Track = require('../../models/Track');
const Assignment = require('../../models/Assignment');
const Question = require('../../models/Question');
const VideoProgress = require('../../models/VideoProgress');

async function setupLoadTestContext() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  // 1. Find or create a dedicated load-test engineer
  const testEmail = 'loadtest.engineer@technonex.de';
  let testUser = await User.findOne({ email: testEmail });

  if (!testUser) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash('LoadTest123!', salt);
    testUser = await User.create({
      full_name: 'Load Test Engineer',
      email: testEmail,
      password_hash,
      role: 'engineer',
      status: 'active',
      is_active: true,
      locale: 'en',
    });
  }

  // 2. Find a valid module with questions for quiz testing
  let testModule = await Module.findOne({ deleted_at: null, status: 'published' });
  if (!testModule) {
    testModule = await Module.findOne({ deleted_at: null });
  }

  if (!testModule) {
    // Create a fallback track & module if none exist
    let track = await Track.findOne();
    if (!track) {
      track = await Track.create({
        name: 'EDGE Core Qualification',
        slug: 'EDGE-CORE',
        is_published: true,
      });
    }
    testModule = await Module.create({
      title: 'Load Test Safety & Protocols',
      track_id: track._id,
      status: 'published',
      pass_threshold: 80,
      quiz_question_count: 5,
    });
    track.modules = [testModule._id];
    await track.save();
  }

  // Ensure questions exist for this module
  const questionCount = await Question.countDocuments({ module_id: testModule._id, is_active: true });
  if (questionCount < 5) {
    const sampleQuestions = [
      {
        module_id: testModule._id,
        question_text: 'What is the required standard for DGUV V3 safety inspections?',
        option_a: 'Annual visual and electrical measurement check',
        option_b: 'Monthly optical fiber inspection',
        option_c: 'Random sample testing',
        option_d: 'Informal verbal assessment',
        correct_option: 'A',
        explanation: 'DGUV V3 requires strict annual electrical measurements.',
        concept_tag: 'electrical_safety',
        difficulty: 'medium',
      },
      {
        module_id: testModule._id,
        question_text: 'What is the maximum acceptable insertion loss for single-mode fiber splice?',
        option_a: '0.05 dB',
        option_b: '1.5 dB',
        option_c: '3.0 dB',
        option_d: '5.0 dB',
        correct_option: 'A',
        explanation: 'Telco standard splice loss is <= 0.05 dB.',
        concept_tag: 'fiber_optics',
        difficulty: 'hard',
      },
      {
        module_id: testModule._id,
        question_text: 'Which tool is used to verify Cat6A cabling performance up to 500MHz?',
        option_a: 'Fluke DSX CableAnalyzer',
        option_b: 'Simple Tone Generator',
        option_c: 'Visual Fault Locator',
        option_d: 'Multimeter',
        correct_option: 'A',
        explanation: 'Fluke DSX performs Level 2e certified measurements.',
        concept_tag: 'structured_cabling',
        difficulty: 'medium',
      },
      {
        module_id: testModule._id,
        question_text: 'What is the primary objective of ESD ground straps on site?',
        option_a: 'Dissipate static charges to protect sensitive ICs',
        option_b: 'Prevent high voltage AC electrocution',
        option_c: 'Improve Wi-Fi signal reception',
        option_d: 'Ground structural steel beams',
        correct_option: 'A',
        explanation: 'ESD straps prevent electrostatic discharge damage.',
        concept_tag: 'rack_installation',
        difficulty: 'easy',
      },
      {
        module_id: testModule._id,
        question_text: 'What is the standard rack unit height (1U) in inches and mm?',
        option_a: '1.75 inches (44.45 mm)',
        option_b: '2.00 inches (50.80 mm)',
        option_c: '1.50 inches (38.10 mm)',
        option_d: '2.25 inches (57.15 mm)',
        correct_option: 'A',
        explanation: '1U is standardized at 1.75 inches / 44.45 mm.',
        concept_tag: 'rack_installation',
        difficulty: 'easy',
      },
    ];
    await Question.insertMany(sampleQuestions);
  }

  // 3. Ensure assignment exists for this engineer
  let assignment = await Assignment.findOne({
    engineer_id: testUser._id,
    module_id: testModule._id,
  });
  if (!assignment) {
    assignment = await Assignment.create({
      engineer_id: testUser._id,
      module_id: testModule._id,
      assigned_by: testUser._id,
      status: 'in_progress',
    });
  }

  // 4. Ensure video progress is at 100% so quiz start prerequisite passes
  await VideoProgress.findOneAndUpdate(
    { engineer_id: testUser._id, module_id: testModule._id },
    {
      position_sec: 600,
      percent_watched: 100,
      completed: true,
      last_watched_at: new Date(),
    },
    { upsert: true, new: true }
  );

  // 5. Generate signed JWT token
  const token = jwt.sign(
    { id: testUser._id, role: testUser.role },
    process.env.JWT_SECRET || 'edge_academy_jwt_super_secret_key_2026',
    { expiresIn: '7d' }
  );

  return {
    user: testUser,
    token,
    moduleId: testModule._id.toString(),
  };
}

module.exports = { setupLoadTestContext };
