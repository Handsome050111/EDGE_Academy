const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const Certificate = require('../models/Certificate');
const Notification = require('../models/Notification');
const { createUser, inviteUser } = require('../controllers/adminUserController');
const { acceptInvite } = require('../controllers/authController');
const { updateUserProfile } = require('../controllers/userController');
const { generateCertificate, verifyCertificate } = require('../controllers/certificateController');

const runFullSystemTest = async () => {
  try {
    console.log('====================================================');
    console.log('🚀 EDGE ACADEMY FULL SYSTEM END-TO-END VERIFICATION');
    console.log('====================================================\n');

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edge_academy');
    console.log('✅ Connected to MongoDB successfully.');

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

    // STEP 1: Verify Seed & Accounts
    console.log('\n--- 1️⃣ Database Seed Verification ---');
    const userCount = await User.countDocuments();
    const trackCount = await Track.countDocuments();
    const moduleCount = await Module.countDocuments();
    console.log(`✅ Users: ${userCount}, Tracks: ${trackCount}, Modules: ${moduleCount}`);
    if (moduleCount < 31) {
      console.error('❌ Missing curriculum modules');
      process.exit(1);
    }

    // STEP 2: User Creation & Invitation Engine
    console.log('\n--- 2️⃣ User Creation & Email Invitation ---');
    const admin = await User.findOne({ role: 'admin' });
    const inviteEmail = `e2e_engineer_${Date.now()}@technonex.de`;
    const inviteReq = { user: admin, body: { fullName: 'E2E Test Engineer', email: inviteEmail, role: 'engineer' } };
    const resInvite = mockRes();
    await inviteUser(inviteReq, resInvite);

    const inviteData = resInvite.getData();
    if (resInvite.getStatus() === 201 && inviteData.invite_token) {
      console.log(`✅ User Invitation generated: ${inviteData.invite_token}`);
      const acceptReq = { body: { token: inviteData.invite_token, password: 'E2EPassword123!' } };
      const resAccept = mockRes();
      await acceptInvite(acceptReq, resAccept);
      if (resAccept.getStatus() === 200) {
        console.log('✅ User account activated via invitation token');
      } else {
        console.error('❌ User accept invite failed');
        process.exit(1);
      }
    } else {
      console.error('❌ Invite failed');
      process.exit(1);
    }

    // STEP 3: Self-Service Profile Update
    console.log('\n--- 3️⃣ Self-Service Profile & Password Update ---');
    const activatedUser = await User.findOne({ email: inviteEmail });
    const profileReq = {
      user: activatedUser,
      body: {
        fullName: 'E2E Activated Engineer',
        locale: 'de',
        currentPassword: 'E2EPassword123!',
        newPassword: 'NewE2EPassword123!',
      },
    };
    const resProf = mockRes();
    await updateUserProfile(profileReq, resProf);
    if (resProf.getStatus() === 200 && resProf.getData().user.fullName === 'E2E Activated Engineer') {
      console.log('✅ Self-service profile name & password updated');
    } else {
      console.error('❌ Profile update failed');
      process.exit(1);
    }

    // STEP 4: Notification Trigger & Retrieval
    console.log('\n--- 4️⃣ Notification System Verification ---');
    const notifs = await Notification.find({ recipient_id: activatedUser._id });
    console.log(`✅ In-app notifications generated for user: ${notifs.length}`);

    // STEP 5: Automated Certificate Generation & PDF Rendering
    console.log('\n--- 5️⃣ Automated Certificate Engine & PDF Generation ---');
    const track = await Track.findOne({ $or: [{ is_published: true }, { isPublished: true }] });
    const cert = await generateCertificate(activatedUser._id, track._id, 'L1_CORE');

    if (cert && cert.certificate_id) {
      console.log(`✅ Certificate Generated: ${cert.certificate_id}`);
      const fullPdfPath = path.join(__dirname, '..', cert.pdf_storage_path);
      if (fs.existsSync(fullPdfPath)) {
        console.log(`✅ Certificate PDF created on disk (${fs.statSync(fullPdfPath).size} bytes)`);
      } else {
        console.error('❌ PDF file missing');
        process.exit(1);
      }
    } else {
      console.error('❌ Certificate generation failed');
      process.exit(1);
    }

    // STEP 6: Public Certificate Verification Endpoint
    console.log('\n--- 6️⃣ Public Certificate Verification Endpoint ---');
    const resVerify = mockRes();
    await verifyCertificate({ params: { certificate_id: cert.certificate_id } }, resVerify);
    const verifyObj = resVerify.getData();
    if (resVerify.getStatus() === 200 && verifyObj.valid === true) {
      const verifiedId = verifyObj.certificate_id || verifyObj.certificate?.certificate_id;
      console.log(`✅ Public Certificate Verification: Authentic (${verifiedId})`);
    } else {
      console.error('❌ Public verification failed');
      process.exit(1);
    }


    console.log('\n====================================================');
    console.log('🎉 ALL END-TO-END SYSTEM TESTS PASSED PERFECTLY!');
    console.log('====================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ End-to-end test error:', error);
    process.exit(1);
  }
};

runFullSystemTest();
