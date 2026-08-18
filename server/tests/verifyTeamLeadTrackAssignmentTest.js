const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Team = require('../models/Team');
const Track = require('../models/Track');
const Module = require('../models/Module');
const Assignment = require('../models/Assignment');
const Progress = require('../models/Progress');
const Notification = require('../models/Notification');
const { createAssignments } = require('../controllers/adminAssignmentController');

const runTest = async () => {
  try {
    await connectDB();
    console.log('Testing Team Lead Track Assignments & Dual Notifications...\n');

    // 1. Setup Team & Team Lead
    const teamLead = await User.create({
      full_name: 'Lead Tester',
      email: `lead_track_test_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'team_lead',
      is_active: true,
      status: 'active',
    });

    const testTeam = await Team.create({
      name: 'Alpha Squad',
      region: 'EMEA',
      lead_user_id: teamLead._id,
    });

    teamLead.team_id = testTeam._id;
    await teamLead.save();
    console.log(`✓ Created Team Lead: ${teamLead.full_name} (${teamLead.email}) on team ${testTeam.name}`);

    // 2. Setup 2 Squad Engineers + 1 Outside Engineer
    const squadEng1 = await User.create({
      full_name: 'Squad Engineer 1',
      email: `squad1_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'engineer',
      team_id: testTeam._id,
      team_lead_id: teamLead._id,
      is_active: true,
      status: 'active',
    });

    const squadEng2 = await User.create({
      full_name: 'Squad Engineer 2',
      email: `squad2_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'engineer',
      team_id: testTeam._id,
      team_lead_id: teamLead._id,
      is_active: true,
      status: 'active',
    });

    const outsideEng = await User.create({
      full_name: 'Outside Engineer',
      email: `outside_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'engineer',
      is_active: true,
      status: 'active',
    });
    console.log(`✓ Created 2 Squad Engineers and 1 Outside Engineer`);

    // 3. Setup Track with 3 sequential modules
    const testTrack = await Track.create({
      name: 'Fiber Infrastructure Track',
      slug: `FIBER-${Date.now()}`,
      description: 'Fiber optics mastery',
      is_published: true,
    });

    const mod1 = await Module.create({
      track_id: testTrack._id,
      title: 'M1: Fiber Optic Fundamentals',
      tier: 'L1_CORE',
      status: 'published',
      display_order: 1,
    });

    const mod2 = await Module.create({
      track_id: testTrack._id,
      title: 'M2: Splicing & Termination',
      tier: 'L1_CORE',
      status: 'published',
      display_order: 2,
    });

    const mod3 = await Module.create({
      track_id: testTrack._id,
      title: 'M3: OTDR Testing & Certification',
      tier: 'L2_ADVANCED',
      status: 'published',
      display_order: 3,
    });
    console.log(`✓ Created Track with 3 sequential modules: ${testTrack.name}`);

    // Mock Response Helper
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

    // TEST 1: Team Lead assigns single module to 1 squad engineer
    const reqSingleMod = {
      user: teamLead,
      body: {
        module_id: mod1._id,
        engineer_ids: [squadEng1._id],
        deadline_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    };
    const resSingleMod = mockRes();
    await createAssignments(reqSingleMod, resSingleMod);
    assert.strictEqual(resSingleMod.statusCode, 201, 'Single module assignment should return 201');
    assert.strictEqual(resSingleMod.data.createdCount, 1, 'Assigned to 1 engineer');
    console.log('✓ TEST 1 Passed: Team Lead assigned single module to 1 squad engineer');

    // TEST 2: Team Lead assigns ENTIRE TRACK to ENTIRE SQUAD
    const reqTrack = {
      user: teamLead,
      body: {
        track_id: testTrack._id,
        team_id: testTeam._id,
        deadline_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    };
    const resTrack = mockRes();
    await createAssignments(reqTrack, resTrack);
    assert.strictEqual(resTrack.statusCode, 201, 'Track assignment should return 201');
    assert.strictEqual(resTrack.data.createdCount, 2, 'Assigned to 2 squad engineers');
    assert.strictEqual(resTrack.data.totalAssignments, 6, 'Created 6 total module assignments (3 mods * 2 engineers)');
    console.log('✓ TEST 2 Passed: Team Lead assigned entire track (3 modules) to entire squad (2 engineers, 6 assignments)');

    // TEST 3: Verify Auto-Enrollment in Progress collection
    const progressEng1 = await Progress.findOne({ userId: squadEng1._id, trackId: testTrack._id });
    const progressEng2 = await Progress.findOne({ userId: squadEng2._id, trackId: testTrack._id });
    assert(progressEng1, 'Progress record created for Squad Engineer 1');
    assert(progressEng2, 'Progress record created for Squad Engineer 2');
    console.log('✓ TEST 3 Passed: Auto-enrollment in Progress collection verified for both squad engineers');

    // TEST 4: Verify In-App Bell Notification creation
    const notificationsEng1 = await Notification.find({ recipient_id: squadEng1._id });
    assert(notificationsEng1.length >= 2, 'Squad Engineer 1 must receive in-app notifications');
    console.log(`✓ TEST 4 Passed: In-app notifications verified (${notificationsEng1.length} notifications logged)`);

    // TEST 5: Security Guard — Team Lead cannot assign to outside engineer
    const reqUnauthorized = {
      user: teamLead,
      body: {
        module_id: mod1._id,
        engineer_ids: [outsideEng._id],
      },
    };
    const resUnauthorized = mockRes();
    await createAssignments(reqUnauthorized, resUnauthorized);
    assert.strictEqual(resUnauthorized.statusCode, 403, 'Cross-team assignment must return 403 Forbidden');
    console.log('✓ TEST 5 Passed: Security guard blocked Team Lead from assigning to outside engineer (403)');

    // Clean up
    await User.deleteMany({ _id: { $in: [teamLead._id, squadEng1._id, squadEng2._id, outsideEng._id] } });
    await Team.deleteOne({ _id: testTeam._id });
    await Track.deleteOne({ _id: testTrack._id });
    await Module.deleteMany({ _id: { $in: [mod1._id, mod2._id, mod3._id] } });
    await Assignment.deleteMany({ module_id: { $in: [mod1._id, mod2._id, mod3._id] } });
    await Progress.deleteMany({ trackId: testTrack._id });
    await Notification.deleteMany({ recipient_id: { $in: [squadEng1._id, squadEng2._id] } });

    console.log('\n===============================================================');
    console.log('🎉 ALL TEAM LEAD TRACK ASSIGNMENT & NOTIFICATION TESTS PASSED');
    console.log('===============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
};

runTest();
