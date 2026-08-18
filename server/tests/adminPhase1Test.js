const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Module = require('../models/Module');
const Track = require('../models/Track');
const Question = require('../models/Question');
const AuditLog = require('../models/AuditLog');
const adminRoutes = require('../routes/adminRoutes');

const TEST_PORT = 5050;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runTests = async () => {
  console.log('--- Starting Admin Phase 1 Automated Test Suite ---');
  await connectDB();

  // Create isolated express app for testing newly created routes
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);

  const server = app.listen(TEST_PORT);
  console.log(`Test server running on port ${TEST_PORT}`);

  try {
    // 1. Get or create Admin user for JWT generation
    let adminUser = await User.findOne({ role: { $in: ['Admin', 'SuperAdmin', 'admin', 'superadmin'] } });
    if (!adminUser) {
      adminUser = await User.create({
        fullName: 'Test Admin',
        email: `testadmin_${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Admin',
      });
    }

    const token = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Get or create parent module
    let testModule = await Module.findOne();
    if (!testModule) {
      const testTrack = await Track.create({ title: 'Test Track', code: 'TT', description: 'Test' });
      testModule = await Module.create({
        trackId: testTrack._id,
        title: 'Test Module for Admin CMS',
        description: 'Module for testing questions',
        passingScorePercentage: 80,
      });
    }

    console.log(`Using Test Admin: ${adminUser.email}`);
    console.log(`Using Test Module ID: ${testModule._id}`);

    // Test 1: Single Question Creation
    console.log('\n[TEST 1] Single Question Creation (POST /api/v1/admin/modules/:id/questions)');
    const createPayload = {
      question_text: 'What is the standard pinout for T568B wire 1?',
      option_a: 'White/Orange',
      option_b: 'Orange',
      option_c: 'White/Green',
      option_d: 'Blue',
      correct_option: 'A',
      difficulty: 'easy',
      concept_tag: 'cable_termination',
      explanation: 'T568B pin 1 starts with White/Orange.',
    };

    const createRes = await fetch(`${BASE_URL}/admin/modules/${testModule._id}/questions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(createPayload),
    });

    const createdQuestion = await createRes.json();
    console.log(`Create Status: ${createRes.status}`);
    if (createRes.status !== 201 || !createdQuestion._id) {
      throw new Error(`Failed Test 1: ${JSON.stringify(createdQuestion)}`);
    }
    console.log(`✅ Created Question ID: ${createdQuestion._id}, Version: ${createdQuestion.version}, Active: ${createdQuestion.is_active}`);

    // Test 2: Question Editing with Versioning
    console.log('\n[TEST 2] Question Editing with Versioning (PUT /api/v1/admin/questions/:id)');
    const updatePayload = {
      question_text: 'What is the updated standard pinout for T568B wire 1?',
      difficulty: 'medium',
    };

    const updateRes = await fetch(`${BASE_URL}/admin/questions/${createdQuestion._id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updatePayload),
    });

    const newVersionQuestion = await updateRes.json();
    console.log(`Update Status: ${updateRes.status}`);
    if (updateRes.status !== 200 || !newVersionQuestion._id) {
      throw new Error(`Failed Test 2: ${JSON.stringify(newVersionQuestion)}`);
    }

    // Check that old question is deactivated
    const oldQ = await Question.findById(createdQuestion._id);
    console.log(`Old Question Active: ${oldQ.is_active}`);
    console.log(`New Version Question ID: ${newVersionQuestion._id}, Version: ${newVersionQuestion.version}, Active: ${newVersionQuestion.is_active}`);
    if (oldQ.is_active !== false || newVersionQuestion.version !== 2) {
      throw new Error('Failed Test 2 versioning check');
    }
    console.log('✅ Question versioning verified successfully');

    // Test 3: Question Soft Delete
    console.log('\n[TEST 3] Question Soft Delete (DELETE /api/v1/admin/questions/:id)');
    const deleteRes = await fetch(`${BASE_URL}/admin/questions/${newVersionQuestion._id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    const deleteBody = await deleteRes.json();
    console.log(`Delete Status: ${deleteRes.status}, Response:`, deleteBody);
    const deletedQ = await Question.findById(newVersionQuestion._id);
    if (deleteRes.status !== 200 || deletedQ.is_active !== false || !deletedQ.deleted_at) {
      throw new Error('Failed Test 3 soft delete check');
    }
    console.log('✅ Question soft delete verified successfully');

    // Test 4: CSV Bulk Import Parser with Per-Row Validation
    console.log('\n[TEST 4] CSV Bulk Import Parser (POST /api/v1/admin/questions/import)');
    const csvContent = `question_text,option_a,option_b,option_c,option_d,correct_option,difficulty,concept_tag,explanation,module_id
"What is VLAN 1 default name?",Default,Native,Management,Admin,A,easy,vlan_basics,"VLAN 1 default name is Default",${testModule._id}
"Invalid Correct Option Q",A,B,C,D,E,medium,vlan_basics,"Invalid option test",${testModule._id}
"Invalid Concept Tag Q",A,B,C,D,A,hard,INVALID TAG!,"Invalid tag test",${testModule._id}
"What is OSPF administrative distance?",110,90,120,20,A,medium,ospf_routing,"OSPF AD is 110",${testModule._id}`;

    const formData = new FormData();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('file', blob, 'test_import.csv');

    const importRes = await fetch(`${BASE_URL}/admin/questions/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const importSummary = await importRes.json();
    console.log(`Import Status: ${importRes.status}`);
    console.log('Import Summary:', JSON.stringify(importSummary, null, 2));

    if (importRes.status !== 200 || importSummary.successCount !== 2 || importSummary.failedCount !== 2) {
      throw new Error(`Failed Test 4 CSV Import: expected 2 success, 2 failed. Got: ${JSON.stringify(importSummary)}`);
    }
    console.log('✅ CSV Import per-row validation and non-blocking errors verified successfully');

    // Test 5: Verify AuditLog Entries
    console.log('\n[TEST 5] AuditLog Verification');
    const logs = await AuditLog.find({ actorId: adminUser._id }).sort({ createdAt: -1 }).limit(10);
    console.log(`Found ${logs.length} audit log entries for user`);
    logs.forEach((l) => console.log(`- Action: ${l.action} | Resource: ${l.resourceType}:${l.resourceId || 'N/A'} | Outcome: ${l.outcome}`));

    if (logs.length < 4) {
      throw new Error('Failed Test 5 AuditLog check: expected at least 4 audit log entries');
    }
    console.log('✅ AuditLog creation verified successfully');

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 1 ADMIN MCQ ENGINE TESTS PASSED CLEANLY! 🎉');
    console.log('======================================================');
  } finally {
    server.close();
    await mongoose.connection.close();
  }
};

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
