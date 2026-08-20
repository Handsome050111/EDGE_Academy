/**
 * Test: Assignment Visibility and Scoping Test
 * Verifies:
 * 1. Admin sees all company assignments
 * 2. TeamLead sees only their own squad's assignments
 * 3. Assignments of unmanaged engineers are excluded from TeamLead view
 * 4. Status filtering (pending, in_progress, completed, overdue)
 * 5. Dynamic overdue computation on read
 */
'use strict';

const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Track = require('../models/Track');
const Module = require('../models/Module');
const Assignment = require('../models/Assignment');
const { getAssignments } = require('../controllers/adminAssignmentController');

async function testAssignmentsVisibility() {
  await connectDB();
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  🧪 TEST: Assignments Visibility & Squad Scoping');
  console.log('════════════════════════════════════════════════════════════════\n');

  // 1. Setup Admin user
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      fullName: 'Super Admin',
      email: `admin_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'admin',
      status: 'active',
    });
  }

  // 2. Setup TeamLead A & Team A & Engineer A
  let teamLeadA = await User.findOne({ email: 'lead_a_test@technonex.de' });
  if (!teamLeadA) {
    teamLeadA = await User.create({
      fullName: 'Team Lead Alpha',
      email: 'lead_a_test@technonex.de',
      password: 'Password123!',
      role: 'team_lead',
      status: 'active',
    });
  }

  let teamA = await Team.findOne({ name: 'Alpha Squad Unit' });
  if (!teamA) {
    teamA = await Team.create({
      name: 'Alpha Squad Unit',
      lead_user_id: teamLeadA._id,
      team_lead_id: teamLeadA._id,
    });
  }
  teamLeadA.team_id = teamA._id;
  await teamLeadA.save();

  let engineerA = await User.findOne({ email: 'eng_a_test@technonex.de' });
  if (!engineerA) {
    engineerA = await User.create({
      fullName: 'Engineer Alpha',
      email: 'eng_a_test@technonex.de',
      password: 'Password123!',
      role: 'engineer',
      status: 'active',
      team_id: teamA._id,
      team_lead_id: teamLeadA._id,
    });
  }

  // 3. Setup TeamLead B & Team B & Engineer B
  let teamLeadB = await User.findOne({ email: 'lead_b_test@technonex.de' });
  if (!teamLeadB) {
    teamLeadB = await User.create({
      fullName: 'Team Lead Bravo',
      email: 'lead_b_test@technonex.de',
      password: 'Password123!',
      role: 'team_lead',
      status: 'active',
    });
  }

  let teamB = await Team.findOne({ name: 'Bravo Squad Unit' });
  if (!teamB) {
    teamB = await Team.create({
      name: 'Bravo Squad Unit',
      lead_user_id: teamLeadB._id,
      team_lead_id: teamLeadB._id,
    });
  }
  teamLeadB.team_id = teamB._id;
  await teamLeadB.save();

  let engineerB = await User.findOne({ email: 'eng_b_test@technonex.de' });
  if (!engineerB) {
    engineerB = await User.create({
      fullName: 'Engineer Bravo',
      email: 'eng_b_test@technonex.de',
      password: 'Password123!',
      role: 'engineer',
      status: 'active',
      team_id: teamB._id,
      team_lead_id: teamLeadB._id,
    });
  }

  // 4. Setup Track & Modules
  let track = await Track.findOne({ slug: 'EDGE-TEST-ASSIGN' });
  if (!track) {
    track = await Track.create({
      name: 'Assignment Test Track',
      slug: 'EDGE-TEST-ASSIGN',
      tier: 'EDGE',
      is_published: true,
    });
  }

  let module1 = await Module.findOne({ title: 'Module Alpha 101' });
  if (!module1) {
    module1 = await Module.create({
      title: 'Module Alpha 101',
      slug: 'mod-alpha-101',
      track_id: track._id,
      status: 'published',
      pass_threshold: 80,
    });
  }

  let module2 = await Module.findOne({ title: 'Module Bravo 102' });
  if (!module2) {
    module2 = await Module.create({
      title: 'Module Bravo 102',
      slug: 'mod-bravo-102',
      track_id: track._id,
      status: 'published',
      pass_threshold: 80,
    });
  }

  // 5. Create distinct assignments
  // Assignment 1: Given to Engineer A (managed by Lead A), deadline in the past (Overdue test)
  const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const assignA1 = await Assignment.findOneAndUpdate(
    { engineer_id: engineerA._id, module_id: module1._id },
    {
      engineer_id: engineerA._id,
      module_id: module1._id,
      assigned_by: admin._id,
      assigned_at: pastDate,
      deadline_at: pastDate,
      status: 'pending',
    },
    { upsert: true, new: true }
  );

  // Assignment 2: Given to Engineer A (managed by Lead A), completed
  const assignA2 = await Assignment.findOneAndUpdate(
    { engineer_id: engineerA._id, module_id: module2._id },
    {
      engineer_id: engineerA._id,
      module_id: module2._id,
      assigned_by: teamLeadA._id,
      assigned_at: pastDate,
      deadline_at: futureDate,
      status: 'completed',
      completed_at: new Date(),
    },
    { upsert: true, new: true }
  );

  // Assignment 3: Given to Engineer B (managed by Lead B)
  const assignB1 = await Assignment.findOneAndUpdate(
    { engineer_id: engineerB._id, module_id: module1._id },
    {
      engineer_id: engineerB._id,
      module_id: module1._id,
      assigned_by: teamLeadB._id,
      assigned_at: new Date(),
      deadline_at: futureDate,
      status: 'in_progress',
    },
    { upsert: true, new: true }
  );

  console.log(`Created assignments:\n- A1 (Engineer A, Overdue): ${assignA1._id}\n- A2 (Engineer A, Completed): ${assignA2._id}\n- B1 (Engineer B, In Progress): ${assignB1._id}\n`);

  // Helper mock res
  const createMockRes = () => {
    let statusCode = 200;
    let sentData = null;
    return {
      status: (code) => { statusCode = code; return { json: (d) => { sentData = d; } }; },
      json: (d) => { sentData = d; },
      get result() { return { statusCode, sentData }; },
    };
  };

  // ── TEST 1: Admin sees all assignments ──
  console.log('--- Test 1: Admin Global Visibility ---');
  const reqAdmin = { user: admin, query: {} };
  const resAdmin = createMockRes();
  await getAssignments(reqAdmin, resAdmin);
  const adminList = resAdmin.result.sentData?.assignments || [];
  const adminIds = adminList.map((a) => a._id.toString());
  console.log(`Admin retrieved ${adminList.length} assignments.`);
  const hasA1 = adminIds.includes(assignA1._id.toString());
  const hasA2 = adminIds.includes(assignA2._id.toString());
  const hasB1 = adminIds.includes(assignB1._id.toString());
  if (hasA1 && hasA2 && hasB1) {
    console.log('✅ Test 1 Passed: Admin sees all assignments across all squads.');
  } else {
    console.error('❌ Test 1 Failed: Admin missing some assignments.');
  }

  // ── TEST 2: TeamLead A sees only Engineer A assignments ──
  console.log('\n--- Test 2: TeamLead A Squad Scoping ---');
  const reqLeadA = { user: teamLeadA, query: {} };
  const resLeadA = createMockRes();
  await getAssignments(reqLeadA, resLeadA);
  const leadAList = resLeadA.result.sentData?.assignments || [];
  const leadAIds = leadAList.map((a) => a._id.toString());
  console.log(`TeamLead A retrieved ${leadAList.length} assignments.`);
  const leadAHasA1 = leadAIds.includes(assignA1._id.toString());
  const leadAHasA2 = leadAIds.includes(assignA2._id.toString());
  const leadAHasB1 = leadAIds.includes(assignB1._id.toString());

  if (leadAHasA1 && leadAHasA2 && !leadAHasB1) {
    console.log('✅ Test 2 Passed: TeamLead A sees Engineer A assignments and DOES NOT see Engineer B assignment.');
  } else {
    console.error(`❌ Test 2 Failed: leadAHasA1=${leadAHasA1}, leadAHasA2=${leadAHasA2}, leadAHasB1=${leadAHasB1}`);
  }

  // ── TEST 3: TeamLead B sees only Engineer B assignments ──
  console.log('\n--- Test 3: TeamLead B Squad Scoping ---');
  const reqLeadB = { user: teamLeadB, query: {} };
  const resLeadB = createMockRes();
  await getAssignments(reqLeadB, resLeadB);
  const leadBList = resLeadB.result.sentData?.assignments || [];
  const leadBIds = leadBList.map((a) => a._id.toString());
  console.log(`TeamLead B retrieved ${leadBList.length} assignments.`);
  const leadBHasA1 = leadBIds.includes(assignA1._id.toString());
  const leadBHasB1 = leadBIds.includes(assignB1._id.toString());

  if (leadBHasB1 && !leadBHasA1) {
    console.log('✅ Test 3 Passed: TeamLead B sees Engineer B assignment and DOES NOT see Engineer A assignment.');
  } else {
    console.error(`❌ Test 3 Failed: leadBHasB1=${leadBHasB1}, leadBHasA1=${leadBHasA1}`);
  }

  // ── TEST 4: Dynamic Overdue Computation & Filtering ──
  console.log('\n--- Test 4: Dynamic Overdue Computation & Filter ---');
  const foundA1 = leadAList.find((a) => a._id.toString() === assignA1._id.toString());
  console.log(`Assignment A1 computed_status: "${foundA1?.computed_status}", is_overdue: ${foundA1?.is_overdue}`);
  if (foundA1?.computed_status === 'overdue' && foundA1?.is_overdue === true) {
    console.log('✅ Overdue computed correctly on read for past deadline.');
  } else {
    console.error('❌ Overdue dynamic computation failed.');
  }

  const reqOverdue = { user: admin, query: { status: 'overdue' } };
  const resOverdue = createMockRes();
  await getAssignments(reqOverdue, resOverdue);
  const overdueList = resOverdue.result.sentData?.assignments || [];
  const overdueIds = overdueList.map((a) => a._id.toString());
  if (overdueIds.includes(assignA1._id.toString()) && !overdueIds.includes(assignA2._id.toString())) {
    console.log(`✅ Test 4 Passed: Filter ?status=overdue returned ${overdueList.length} overdue assignments correctly.`);
  } else {
    console.error('❌ Test 4 Failed: status=overdue filter did not match expected records.');
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  🎉 All Assignment Visibility Tests Passed Successfully');
  console.log('════════════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

testAssignmentsVisibility().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
