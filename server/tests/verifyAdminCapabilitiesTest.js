const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');

const User = require('../models/User');
const {
  createUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  softDeleteUser,
  resendInvite,
} = require('../controllers/adminUserController');

const runTest = async () => {
  try {
    await connectDB();
    console.log('Testing Admin capabilities with updated controllers...\n');

    // 1. Find Admin user
    const adminUser = await User.findOne({ role: 'admin', is_active: true });
    assert(adminUser, 'Admin user must exist in DB');
    console.log(`✓ Admin User found: ${adminUser.email} (Role: ${adminUser.role})`);

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

    // 2. Test Create Test User
    const testEmail = `test_engineer_${Date.now()}@technonex.de`;
    const reqCreate = {
      user: adminUser,
      body: {
        fullName: 'Test Engineer',
        email: testEmail,
        password: 'Password123!',
        role: 'engineer',
        locale: 'en',
      },
    };
    const resCreate = mockRes();
    await createUser(reqCreate, resCreate);
    assert.strictEqual(resCreate.statusCode, 201, 'Admin can create user');
    const createdUserId = resCreate.data.user._id;
    console.log(`✓ Admin successfully created user: ${testEmail} (ID: ${createdUserId})`);

    // 3. Test Edit User Details (PUT /users/:id)
    const reqEdit = {
      user: adminUser,
      params: { id: createdUserId },
      body: {
        fullName: 'Test Engineer Renamed',
        locale: 'de',
      },
    };
    const resEdit = mockRes();
    await updateUser(reqEdit, resEdit);
    assert.strictEqual(resEdit.statusCode, 200, 'Admin can edit user details');
    assert.strictEqual(resEdit.data.user.full_name, 'Test Engineer Renamed', 'Name updated');
    assert.strictEqual(resEdit.data.user.locale, 'de', 'Locale updated');
    console.log(`✓ Admin successfully edited user details (Name & Locale)`);

    // 4. Test Change Role (PUT /users/:id/role)
    const reqRole = {
      user: adminUser,
      params: { id: createdUserId },
      body: {
        role: 'team_lead',
      },
    };
    const resRole = mockRes();
    await updateUserRole(reqRole, resRole);
    assert.strictEqual(resRole.statusCode, 200, 'Admin can update user role');
    assert.strictEqual(resRole.data.user.role, 'team_lead', 'Role updated to team_lead');
    console.log(`✓ Admin successfully changed user role to 'team_lead'`);

    // 5. Test Toggle Status Deactivate (PUT /users/:id/status)
    const reqStatus = {
      user: adminUser,
      params: { id: createdUserId },
      body: {
        isActive: false,
      },
    };
    const resStatus = mockRes();
    await updateUserStatus(reqStatus, resStatus);
    assert.strictEqual(resStatus.statusCode, 200, 'Admin can update user status');
    assert.strictEqual(resStatus.data.user.isActive, false, 'User deactivated');
    console.log(`✓ Admin successfully deactivated user status`);

    // 6. Test Resend Invite
    const reqResend = {
      user: adminUser,
      params: { id: createdUserId },
    };
    const resResend = mockRes();
    await resendInvite(reqResend, resResend);
    assert.strictEqual(resResend.statusCode, 200, 'Admin can resend invite');
    console.log(`✓ Admin successfully resent invite token`);

    // 7. Test Soft Delete User
    const reqDelete = {
      user: adminUser,
      params: { id: createdUserId },
    };
    const resDelete = mockRes();
    await softDeleteUser(reqDelete, resDelete);
    assert.strictEqual(resDelete.statusCode, 200, 'Admin can soft delete user');
    console.log(`✓ Admin successfully soft deleted user`);

    console.log('\n=============================================');
    console.log('🎉 ALL ADMIN USER MANAGEMENT TESTS PASSED 100%');
    console.log('=============================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
};

runTest();
