const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Track = require('../models/Track');
const Certificate = require('../models/Certificate');

const runIntegrationTest = async () => {
  try {
    console.log('🔄 Connecting to MongoDB for Dashboard Integration Test...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edge_academy');
    console.log('✅ Connected to MongoDB');

    // 1. Get or create test user
    let engineer = await User.findOne({ email: 'dashboard_integration_user@technonex.com' });
    if (!engineer) {
      engineer = await User.create({
        fullName: 'Integration Test Engineer',
        email: 'dashboard_integration_user@technonex.com',
        password: 'hashedpassword',
        role: 'engineer',
      });
    }

    // 2. Test GET /api/v1/me/dashboard controller logic directly
    const getLearnerDashboardLogic = require('../controllers/dashboardController').getLearnerDashboard;

    let resStatus = null;
    let resJson = null;

    const mockReq = {
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

    console.log('\n--- 🧪 TEST 1: GET /api/v1/me/dashboard Aggregator Endpoint ---');
    await getLearnerDashboardLogic(mockReq, mockRes);

    if (resJson && Array.isArray(resJson.enrolledTracks) && resJson.reviewQuizStatus !== undefined) {
      console.log('✅ TEST 1 PASSED: Dashboard aggregator returned expected payload structure');
      console.log('   Enrolled Tracks Count:', resJson.enrolledTracks.length);
      console.log('   Review Quiz Eligibility Status:', JSON.stringify(resJson.reviewQuizStatus));
      console.log('   Active Module Present:', resJson.activeModule ? resJson.activeModule.title : 'None (no modules seeded yet)');
    } else {
      console.error('❌ TEST 1 FAILED: Unexpected dashboard payload:', resStatus, resJson);
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 2: GET /api/v1/certificates/verify/:id Endpoint ---');
    const verifyCertificateLogic = require('../controllers/certificateController').verifyCertificate;

    // Drop stale index if present and clean up test cert
    await Certificate.collection.dropIndex('certificateId_1').catch(() => {});
    const testCertId = 'TNX-2026-INT-01';
    await Certificate.deleteMany({ certificate_id: testCertId });

    let testTrack = await Track.findOne();
    if (!testTrack) {
      testTrack = await Track.create({
        title: 'Integration Test Track',
        code: 'INT-101',
        tier: 'L1_CORE',
      });
    }

    await Certificate.create({
      certificate_id: testCertId,
      certificateId: testCertId,
      engineer_id: engineer._id,
      track_id: testTrack._id,
      tier: 'L1_CORE',
      status: 'active',
      pdf_storage_path: '/uploads/certificates/test.pdf',
    });

    const verifyReq = {
      params: { certificate_id: testCertId },
    };

    resStatus = null;
    resJson = null;
    await verifyCertificateLogic(verifyReq, mockRes);

    if (resJson && resJson.valid === true && (resJson.certificate?.certificate_id === testCertId || resJson.certificate?.certificateId === testCertId)) {
      console.log('✅ TEST 2 PASSED: Certificate verification returned valid active certificate');
      console.log('   Verified Cert ID:', resJson.certificate.certificate_id || resJson.certificate.certificateId);
    } else {
      console.error('❌ TEST 2 FAILED: Expected valid certificate, got:', resJson);
      process.exit(1);
    }

    console.log('\n🎉 ALL DASHBOARD INTEGRATION TESTS PASSED SUCCESSFULLY!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test execution error:', error);
    process.exit(1);
  }
};

runIntegrationTest();
