const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Team = require('../models/Team');
const Module = require('../models/Module');
const Track = require('../models/Track');
const Assignment = require('../models/Assignment');
const ConceptScore = require('../models/ConceptScore');
const Certificate = require('../models/Certificate');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runTeamLeadPhase1Tests() {
  try {
    console.log('--- Starting Team Lead Phase 1 Permissions & Scoping Verification ---');
    await mongoose.connect(process.env.MONGO_URI);

    // 1. Setup Test Teams and Users
    const timestamp = Date.now();
    const teamA = await Team.create({ name: `Alpha Team ${timestamp}`, region: 'EMEA' });
    const teamB = await Team.create({ name: `Beta Team ${timestamp}`, region: 'APAC' });

    const teamLeadA = await User.create({
      fullName: `Lead Alpha ${timestamp}`,
      email: `lead.alpha.${timestamp}@example.com`,
      password: 'password123',
      role: 'team_lead',
      team_id: teamA._id,
      status: 'active',
    });

    const engineerA1 = await User.create({
      fullName: `Engineer A1 ${timestamp}`,
      email: `eng.a1.${timestamp}@example.com`,
      password: 'password123',
      role: 'engineer',
      team_id: teamA._id,
      status: 'active',
    });

    const engineerB1 = await User.create({
      fullName: `Engineer B1 ${timestamp}`,
      email: `eng.b1.${timestamp}@example.com`,
      password: 'password123',
      role: 'engineer',
      team_id: teamB._id,
      status: 'active',
    });

    const testTrack = await Track.create({
      title: `Test Track ${timestamp}`,
      code: `TRK-${timestamp}`,
      description: 'Test Track Description',
      tier: 'L1_CORE',
    });

    const testModule = await Module.create({
      trackId: testTrack._id,
      title: `Test Module ${timestamp}`,
      slug: `test-module-${timestamp}`,
      description: 'Test Module Description',
      tier: 'L1_CORE',
      status: 'published',
    });

    testTrack.modules = [testModule._id];
    await testTrack.save();

    // Create assignments and concept scores
    await Assignment.create({
      module_id: testModule._id,
      engineer_id: engineerA1._id,
      assigned_by: teamLeadA._id,
      status: 'completed',
    });

    await ConceptScore.create({
      engineer_id: engineerA1._id,
      concept_tag: 'FIBER_SPLICING',
      correct_count: 8,
      total_count: 10,
      accuracy: 0.8,
    });

    await ConceptScore.create({
      engineer_id: engineerB1._id,
      concept_tag: 'ROUTER_CONFIG',
      correct_count: 2,
      total_count: 10,
      accuracy: 0.2,
    });

    await Certificate.create({
      certificate_id: `TNX-${timestamp}-TEST`,
      engineer_id: engineerA1._id,
      track_id: testTrack._id,
      tier: 'L1_CORE',
      pdf_storage_path: '/tmp/test.pdf',
      status: 'active',
    });

    // Generate JWT for Team Lead A
    const token = jwt.sign({ id: teamLeadA._id, role: teamLeadA.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    console.log('\n[TEST 1] Team Lead access to GET /reports/team/:id with strict scoping');
    const teamReportRes = await fetch(`${BASE_URL}/admin/reports/team/all`, { headers: authHeaders });
    const teamReportBody = await teamReportRes.json();
    console.log(`Status: ${teamReportRes.status}`);
    console.log(`Overridden Team ID: ${teamReportBody.teamId} (Expected: ${teamA._id})`);
    console.log(`Engineers Count: ${teamReportBody.totalEngineers}`);
    if (
      teamReportRes.status !== 200 ||
      teamReportBody.teamId.toString() !== teamA._id.toString() ||
      teamReportBody.totalEngineers !== 1
    ) {
      throw new Error(`TEST 1 Failed: ${JSON.stringify(teamReportBody)}`);
    }
    const engSummary = teamReportBody.engineers[0];
    if (
      engSummary.completedModulesCount !== 1 ||
      engSummary.earnedCertificatesCount !== 1 ||
      engSummary.activeAssignmentsCount !== 0
    ) {
      throw new Error(`TEST 1 Populated fields missing or incorrect: ${JSON.stringify(engSummary)}`);
    }
    console.log('✅ TEST 1 Passed: Team Report is strictly scoped to Team Lead team and populates metrics correctly');

    console.log('\n[TEST 2] Team-scoped Weak Concepts Report');
    const conceptsRes = await fetch(`${BASE_URL}/admin/reports/weak-concepts`, { headers: authHeaders });
    const conceptsBody = await conceptsRes.json();
    console.log(`Status: ${conceptsRes.status}`);
    console.log('Concepts:', JSON.stringify(conceptsBody.weakConcepts));
    if (
      conceptsRes.status !== 200 ||
      conceptsBody.weakConcepts.length !== 1 ||
      conceptsBody.weakConcepts[0].concept_tag !== 'FIBER_SPLICING'
    ) {
      throw new Error(`TEST 2 Failed: Team B concept score exposed to Team A lead! ${JSON.stringify(conceptsBody)}`);
    }
    console.log('✅ TEST 2 Passed: Weak concepts report is strictly filtered to Team Lead team members');

    console.log('\n[TEST 3] Team Assignment Validation - Assigning to Team A Engineer (Allowed)');
    const validAssignRes = await fetch(`${BASE_URL}/admin/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        module_id: testModule._id,
        engineer_ids: [engineerA1._id],
      }),
    });
    const validAssignBody = await validAssignRes.json();
    console.log(`Status: ${validAssignRes.status}`);
    if (validAssignRes.status !== 201) {
      throw new Error(`TEST 3 Failed: Valid assignment rejected: ${JSON.stringify(validAssignBody)}`);
    }
    console.log('✅ TEST 3 Passed: Assigning to team engineer succeeded');

    console.log('\n[TEST 4] Team Assignment Validation - Assigning to Outside Engineer (Blocked)');
    const invalidAssignRes = await fetch(`${BASE_URL}/admin/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        module_id: testModule._id,
        engineer_ids: [engineerB1._id],
      }),
    });
    const invalidAssignBody = await invalidAssignRes.json();
    console.log(`Status: ${invalidAssignRes.status}`);
    if (invalidAssignRes.status !== 403) {
      throw new Error(`TEST 4 Failed: Outside engineer assignment was NOT blocked! Status: ${invalidAssignRes.status}`);
    }
    console.log('✅ TEST 4 Passed: Assigning to outside engineer was blocked with 403 Forbidden');

    console.log('\n[TEST 5] Read-Only Curriculum Content Permissions (Tracks/Modules)');
    const createTrackRes = await fetch(`${BASE_URL}/tracks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: 'Illegal Track', code: 'ILL-01', description: 'Desc', tier: 'L1_CORE' }),
    });
    console.log(`POST /tracks Status: ${createTrackRes.status}`);

    const getTracksRes = await fetch(`${BASE_URL}/tracks`, { headers: authHeaders });
    console.log(`GET /tracks Status: ${getTracksRes.status}`);

    if (createTrackRes.status !== 403 || getTracksRes.status !== 200) {
      throw new Error(`TEST 5 Failed: Team lead write allowed or read blocked! Create: ${createTrackRes.status}, Read: ${getTracksRes.status}`);
    }
    console.log('✅ TEST 5 Passed: Track creation blocked (403), Track reading allowed (200)');

    console.log('\n[TEST 6] SuperAdmin Guard Verification');
    const auditRes = await fetch(`${BASE_URL}/admin/audit-log`, { headers: authHeaders });
    console.log(`GET /admin/audit-log Status: ${auditRes.status}`);
    if (auditRes.status !== 403) {
      throw new Error(`TEST 6 Failed: SuperAdmin endpoint accessed by Team Lead! Status: ${auditRes.status}`);
    }
    console.log('✅ TEST 6 Passed: SuperAdmin audit log blocked for Team Lead (403)');

    // Cleanup
    await User.deleteMany({ _id: { $in: [teamLeadA._id, engineerA1._id, engineerB1._id] } });
    await Team.deleteMany({ _id: { $in: [teamA._id, teamB._id] } });
    await Module.deleteOne({ _id: testModule._id });
    await Track.deleteOne({ _id: testTrack._id });
    await Assignment.deleteMany({ module_id: testModule._id });
    await ConceptScore.deleteMany({ engineer_id: { $in: [engineerA1._id, engineerB1._id] } });
    await Certificate.deleteMany({ engineer_id: engineerA1._id });

    console.log('\n🎉 ALL 6 PHASE 1 TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Integration Test Failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTeamLeadPhase1Tests();
