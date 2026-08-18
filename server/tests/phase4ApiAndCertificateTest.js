const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');

const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const Question = require('../models/Question');
const Certificate = require('../models/Certificate');
const VideoProgress = require('../models/VideoProgress');
const Assignment = require('../models/Assignment');

const { verifyCertificate, renderPublicVerifyPage, downloadCertificatePdf } = require('../controllers/certificateController');
const { revokeCertificate } = require('../controllers/superAdminController');
const { getUserProfile, getUserProgress } = require('../controllers/userController');
const { getActiveReviewQuiz } = require('../controllers/quizController');
const { createModule, updateModule } = require('../controllers/moduleController');
const { getModuleQuestionsAdmin } = require('../controllers/adminQuestionController');

const runTests = async () => {
  try {
    await connectDB();
    console.log('🧪 Starting Phase 4 API Normalization & Certification Verification Tests...\n');

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
      let resHtml = null;
      let downloadedFile = null;

      return {
        status: (code) => {
          resStatus = code;
          return {
            json: (data) => {
              resData = data;
              return data;
            },
            send: (content) => {
              resHtml = content;
              return content;
            },
          };
        },
        json: (data) => {
          resData = data;
          return data;
        },
        send: (content) => {
          resHtml = content;
          return content;
        },
        download: (filePath, fileName) => {
          downloadedFile = { filePath, fileName };
          return downloadedFile;
        },
        getData: () => resData,
        getStatus: () => resStatus,
        getHtml: () => resHtml,
        getDownloadedFile: () => downloadedFile,
      };
    };

    // Find test users and track
    const aliEngineer = await User.findOne({ email: 'ali.sultan@technonex.de' });
    const superAdmin = await User.findOne({ role: 'superadmin' }) || await User.findOne({ role: 'admin' });
    const testTrack = await Track.findOne({ is_published: true });

    // ========================================================
    // 1. Public Certificate Verification Contract Tests
    // ========================================================
    console.log('--- 1. Public Certificate Verification Contract Tests ---');

    const certId = `TNX-TEST-P4-${Date.now()}`;
    const dummyPdfPath = path.join(__dirname, `../uploads/certificates/${certId}.pdf`);
    fs.mkdirSync(path.dirname(dummyPdfPath), { recursive: true });
    fs.writeFileSync(dummyPdfPath, 'PDF dummy content for phase 4 testing');

    // Remove any existing cert for this test engineer + track + tier
    await Certificate.deleteMany({ engineer_id: aliEngineer._id, track_id: testTrack._id, tier: 'L2_ADVANCED' });

    const testCert = await Certificate.create({
      certificate_id: certId,
      engineer_id: aliEngineer._id,
      track_id: testTrack._id,
      tier: 'L2_ADVANCED',
      issued_at: new Date(),
      status: 'active',
      pdf_storage_path: `/uploads/certificates/${certId}.pdf`,
      director_name: 'Anya Sharma',
      instructor_name: 'James Chen',
    });


    // Test 1A: GET /api/v1/verify/:certificate_id (Canonical JSON)
    const reqVerify = { params: { certificate_id: certId } };
    const resVerify = mockRes();
    await verifyCertificate(reqVerify, resVerify);

    assert(resVerify.getStatus() === 200, 'GET /api/v1/verify/:id returns 200 OK');
    const verifyData = resVerify.getData();
    assert(verifyData.valid === true, 'Payload valid is true');
    assert(verifyData.certificate_id === certId, 'Payload certificate_id matches');
    assert(verifyData.engineer_name === (aliEngineer.full_name || aliEngineer.fullName), 'Payload engineer_name is Ali Sultan');
    assert(verifyData.track !== undefined && verifyData.tier === 'L2_ADVANCED', 'Payload track and tier populated');

    assert(verifyData.verification_url.includes(certId), 'Payload contains canonical verification_url');
    assert(verifyData.status === 'active', 'Payload status is active');

    // Test 1B: GET /verify/:certificate_id (Public HTML Page)
    const resHtml = mockRes();
    await renderPublicVerifyPage(reqVerify, resHtml);
    assert(resHtml.getStatus() === 200, 'GET /verify/:id returns 200 OK HTML');
    const htmlContent = resHtml.getHtml();
    assert(typeof htmlContent === 'string' && htmlContent.includes(certId), 'HTML contains Certificate ID');
    assert(htmlContent.includes('Official Authentic Certificate'), 'HTML contains authenticity badge');

    // Test 1C: Invalid Certificate verification
    const reqInvalid = { params: { certificate_id: 'NON_EXISTENT_ID_999' } };
    const resInvalid = mockRes();
    await verifyCertificate(reqInvalid, resInvalid);
    assert(resInvalid.getStatus() === 404, 'Invalid certificate returns 404');
    assert(resInvalid.getData()?.error?.code === 'CERTIFICATE_NOT_FOUND', 'Error code is CERTIFICATE_NOT_FOUND');

    // ========================================================
    // 2. Revoked Certificate Guard & Download Security Tests
    // ========================================================
    console.log('\n--- 2. Revoked Certificate Guard & Download Security Tests ---');

    // Test 2A: Active certificate PDF download succeeds
    const reqDownload = { params: { id: testCert._id.toString() }, user: aliEngineer };
    const resDownload = mockRes();
    await downloadCertificatePdf(reqDownload, resDownload);
    assert(resDownload.getDownloadedFile() !== null, 'Active certificate PDF download succeeds');

    // Test 2B: SuperAdmin revokes certificate
    const reqRevoke = {
      user: superAdmin,
      params: { id: testCert._id.toString() },
      body: { reason: 'Academic integrity policy violation' },
      ip: '127.0.0.1',
    };
    const resRevoke = mockRes();
    await revokeCertificate(reqRevoke, resRevoke);
    assert(resRevoke.getStatus() === 200, 'SuperAdmin successfully revokes certificate');

    // Test 2C: Verification endpoint now shows revoked status
    const resVerifyRevoked = mockRes();
    await verifyCertificate(reqVerify, resVerifyRevoked);
    const revokedVerifyData = resVerifyRevoked.getData();
    assert(revokedVerifyData.valid === false, 'Revoked certificate valid is false');
    assert(revokedVerifyData.status === 'revoked', 'Revoked certificate status is revoked');
    assert(revokedVerifyData.revocation_reason === 'Academic integrity policy violation', 'Revocation reason included in public verification');

    // Test 2D: Revoked Certificate Download blocked with 403 Forbidden
    const resDownloadRevoked = mockRes();
    await downloadCertificatePdf(reqDownload, resDownloadRevoked);
    assert(resDownloadRevoked.getStatus() === 403, 'Revoked certificate download blocked with HTTP 403 Forbidden');
    const downloadRevokedData = resDownloadRevoked.getData();
    assert(downloadRevokedData?.error?.code === 'CERTIFICATE_REVOKED', 'Error code is CERTIFICATE_REVOKED');
    assert(
      downloadRevokedData?.error?.message === 'Engineers cannot re-download a revoked certificate PDF.',
      'Exact error message returned as specified in Spec Section 8.4'
    );

    // ========================================================
    // 3. User Profile & Progress Endpoints Tests
    // ========================================================
    console.log('\n--- 3. User Profile & Progress Endpoints Tests ---');

    // Test 3A: GET /api/v1/me (Profile)
    const reqProfile = { user: aliEngineer };
    const resProfile = mockRes();
    await getUserProfile(reqProfile, resProfile);
    assert(resProfile.getStatus() === 200, 'GET /api/v1/me returns 200 OK');
    const profileData = resProfile.getData();
    assert(profileData.email === aliEngineer.email, 'Profile email matches');
    assert(profileData.password_hash === undefined && profileData.password === undefined, 'Password hash excluded from profile response');

    // Test 3B: GET /api/v1/me/progress
    const resProgress = mockRes();
    await getUserProgress(reqProfile, resProgress);
    assert(resProgress.getStatus() === 200, 'GET /api/v1/me/progress returns 200 OK');
    const progressData = resProgress.getData();
    assert(Array.isArray(progressData.tracks) && progressData.tracks.length > 0, 'Progress includes published tracks list');
    assert(progressData.total_modules_completed !== undefined, 'Progress includes total_modules_completed count');
    assert(Array.isArray(progressData.weak_concepts), 'Progress includes weak_concepts array');

    // Test 3C: GET /api/v1/review-quiz
    const resReviewState = mockRes();
    await getActiveReviewQuiz(reqProfile, resReviewState);
    assert(resReviewState.getStatus() === 200, 'GET /api/v1/review-quiz returns 200 OK');
    const reviewData = resReviewState.getData();
    assert(reviewData.active_attempt !== undefined, 'Review quiz state contains active_attempt flag');

    // ========================================================
    // 4. Admin Module & Questions CMS Endpoints Tests
    // ========================================================
    console.log('\n--- 4. Admin Module & Questions CMS Endpoints Tests ---');

    // Test 4A: POST /api/v1/admin/modules
    const reqCreateModule = {
      user: superAdmin,
      body: {
        track_id: testTrack._id,
        title: 'Phase 4 Admin Test Module',
        slug: `p4-admin-mod-${Date.now()}`,
        tier: 'L1_CORE',
        estimated_duration_min: 20,
        pass_threshold: 80,
        quiz_question_count: 6,
      },
    };
    const resCreateModule = mockRes();
    await createModule(reqCreateModule, resCreateModule);
    assert(resCreateModule.getStatus() === 201, 'POST /api/v1/admin/modules creates module (201 Created)');
    const createdMod = resCreateModule.getData();
    assert(createdMod && createdMod._id, 'Created module returned with ID');

    // Test 4B: PUT /api/v1/admin/modules/:id
    const reqUpdateModule = {
      user: superAdmin,
      params: { id: createdMod._id.toString() },
      body: { title: 'Updated Phase 4 Module Title', pass_threshold: 85 },
    };
    const resUpdateModule = mockRes();
    await updateModule(reqUpdateModule, resUpdateModule);
    assert(resUpdateModule.getStatus() === 200, 'PUT /api/v1/admin/modules/:id updates module (200 OK)');
    assert(resUpdateModule.getData()?.title === 'Updated Phase 4 Module Title', 'Updated title persisted');

    // Test 4C: GET /api/v1/admin/modules/:id/questions
    // Create a question for this module first
    await Question.create({
      module_id: createdMod._id,
      question_text: 'Admin CMS question test?',
      option_a: 'A',
      option_b: 'B',
      option_c: 'C',
      option_d: 'D',
      correct_option: 'A',
      concept_tag: 'admin_test_tag',
    });

    const reqGetQuestions = { user: superAdmin, params: { id: createdMod._id.toString() } };
    const resGetQuestions = mockRes();
    await getModuleQuestionsAdmin(reqGetQuestions, resGetQuestions);
    assert(resGetQuestions.getStatus() === 200, 'GET /api/v1/admin/modules/:id/questions returns 200 OK');
    const questionsList = resGetQuestions.getData();
    assert(Array.isArray(questionsList) && questionsList.length === 1, 'Returns active questions for CMS editing');
    assert(questionsList[0].question_text === 'Admin CMS question test?', 'Question text matches');

    // Clean up created test entities
    await Certificate.deleteOne({ _id: testCert._id });
    if (fs.existsSync(dummyPdfPath)) {
      fs.unlinkSync(dummyPdfPath);
    }
    await Question.deleteMany({ module_id: createdMod._id });
    await Module.deleteOne({ _id: createdMod._id });

    console.log('\n==================================================');
    console.log(`🏁 Phase 4 Verification Completed: ${passedTests} Passed, ${failedTests} Failed.`);
    console.log('==================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Verification Error:', error);
    process.exit(1);
  }
};

runTests();
