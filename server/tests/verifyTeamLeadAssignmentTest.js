const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const Assignment = require('../models/Assignment');
const { createAssignments } = require('../controllers/adminAssignmentController');

const testTeamLeadAssignment = async () => {
  try {
    await connectDB();
    console.log('Testing Entire Team / Team Lead assignment...\n');

    // 1. Find Admin user
    const adminUser = await User.findOne({ role: 'admin', is_active: true });
    assert(adminUser, 'Admin user must exist');

    // 2. Create or find a Module
    let testTrack = await Track.findOne();
    if (!testTrack) {
      testTrack = await Track.create({
        name: 'Test Assignment Track',
        slug: 'TEST-ASSIGN-TRACK',
        description: 'Testing track',
        is_published: true,
      });
    }

    let testModule = await Module.findOne({ track_id: testTrack._id });
    if (!testModule) {
      testModule = await Module.create({
        track_id: testTrack._id,
        title: 'M1: Test Assignment Module',
        slug: 'm1-test-assign',
        tier: 'L1_CORE',
        status: 'published',
        pass_threshold: 80,
        created_by: adminUser._id,
      });
    }

    // 3. Create a Team Lead
    const leadEmail = `lead_test_${Date.now()}@technonex.de`;
    const teamLead = await User.create({
      full_name: 'Hamza Lead',
      email: leadEmail,
      password_hash: 'hash123',
      role: 'team_lead',
      locale: 'en',
      is_active: true,
      status: 'active',
    });
    console.log(`✓ Created Team Lead: ${teamLead.full_name} (${teamLead.email})`);

    // 4. Create 2 Engineers assigned to this Team Lead
    const eng1 = await User.create({
      full_name: 'Engineer Alpha',
      email: `eng_alpha_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'engineer',
      team_lead_id: teamLead._id,
      locale: 'en',
      is_active: true,
      status: 'active',
    });

    const eng2 = await User.create({
      full_name: 'Engineer Beta',
      email: `eng_beta_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'engineer',
      team_lead_id: teamLead._id,
      locale: 'en',
      is_active: true,
      status: 'active',
    });
    console.log(`✓ Created 2 Engineers assigned under Team Lead: ${eng1.email}, ${eng2.email}`);

    // 5. Test POST /api/v1/admin/assignments with team_lead_id
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

    const req = {
      user: adminUser,
      body: {
        module_id: testModule._id,
        team_lead_id: teamLead._id,
        deadline_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    };

    const res = mockRes();
    await createAssignments(req, res);
    assert.strictEqual(res.statusCode, 201, `Status should be 201, got ${res.statusCode}`);
    console.log(`✓ Assignment created successfully for team: ${res.data.message}, Count: ${res.data.createdCount}`);
    assert.strictEqual(res.data.createdCount, 2, 'Should create assignments for both engineers under this team lead');

    // Clean up test records
    await User.deleteMany({ _id: { $in: [teamLead._id, eng1._id, eng2._id] } });
    await Assignment.deleteMany({ module_id: testModule._id });
    console.log('✓ Cleaned up test records');

    console.log('\n======================================================');
    console.log('🎉 TEAM LEAD OVERALL TEAM ASSIGNMENT TEST PASSED 100%');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
};

testTeamLeadAssignment();
