const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Track = require('../models/Track');
const Certificate = require('../models/Certificate');
const CertificateConfig = require('../models/CertificateConfig');
const Notification = require('../models/Notification');
const {
  generateCertificate,
  verifyCertificate,
  getCertificateConfig,
  updateCertificateConfig,
} = require('../controllers/certificateController');

const runPhase3Test = async () => {
  try {
    console.log('🔄 Connecting to MongoDB for Phase 3 Certificate Test...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edge_academy');
    console.log('✅ Connected to MongoDB');

    let admin = await User.findOne({ role: 'admin' });
    let engineer = await User.findOne({ role: 'engineer' });
    let track = await Track.findOne({ $or: [{ is_published: true }, { isPublished: true }] });


    if (!admin || !engineer || !track) {
      console.error('❌ Required seed data missing (User/Track)');
      process.exit(1);
    }

    // Clean up stale test certs and notifications for engineer to ensure fresh generation
    await Certificate.deleteMany({ $or: [{ engineer_id: engineer._id }, { userId: engineer._id }], track_id: track._id });
    await Notification.deleteMany({ recipient_id: engineer._id, type: 'certificate' });

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

    console.log('\n--- 🧪 TEST 1: Certificate Config API (GET / PUT /config) ---');
    const updateReq = {
      body: {
        director_name: 'Anya Sharma',
        director_title: 'Director, Technonex EDGE Academy',
        instructor_name: 'James Chen',
        instructor_title: 'Lead Instructor',
      },
    };
    const res1 = mockRes();
    await updateCertificateConfig(updateReq, res1);

    if (res1.getStatus() === 200 && res1.getData()?.config?.director_name === 'Anya Sharma') {
      console.log('✅ TEST 1 PASSED: Admin certificate template config updated successfully');
      console.log(`   Director: ${res1.getData().config.director_name}, Instructor: ${res1.getData().config.instructor_name}`);
    } else {
      console.error('❌ TEST 1 FAILED:', res1.getStatus(), res1.getData());
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 2: Automated Dynamic PDF Generation (generateCertificate) ---');
    const certificate = await generateCertificate(engineer._id, track._id, 'L1_CORE');

    if (certificate && certificate.certificate_id) {
      console.log('✅ TEST 2 PASSED: Certificate generated successfully');
      console.log(`   Certificate ID: ${certificate.certificate_id}`);
      console.log(`   PDF Path: ${certificate.pdf_storage_path}`);

      const fullPdfPath = path.join(__dirname, '..', certificate.pdf_storage_path);
      if (fs.existsSync(fullPdfPath)) {
        console.log(`   ✅ PDF File exists on disk (${fs.statSync(fullPdfPath).size} bytes)`);
      } else {
        console.error('❌ PDF file missing on disk!');
        process.exit(1);
      }
    } else {
      console.error('❌ TEST 2 FAILED: Certificate generation failed');
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 3: Public Verification API (GET /verify/:certificate_id) ---');
    const req3 = { params: { certificate_id: certificate.certificate_id } };
    const res3 = mockRes();
    await verifyCertificate(req3, res3);

    const verifyData = res3.getData();
    if (res3.getStatus() === 200 && verifyData.valid === true && verifyData.certificate) {
      console.log('✅ TEST 3 PASSED: Public certificate verification API verified authentic badge');
      console.log(`   Recipient: ${verifyData.certificate.engineer_id.fullName}, Status: ${verifyData.certificate.status}`);
    } else {
      console.error('❌ TEST 3 FAILED:', res3.getStatus(), verifyData);
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 4: Certificate Earned Notification Trigger ---');
    const notif = await Notification.findOne({
      recipient_id: engineer._id,
      type: 'certificate',
    }).sort({ createdAt: -1 });

    if (notif && notif.title.includes('Certificate Earned')) {
      console.log('✅ TEST 4 PASSED: In-app notification generated for certificate issuance');
      console.log(`   Title: "${notif.title}", Message: "${notif.message}"`);
    } else {
      console.error('❌ TEST 4 FAILED: Notification missing');
      process.exit(1);
    }

    console.log('\n🎉 ALL PHASE 3 CERTIFICATE ENGINE TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test execution error:', error);
    process.exit(1);
  }
};

runPhase3Test();
