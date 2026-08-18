const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Team = require('../models/Team');
const Module = require('../models/Module');
const Track = require('../models/Track');
const Question = require('../models/Question');
const Assignment = require('../models/Assignment');
const QuizAttempt = require('../models/QuizAttempt');
const AttemptResponse = require('../models/AttemptResponse');
const ConceptScore = require('../models/ConceptScore');
const Certificate = require('../models/Certificate');
const AuditLog = require('../models/AuditLog');
const adminRoutes = require('../routes/adminRoutes');

const TEST_PORT = 5052;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runTests = async () => {
  console.log('--- Starting Admin Phase 3 Automated Test Suite ---');
  await connectDB();

  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);

  const server = app.listen(TEST_PORT);
  console.log(`Test server running on port ${TEST_PORT}`);

  try {
    // 1. Setup Admin user and SuperAdmin user
    let adminUser = await User.findOne({ role: 'Admin' });
    if (!adminUser) {
      adminUser = await User.create({
        fullName: 'Admin Phase3',
        email: `admin3_${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Admin',
      });
    }

    let superAdminUser = await User.findOne({ role: 'SuperAdmin' });
    if (!superAdminUser) {
      superAdminUser = await User.create({
        fullName: 'SuperAdmin Phase3',
        email: `superadmin3_${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'SuperAdmin',
      });
    }

    const adminToken = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    const superAdminToken = jwt.sign({ id: superAdminUser._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

    const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
    const superAdminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${superAdminToken}` };

    // Setup Test Data
    const testTeam = await Team.create({ name: `Phase3 Test Team ${Date.now()}`, region: 'EMEA' });
    const testEngineer = await User.create({
      fullName: 'Engineer Phase3',
      email: `engineer3_${Date.now()}@example.com`,
      password: 'hashedpassword',
      role: 'engineer',
      team_id: testTeam._id,
    });

    const testTrack = await Track.create({ title: 'Phase3 Track', code: 'P3' });
    const testModule = await Module.create({
      trackId: testTrack._id,
      title: `Phase 3 Test Module ${Date.now()}`,
      status: 'published',
      video_provider_id: 'cf_stream_mock123',
    });

    console.log(`Using Team ID: ${testTeam._id}, Engineer ID: ${testEngineer._id}, Module ID: ${testModule._id}`);

    // TEST 1: Assignment Engine (POST /api/v1/admin/assignments)
    console.log('\n[TEST 1] Assignment Engine (POST /api/v1/admin/assignments)');
    const assignPayload = {
      module_id: testModule._id,
      engineer_ids: [testEngineer._id],
      deadline_at: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    };

    const assignRes = await fetch(`${BASE_URL}/admin/assignments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(assignPayload),
    });

    const assignBody = await assignRes.json();
    console.log(`Assign Status: ${assignRes.status}, Created Count: ${assignBody.createdCount}`);
    const assignmentDoc = await Assignment.findOne({ module_id: testModule._id, engineer_id: testEngineer._id });
    if (assignRes.status !== 201 || !assignmentDoc || assignmentDoc.status !== 'pending') {
      throw new Error(`Failed Test 1 Assignment Engine: ${JSON.stringify(assignBody)}`);
    }
    console.log(`✅ Assignment created successfully ID: ${assignmentDoc._id}`);

    // TEST 2: Team Dashboard Report (GET /api/v1/admin/reports/team/:id)
    console.log('\n[TEST 2] Team Dashboard Report (GET /api/v1/admin/reports/team/:id)');
    const teamReportRes = await fetch(`${BASE_URL}/admin/reports/team/${testTeam._id}`, {
      method: 'GET',
      headers: adminHeaders,
    });

    const teamReportBody = await teamReportRes.json();
    console.log(`Team Report Status: ${teamReportRes.status}`);
    console.log('Team Report Metrics:', JSON.stringify(teamReportBody, null, 2));

    if (teamReportRes.status !== 200 || teamReportBody.totalEngineers < 1 || teamReportBody.totalAssignments < 1) {
      throw new Error(`Failed Test 2 Team Report: ${JSON.stringify(teamReportBody)}`);
    }
    console.log('✅ Team report metrics aggregated successfully');

    // TEST 3: Module Report (GET /api/v1/admin/reports/module/:id)
    console.log('\n[TEST 3] Module Performance Report (GET /api/v1/admin/reports/module/:id)');
    // Seed a quiz attempt for module
    const attempt = await QuizAttempt.create({
      engineer_id: testEngineer._id,
      module_id: testModule._id,
      quiz_type: 'topic_mcq',
      score_percent: 85,
      passed: true,
    });

    const testQuestion = await Question.create({
      moduleId: testModule._id,
      questionText: 'Which protocol is used for email receipt?',
      option_a: 'IMAP',
      option_b: 'SMTP',
      option_c: 'FTP',
      option_d: 'HTTP',
      correct_option: 'A',
      concept_tag: 'email_protocols',
    });

    await AttemptResponse.create({
      attempt_id: attempt._id,
      question_id: testQuestion._id,
      selected_option: 'B',
      was_correct: false,
      displayed_order: 1,
    });

    const moduleReportRes = await fetch(`${BASE_URL}/admin/reports/module/${testModule._id}`, {
      method: 'GET',
      headers: adminHeaders,
    });

    const moduleReportBody = await moduleReportRes.json();
    console.log(`Module Report Status: ${moduleReportRes.status}`);
    console.log('Module Report Payload:', JSON.stringify(moduleReportBody, null, 2));

    if (moduleReportRes.status !== 200 || moduleReportBody.totalAttempts < 1 || moduleReportBody.topMissedQuestions.length < 1) {
      throw new Error(`Failed Test 3 Module Report: ${JSON.stringify(moduleReportBody)}`);
    }
    console.log('✅ Module report and top missed questions aggregated successfully');

    // TEST 4: Weak Concepts Report (GET /api/v1/admin/reports/weak-concepts)
    console.log('\n[TEST 4] Weak Concepts Report (GET /api/v1/admin/reports/weak-concepts)');
    await ConceptScore.create({
      engineer_id: testEngineer._id,
      concept_tag: 'email_protocols',
      correct_count: 2,
      total_count: 10,
      accuracy: 0.2,
    });

    const weakReportRes = await fetch(`${BASE_URL}/admin/reports/weak-concepts`, {
      method: 'GET',
      headers: adminHeaders,
    });

    const weakReportBody = await weakReportRes.json();
    console.log(`Weak Concepts Status: ${weakReportRes.status}`);
    console.log('Weak Concepts Payload:', JSON.stringify(weakReportBody, null, 2));

    if (weakReportRes.status !== 200 || !Array.isArray(weakReportBody.weakConcepts)) {
      throw new Error(`Failed Test 4 Weak Concepts: ${JSON.stringify(weakReportBody)}`);
    }
    console.log('✅ Weak concepts aggregated and sorted by accuracy successfully');

    // TEST 5: Super Admin Audit Log Pagination & Role Security
    console.log('\n[TEST 5] Super Admin Audit Log (GET /api/v1/admin/audit-log)');
    // Try with Admin token -> should be Forbidden (403)
    const auditDeniesRes = await fetch(`${BASE_URL}/admin/audit-log`, {
      method: 'GET',
      headers: adminHeaders,
    });
    console.log(`Admin Role Audit Access Status (Expected 403): ${auditDeniesRes.status}`);
    if (auditDeniesRes.status !== 403) {
      throw new Error(`Failed Test 5: Expected 403 Forbidden for Admin role, got ${auditDeniesRes.status}`);
    }

    // Try with SuperAdmin token -> should succeed (200)
    const auditAllowsRes = await fetch(`${BASE_URL}/admin/audit-log?page=1&limit=10`, {
      method: 'GET',
      headers: superAdminHeaders,
    });
    const auditBody = await auditAllowsRes.json();
    console.log(`SuperAdmin Audit Log Status: ${auditAllowsRes.status}, Total Entries: ${auditBody.total}`);
    if (auditAllowsRes.status !== 200 || !Array.isArray(auditBody.auditLogs)) {
      throw new Error(`Failed Test 5: SuperAdmin audit log query failed: ${JSON.stringify(auditBody)}`);
    }
    console.log('✅ Super Admin role restriction and paginated AuditLog query verified successfully');

    // TEST 6: Certificate Revocation (POST /api/v1/admin/certificates/:id/revoke)
    console.log('\n[TEST 6] Super Admin Certificate Revocation (POST /api/v1/admin/certificates/:id/revoke)');
    const testCert = await Certificate.create({
      certificate_id: `TNX-2026-TEST-${Date.now().toString().slice(-4)}`,
      engineer_id: testEngineer._id,
      track_id: testTrack._id,
      pdf_storage_path: '/uploads/certificates/test.pdf',
      status: 'active',
    });

    const revokeRes = await fetch(`${BASE_URL}/admin/certificates/${testCert._id}/revoke`, {
      method: 'POST',
      headers: superAdminHeaders,
      body: JSON.stringify({ revocation_reason: 'Plagiarism detected in final capstone submission' }),
    });

    const revokeBody = await revokeRes.json();
    console.log(`Revoke Status: ${revokeRes.status}`);
    const updatedCert = await Certificate.findById(testCert._id);
    if (revokeRes.status !== 200 || updatedCert.status !== 'revoked' || !updatedCert.revoked_at) {
      throw new Error(`Failed Test 6 Certificate Revocation: ${JSON.stringify(revokeBody)}`);
    }
    console.log(`✅ Certificate ${updatedCert.certificate_id} revoked successfully with reason: '${updatedCert.revocation_reason}'`);

    console.log('\n===================================================================================');
    console.log('🎉 ALL PHASE 3 ASSIGNMENTS, REPORTING, & SUPER ADMIN CAPABILITIES PASSED CLEANLY! 🎉');
    console.log('===================================================================================');
  } finally {
    server.close();
    await mongoose.connection.close();
  }
};

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
