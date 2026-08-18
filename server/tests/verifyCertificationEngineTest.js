const assert = require('assert');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const Assignment = require('../models/Assignment');
const Certificate = require('../models/Certificate');
const CertificateConfig = require('../models/CertificateConfig');
const QuizAttempt = require('../models/QuizAttempt');

const {
  generateCertificate,
  getCertificateConfig,
  updateCertificateConfig,
} = require('../controllers/certificateController');
const { getTeamReport } = require('../controllers/adminReportController');
const { submitQuizAttempt } = require('../controllers/quizController');

const testCertificationEngine = async () => {
  try {
    await connectDB();
    console.log('Testing Certification Engine, ID Formatting, Dynamic Counters & Signatory Config...\n');

    // Helper mock response
    const mockRes = () => {
      const res = {
        statusCode: 200,
        data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.data = payload;
          return this;
        },
      };
      return res;
    };

    // -------------------------------------------------------------
    // SETUP TEST DATA
    // -------------------------------------------------------------
    const timestamp = Date.now();
    const testEngineer = await User.create({
      full_name: 'Alex Lee Smith',
      fullName: 'Alex Lee Smith',
      email: `alex.smith.${timestamp}@technonex.com`,
      password: 'password123',
      role: 'engineer',
      status: 'active',
      is_active: true,
    });

    const testTrack = await Track.create({
      name: 'Advanced Optical Engineering',
      title: 'Advanced Optical Engineering',
      slug: `OPTICAL-${timestamp}`,
      description: 'Comprehensive fiber optics certification track',
      is_published: true,
    });

    const testModule1 = await Module.create({
      track_id: testTrack._id,
      title: 'M1: Fiber Geometry & Core Alignment',
      slug: `mod1-${timestamp}`,
      tier: 'L1_CORE',
      video_duration_sec: 250,
      pass_threshold: 80,
    });

    // -------------------------------------------------------------
    // TEST 1: Signatory Configuration Updates (PUT /config)
    // -------------------------------------------------------------
    const reqUpdateConfig = {
      body: {
        director_name: 'Syed Hamza Mehmood',
        director_title: 'Head of Engineering & Technical Director',
        instructor_name: 'David Miller',
        instructor_title: 'Senior Optical Specialist',
      },
    };
    const resUpdateConfig = mockRes();
    await updateCertificateConfig(reqUpdateConfig, resUpdateConfig);

    assert.strictEqual(resUpdateConfig.statusCode, 200);
    assert.strictEqual(resUpdateConfig.data.config.director_name, 'Syed Hamza Mehmood');
    assert.strictEqual(resUpdateConfig.data.config.instructor_name, 'David Miller');
    console.log('✓ TEST 1 Passed: Signatory config updated to Syed Hamza Mehmood / David Miller');

    // -------------------------------------------------------------
    // TEST 2: Certificate ID Generation & Initial Extraction
    // -------------------------------------------------------------
    const cert1 = await generateCertificate(testEngineer._id, testTrack._id, 'L1_CORE');
    const year = new Date().getFullYear();

    assert(cert1.certificate_id.startsWith(`TNX-${year}-ALS-`), `Expected ID to start with TNX-${year}-ALS- but got ${cert1.certificate_id}`);
    assert.strictEqual(cert1.director_name, 'Syed Hamza Mehmood');
    assert.strictEqual(cert1.instructor_name, 'David Miller');
    console.log(`✓ TEST 2 Passed: Certificate ID format verified: ${cert1.certificate_id} with snapshot signatories`);

    // -------------------------------------------------------------
    // TEST 3: Database Unique Index & Idempotency
    // -------------------------------------------------------------
    // Attempting to generate duplicate certificate for same track+engineer should return existing
    const certDuplicate = await generateCertificate(testEngineer._id, testTrack._id, 'L1_CORE');
    assert.strictEqual(certDuplicate._id.toString(), cert1._id.toString());
    console.log('✓ TEST 3 Passed: Idempotent certificate generation returns existing active record');

    // -------------------------------------------------------------
    // TEST 4: Dynamic Real-Time Counters in Team Lead Report
    // -------------------------------------------------------------
    const testTeamLead = await User.create({
      full_name: 'Lead Maria Gomez',
      fullName: 'Lead Maria Gomez',
      email: `maria.lead.${timestamp}@technonex.com`,
      password: 'password123',
      role: 'team_lead',
      status: 'active',
      is_active: true,
    });

    // Assign engineer to this team lead
    testEngineer.team_lead_id = testTeamLead._id;
    await testEngineer.save();

    const reqTeamReport = {
      user: testTeamLead,
      params: { id: 'me' },
    };
    const resTeamReport = mockRes();
    await getTeamReport(reqTeamReport, resTeamReport);

    assert.strictEqual(resTeamReport.statusCode, 200);
    assert.strictEqual(resTeamReport.data.totalEngineers, 1);
    assert.strictEqual(resTeamReport.data.earnedCertificatesTotal, 1);
    assert.strictEqual(resTeamReport.data.engineers[0].earnedCertificatesCount, 1);
    console.log(`✓ TEST 4 Passed: Team Lead report accurately counts earnedCertificatesTotal = ${resTeamReport.data.earnedCertificatesTotal}`);

    // Clean up
    await Certificate.deleteMany({ engineer_id: testEngineer._id });
    await Module.deleteOne({ _id: testModule1._id });
    await Track.deleteOne({ _id: testTrack._id });
    await User.deleteMany({ _id: { $in: [testEngineer._id, testTeamLead._id] } });

    console.log('\n===================================================================');
    console.log('🎉 ALL CERTIFICATION ENGINE & COUNTER TESTS PASSED 100%');
    console.log('===================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
};

testCertificationEngine();
