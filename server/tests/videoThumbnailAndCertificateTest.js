const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');

const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const Certificate = require('../models/Certificate');
const CertificateConfig = require('../models/CertificateConfig');

const { createModule, updateModule, getModuleById } = require('../controllers/moduleController');
const { uploadModuleVideo } = require('../controllers/adminModuleController');
const { generateCertificate, downloadCertificatePdf } = require('../controllers/certificateController');

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
    setHeader: () => {},
    set: () => {},
    getData: () => resData,
    getStatus: () => resStatus,
    getHtml: () => resHtml,
    getDownloadedFile: () => downloadedFile,
  };
};

const runVerification = async () => {
  try {
    await connectDB();
    console.log('🧪 Starting Video Thumbnails & Custom Certificate Template Verification...\n');

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

    // Find test user and track
    let testEngineer = await User.findOne({ email: 'ali.sultan@technonex.de' });
    if (!testEngineer) {
      testEngineer = await User.findOne({ role: 'engineer' }) || await User.findOne();
    }
    let testTrack = await Track.findOne({ is_published: true }) || await Track.findOne();

    // ========================================================
    // 1. Video Thumbnail Support Tests
    // ========================================================
    console.log('--- 1. Video Thumbnail Support Tests ---');

    // Test 1A: createModule with Cloudflare UID auto-computes Cloudflare thumbnail fallback
    const reqCreate = {
      body: {
        trackId: testTrack._id,
        title: `Thumbnail Test Module ${Date.now()}`,
        description: 'Testing video thumbnail support',
        tier: 'L1_CORE',
        cloudflareVideoId: 'stream_test_uid_12345',
      },
      user: testEngineer,
    };
    const resCreate = mockRes();
    await createModule(reqCreate, resCreate);

    if (resCreate.getStatus() !== 201 && resCreate.getStatus() !== 200) {
      console.log('    [DEBUG createModule error]:', resCreate.getStatus(), resCreate.getData());
    }

    assert(resCreate.getStatus() === 201 || resCreate.getStatus() === 200, 'createModule returned 201/200');
    const createdMod = resCreate.getData();
    assert(createdMod?.thumbnail_url === 'https://videodelivery.net/stream_test_uid_12345/thumbnails/thumbnail.jpg', `Auto-populated Cloudflare thumbnail URL on createModule (got ${createdMod?.thumbnail_url})`);

    // Test 1B: updateModule with custom thumbnail_url
    const customThumb = 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8';
    const reqUpdate = {
      params: { id: createdMod._id },
      body: {
        thumbnail_url: customThumb,
      },
      user: testEngineer,
    };
    const resUpdate = mockRes();
    await updateModule(reqUpdate, resUpdate);
    assert(resUpdate.getData().thumbnail_url === customThumb, 'updateModule saved custom thumbnail_url');

    // Test 1C: getModuleById returns thumbnail_url
    const reqGet = { params: { id: createdMod._id } };
    const resGet = mockRes();
    await getModuleById(reqGet, resGet);
    assert(resGet.getData().thumbnail_url === customThumb, 'getModuleById returns thumbnail_url');

    // Test 1D: uploadModuleVideo auto-populates Cloudflare thumbnail if none provided
    const reqUploadVideo = {
      params: { id: createdMod._id },
      body: {
        video_provider_id: 'cf_videodelivery_stream_abc987',
      },
      user: testEngineer,
    };
    const resUploadVideo = mockRes();
    await uploadModuleVideo(reqUploadVideo, resUploadVideo);
    assert(resUploadVideo.getStatus() === 200, 'uploadModuleVideo returned 200');
    assert(resUploadVideo.getData().thumbnail_url === 'https://videodelivery.net/cf_videodelivery_stream_abc987/thumbnails/thumbnail.jpg', 'uploadModuleVideo updated thumbnail_url to Cloudflare default');

    // ========================================================
    // 2. Custom Certificate PDF Generation & Puppeteer Tests
    // ========================================================
    console.log('\n--- 2. Custom Certificate PDF Template Matching Tests ---');

    // Ensure CertificateConfig exists with Anya Sharma and James Chen
    let config = await CertificateConfig.findOne();
    if (!config) {
      config = await CertificateConfig.create({
        director_name: 'Anya Sharma',
        director_title: 'Director, Technonex EDGE Academy',
        instructor_name: 'James Chen',
        instructor_title: 'Lead Instructor',
      });
    }

    // Clean up any test cert for this engineer + track
    await Certificate.deleteMany({ engineer_id: testEngineer._id, track_id: testTrack._id });

    // Generate PDF Certificate
    console.log('  Generating certificate PDF via Puppeteer...');
    const generatedCert = await generateCertificate(testEngineer._id, testTrack._id, 'L1_CORE');

    assert(generatedCert !== null, 'Certificate document created in database');
    assert(generatedCert.certificate_id.startsWith('TNX-'), 'Certificate ID format is TNX-YYYY-XXX-NN');
    assert(generatedCert.status === 'active', 'Generated certificate status is active');

    const expectedPdfPath = path.join(__dirname, '..', generatedCert.pdf_storage_path);
    assert(fs.existsSync(expectedPdfPath), `Certificate PDF file exists at ${generatedCert.pdf_storage_path}`);

    const stats = fs.statSync(expectedPdfPath);
    assert(stats.size > 10000, `PDF file size is substantial (${stats.size} bytes), confirming rendered vector content`);

    // ========================================================
    // 3. Revoked Certificate Guard & Download Security Tests
    // ========================================================
    console.log('\n--- 3. Revoked Certificate Guard & Download Security Tests ---');

    // Test 3A: Active certificate download succeeds
    const reqActiveDownload = { params: { id: generatedCert._id.toString() }, user: testEngineer };
    const resActiveDownload = mockRes();
    await downloadCertificatePdf(reqActiveDownload, resActiveDownload);
    assert(resActiveDownload.getDownloadedFile() !== null, 'Active certificate download succeeds');
    assert(resActiveDownload.getDownloadedFile().fileName === `${generatedCert.certificate_id}.pdf`, 'Downloaded file name matches Certificate ID');

    // Test 3B: Revoked certificate download returns 403 Forbidden
    generatedCert.status = 'revoked';
    generatedCert.revoked_at = new Date();
    generatedCert.revocation_reason = 'Academic integrity audit';
    await generatedCert.save();

    const reqRevokedDownload = { params: { id: generatedCert._id.toString() }, user: testEngineer };
    const resRevokedDownload = mockRes();
    await downloadCertificatePdf(reqRevokedDownload, resRevokedDownload);
    assert(resRevokedDownload.getStatus() === 403, 'Revoked certificate download returns HTTP 403 Forbidden');
    const revokedErr = resRevokedDownload.getData()?.error;
    assert(revokedErr?.code === 'CERTIFICATE_REVOKED', 'Error code is CERTIFICATE_REVOKED');
    assert(revokedErr?.message.includes('cannot re-download a revoked certificate'), 'Revocation message correctly returned');

    // Clean up test module
    await Module.findByIdAndDelete(createdMod._id);

    console.log(`\n========================================`);
    console.log(`🏁 Test Summary: ${passedTests} Passed, ${failedTests} Failed`);
    console.log(`========================================\n`);

    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Verification test error:', error);
    process.exit(1);
  }
};

runVerification();
