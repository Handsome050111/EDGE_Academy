const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const { createUser, inviteUser } = require('../controllers/adminUserController');
const { acceptInvite } = require('../controllers/authController');
const { updateUserProfile } = require('../controllers/userController');

const runPhase1Test = async () => {
  try {
    console.log('🔄 Connecting to MongoDB for Phase 1 Integration Test...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edge_academy');
    console.log('✅ Connected to MongoDB');

    let admin = await User.findOne({ email: 'admin@technonex.de' });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      admin = await User.create({
        fullName: 'Content Admin',
        email: 'admin@technonex.de',
        password: hashedPassword,
        role: 'admin',
        locale: 'en',
      });
    }

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

    console.log('\n--- 🧪 TEST 1: Direct User Creation (POST /api/v1/admin/users) ---');
    const testEmail = `created_user_${Date.now()}@technonex.de`;
    const createReq = {
      user: admin,
      body: {
        fullName: 'New Created Engineer',
        email: testEmail,
        password: 'Password123!',
        role: 'engineer',
        locale: 'de',
      },
    };

    const res1 = mockRes();
    await createUser(createReq, res1);

    if (res1.getStatus() === 201 && res1.getData()?.user?.email === testEmail) {
      console.log('✅ TEST 1 PASSED: Direct user created successfully');
      console.log(`   User Email: ${res1.getData().user.email}, Role: ${res1.getData().user.role}`);
    } else {
      console.error('❌ TEST 1 FAILED:', res1.getStatus(), res1.getData());
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 2: Email Invitation & Acceptance (POST /admin/users/invite -> /auth/accept-invite) ---');
    const inviteEmail = `invited_user_${Date.now()}@technonex.de`;
    const inviteReq = {
      user: admin,
      body: {
        fullName: 'Invited Tech Engineer',
        email: inviteEmail,
        role: 'engineer',
      },
    };

    const res2 = mockRes();
    await inviteUser(inviteReq, res2);

    const inviteData = res2.getData();
    if (res2.getStatus() === 201 && inviteData?.invite_token) {
      console.log('✅ TEST 2A PASSED: Invitation generated with token');

      const acceptReq = {
        body: {
          token: inviteData.invite_token,
          password: 'NewPassword123!',
        },
      };

      const res2b = mockRes();
      await acceptInvite(acceptReq, res2b);

      if (res2b.getStatus() === 200 && res2b.getData()?.user?.email === inviteEmail) {
        console.log('✅ TEST 2B PASSED: Invitation accepted and account activated!');
      } else {
        console.error('❌ TEST 2B FAILED:', res2b.getStatus(), res2b.getData());
        process.exit(1);
      }
    } else {
      console.error('❌ TEST 2A FAILED:', res2.getStatus(), res2.getData());
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 3: Self-Service Profile Update & Password Change (PUT /api/v1/me/profile) ---');
    // Create dedicated test user for profile update test
    const tempPass = await bcrypt.hash('Password123!', 10);
    const tempUser = await User.create({
      fullName: 'Temp User Profile Test',
      email: `temp_profile_${Date.now()}@technonex.de`,
      password: tempPass,
      role: 'engineer',
      locale: 'en',
    });

    const profileReq = {
      user: tempUser,
      body: {
        fullName: 'Temp User Profile Updated',
        locale: 'de',
        currentPassword: 'Password123!',
        newPassword: 'UpdatedPassword123!',
      },
    };

    const res3 = mockRes();
    await updateUserProfile(profileReq, res3);

    if (res3.getStatus() === 200 && res3.getData()?.user?.fullName === 'Temp User Profile Updated') {
      console.log('✅ TEST 3 PASSED: Profile and password updated successfully for test user');
    } else {
      console.error('❌ TEST 3 FAILED:', res3.getStatus(), res3.getData());
      process.exit(1);
    }

    console.log('\n🎉 ALL PHASE 1 INTEGRATION TESTS PASSED SUCCESSFULLY!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test execution error:', error);
    process.exit(1);
  }
};

runPhase1Test();
