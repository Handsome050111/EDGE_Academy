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
const Certificate = require('../models/Certificate');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const adminRoutes = require('../routes/adminRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const authRoutes = require('../routes/authRoutes');
const bcrypt = require('bcryptjs');

const TEST_PORT = 5052;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

let passed = 0;
let failed = 0;

const assert = (condition, testName) => {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
};

const { getUserCertificates } = require('../controllers/certificateController');

const runTests = async () => {
  await connectDB();
  const users = await User.find({ role: 'engineer' }).select('_id full_name fullName email');
  const tracks = await Track.find({ deleted_at: null }).select('_id title name code slug modules is_published isPublished');
  
  console.log(`\nFound ${users.length} Engineers and ${tracks.length} Tracks in database.`);

  // 1. Run getUserCertificates endpoint handler for every engineer
  console.log('\n--- 🔄 Triggering getUserCertificates Auto-Reconciliation for all Engineers ---');
  for (const u of users) {
    let resultCertificates = [];
    const mockReq = { user: u };
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        resultCertificates = data;
        return data;
      },
    };

    await getUserCertificates(mockReq, mockRes);
    console.log(`Engineer ${u.full_name || u.fullName} (${u.email}) -> Retrieved ${resultCertificates.length} certificate(s): ${resultCertificates.map(c => c.certificate_id).join(', ')}`);
  }

  // 2. Final verification check
  console.log('\n--- 📊 Final Database State After Reconciliation ---');
  for (const track of tracks) {
    const trackModules = await Module.find({
      $or: [{ track_id: track._id }, { trackId: track._id }],
      deleted_at: null,
      status: { $ne: 'archived' },
    }).select('_id title pass_threshold');

    console.log(`\n======================================================`);
    console.log(`Track: "${track.title || track.name}" (ID: ${track._id})`);
    console.log(`Total Active Modules: ${trackModules.length}`);

    for (const u of users) {
      const engId = u._id;
      const certs = await Certificate.find({
        $and: [
          { $or: [{ engineer_id: engId }, { userId: engId }] },
          { $or: [{ track_id: track._id }, { trackId: track._id }] },
        ],
      });

      const passedAttempts = await require('../models/QuizAttempt').find({
        $or: [{ engineer_id: engId }, { userId: engId }],
        passed: true,
        module_id: { $in: trackModules.map((m) => m._id) },
      }).select('module_id score_percent');

      const completedAssignments = await require('../models/Assignment').find({
        $or: [{ engineer_id: engId }, { userId: engId }],
        status: 'completed',
        $or: [
          { module_id: { $in: trackModules.map((m) => m._id) } },
          { moduleId: { $in: trackModules.map((m) => m._id) } },
        ],
      }).select('module_id moduleId');

      const passedModIds = new Set([
        ...passedAttempts.map((a) => a.module_id.toString()),
        ...completedAssignments.map((a) => (a.module_id || a.moduleId)?.toString()).filter(Boolean),
      ]);

      const isCompleted = trackModules.length > 0 && trackModules.every((m) => passedModIds.has(m._id.toString()));

      console.log(`\n  👤 Engineer: ${u.full_name || u.fullName} (${u.email})`);
      console.log(`     Passed Modules: ${passedModIds.size} / ${trackModules.length}`);
      console.log(`     Is Track Fully Completed: ${isCompleted ? '✅ YES' : '❌ NO'}`);
      console.log(`     Has Certificate: ${certs.length > 0 ? `✅ YES (${certs.map((c) => c.certificate_id).join(', ')})` : '❌ NO'}`);
    }
  }
  process.exit(0);
};

runTests();
/*
    // ============================================================
    // Setup: Create test users
    // ============================================================
    const salt = await bcrypt.genSalt(10);
    const hashedPw = await bcrypt.hash('TestPass123!', salt);

    const superAdmin = await User.create({
      fullName: 'Fix Test SuperAdmin',
      email: `fix_sa_${Date.now()}@test.com`,
      password: hashedPw,
      role: 'super_admin',
    });

    const engineer1 = await User.create({
      fullName: 'Fix Test Engineer1',
      email: `fix_eng1_${Date.now()}@test.com`,
      password: hashedPw,
      role: 'engineer',
    });

    const engineer2 = await User.create({
      fullName: 'Fix Test Engineer2',
      email: `fix_eng2_${Date.now()}@test.com`,
      password: hashedPw,
      role: 'engineer',
    });

    const saToken = jwt.sign({ id: superAdmin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const eng1Token = jwt.sign({ id: engineer1._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const eng2Token = jwt.sign({ id: engineer2._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const authHeaders = (t) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

    // ============================================================
    // FIX 1: Notification Bell User-Scoping & Assignment Triggers
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  FIX 1: Notification Bell User-Scoping & Assignment Triggers');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Create notifications for engineer1 only
    await Notification.create({
      recipient_id: engineer1._id,
      title: 'Test Notification for Eng1',
      message: 'This is for engineer 1 only',
      type: 'system',
      is_read: false,
    });
    await Notification.create({
      recipient_id: engineer1._id,
      title: 'Another for Eng1',
      message: 'Second notification for eng1',
      type: 'assignment',
      is_read: false,
    });

    // Create notification for engineer2
    await Notification.create({
      recipient_id: engineer2._id,
      title: 'Test Notification for Eng2',
      message: 'This is for engineer 2 only',
      type: 'system',
      is_read: false,
    });

    // Test: Engineer1 should see only their 2 notifications
    const eng1NotifRes = await fetch(`${BASE_URL}/notifications`, { headers: authHeaders(eng1Token) });
    const eng1NotifData = await eng1NotifRes.json();
    assert(eng1NotifRes.status === 200, 'GET /notifications returns 200 for engineer1');
    assert(eng1NotifData.unreadCount === 2, `Engineer1 unread count is 2 (got ${eng1NotifData.unreadCount})`);
    assert(eng1NotifData.notifications.length === 2, `Engineer1 sees exactly 2 notifications (got ${eng1NotifData.notifications.length})`);

    // Test: Engineer2 should see only their 1 notification
    const eng2NotifRes = await fetch(`${BASE_URL}/notifications`, { headers: authHeaders(eng2Token) });
    const eng2NotifData = await eng2NotifRes.json();
    assert(eng2NotifData.unreadCount === 1, `Engineer2 unread count is 1 (got ${eng2NotifData.unreadCount})`);
    assert(eng2NotifData.notifications.length === 1, `Engineer2 sees exactly 1 notification (got ${eng2NotifData.notifications.length})`);

    // Test: Assignment notification includes deadline
    let testTrack = await Track.findOne();
    if (!testTrack) {
      testTrack = await Track.create({ title: 'Fix Test Track', code: 'FT', description: 'Fix test' });
    }
    const testModule = await Module.create({
      trackId: testTrack._id,
      title: 'Fix Test Module Deadline',
      slug: `fix-test-deadline-${Date.now()}`,
      description: 'Testing deadline in notification',
      status: 'draft',
    });

    const assignRes = await fetch(`${BASE_URL}/admin/assignments`, {
      method: 'POST',
      headers: authHeaders(saToken),
      body: JSON.stringify({
        module_id: testModule._id,
        engineer_ids: [engineer1._id],
        deadline_at: '2026-09-15T00:00:00.000Z',
      }),
    });
    const assignBody = await assignRes.json();
    assert(assignRes.status === 201, `Assignment created successfully (status ${assignRes.status})`);

    // Check the notification message includes deadline
    const latestNotif = await Notification.findOne({
      recipient_id: engineer1._id,
      type: 'assignment',
      title: 'New Module Assigned',
    }).sort({ createdAt: -1 });
    assert(latestNotif && latestNotif.message.includes('with deadline'), `Assignment notification includes deadline text: "${latestNotif?.message}"`);
    assert(latestNotif && latestNotif.message.includes('Sep'), `Assignment notification includes formatted date month`);

    // ============================================================
    // FIX 2: Super Admin Edit Role & Deactivate User
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  FIX 2: Super Admin Edit Role & Deactivate User');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test: Edit role
    const roleRes = await fetch(`${BASE_URL}/admin/users/${engineer1._id}/role`, {
      method: 'PUT',
      headers: authHeaders(saToken),
      body: JSON.stringify({ role: 'admin' }),
    });
    const roleBody = await roleRes.json();
    assert(roleRes.status === 200, `Edit role returns 200 (got ${roleRes.status})`);
    assert(roleBody.user?.role === 'admin', `User role updated to 'admin' (got '${roleBody.user?.role}')`);

    // Verify in DB
    const updatedUser1 = await User.findById(engineer1._id);
    assert(updatedUser1.role === 'admin', `DB reflects role change to 'admin'`);

    // Verify AuditLog
    const roleAudit = await AuditLog.findOne({ action: 'UPDATE_USER_ROLE', 'metadata.email': engineer1.email });
    assert(!!roleAudit, 'AuditLog entry created for role change');

    // Test: Invalid role
    const badRoleRes = await fetch(`${BASE_URL}/admin/users/${engineer1._id}/role`, {
      method: 'PUT',
      headers: authHeaders(saToken),
      body: JSON.stringify({ role: 'wizard' }),
    });
    assert(badRoleRes.status === 400, `Invalid role returns 400 (got ${badRoleRes.status})`);

    // Test: Deactivate user
    const deactivateRes = await fetch(`${BASE_URL}/admin/users/${engineer2._id}/status`, {
      method: 'PUT',
      headers: authHeaders(saToken),
      body: JSON.stringify({ isActive: false }),
    });
    const deactivateBody = await deactivateRes.json();
    assert(deactivateRes.status === 200, `Deactivate user returns 200 (got ${deactivateRes.status})`);
    assert(deactivateBody.user?.isActive === false, `User isActive is false`);
    assert(deactivateBody.user?.status === 'pending', `User status set to 'pending'`);

    // Verify in DB
    const deactivatedUser = await User.findById(engineer2._id);
    assert(deactivatedUser.isActive === false, 'DB reflects deactivated user');

    // Verify AuditLog
    const statusAudit = await AuditLog.findOne({ action: 'UPDATE_USER_STATUS', 'metadata.email': engineer2.email });
    assert(!!statusAudit, 'AuditLog entry created for status change');

    // Test: Reactivate user
    const reactivateRes = await fetch(`${BASE_URL}/admin/users/${engineer2._id}/status`, {
      method: 'PUT',
      headers: authHeaders(saToken),
      body: JSON.stringify({ isActive: true }),
    });
    const reactivateBody = await reactivateRes.json();
    assert(reactivateRes.status === 200, `Reactivate user returns 200`);
    assert(reactivateBody.user?.isActive === true, `User reactivated`);
    assert(reactivateBody.user?.status === 'active', `User status back to 'active'`);

    // Test: Non-SuperAdmin cannot edit roles
    const eng1AdminToken = jwt.sign({ id: engineer1._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const forbiddenRes = await fetch(`${BASE_URL}/admin/users/${engineer2._id}/role`, {
      method: 'PUT',
      headers: authHeaders(eng1AdminToken),
      body: JSON.stringify({ role: 'super_admin' }),
    });
    assert(forbiddenRes.status === 403, `Non-SuperAdmin gets 403 on role edit (got ${forbiddenRes.status})`);

    // ============================================================
    // FIX 3: Flexible CSV Header Aliases  
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  FIX 3: Flexible CSV Bulk Import Header Aliases');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const csvModule = await Module.create({
      trackId: testTrack._id,
      title: 'CSV Test Module',
      slug: `csv-test-${Date.now()}`,
      description: 'Testing CSV header aliases',
      status: 'draft',
    });

    // Use non-standard header names (the exact variations in the requirements)
    const csvContent = `Question Text,Option A,Option B,Option C,Option D,Answer,difficulty,concept_tag,module_id
"What is 2+2?","4","3","5","6","A","easy","math_basics","${csvModule._id}"
"What is the capital of Germany?","Paris","Berlin","London","Rome","B","medium","geography_eu","${csvModule._id}"
`;

    const formData = new FormData();
    const csvBlob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('file', csvBlob, 'questions_alias_test.csv');

    const csvImportRes = await fetch(`${BASE_URL}/admin/questions/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: formData,
    });
    const csvImportBody = await csvImportRes.json();
    assert(csvImportRes.status === 200, `CSV import returns 200 (got ${csvImportRes.status})`);
    assert(csvImportBody.successCount === 2, `2 questions imported successfully (got ${csvImportBody.successCount})`);
    assert(csvImportBody.failedCount === 0, `0 failures (got ${csvImportBody.failedCount})`);

    // Verify the questions were actually created correctly
    const importedQs = await mongoose.model('Question').find({ moduleId: csvModule._id, is_active: true });
    assert(importedQs.length === 2, `2 questions exist in DB for CSV module`);
    const q1 = importedQs.find(q => q.questionText === 'What is 2+2?');
    assert(!!q1, `Question "What is 2+2?" was imported`);
    assert(q1?.correct_option === 'A', `Correct option parsed via "Answer" header alias`);
    assert(q1?.option_a === '4', `Option A parsed correctly via "Option A" header alias`);

    // ============================================================
    // FIX 4: Remember Me Login Persistence
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  FIX 4: Remember Me Login Persistence');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Create user with known password for login test
    const loginTestUser = await User.create({
      fullName: 'Login Test User',
      email: `logintest_${Date.now()}@test.com`,
      password: await bcrypt.hash('SecurePass1!', salt),
      role: 'engineer',
    });

    // Test: Login WITH rememberMe=true → should get 30d token
    const loginRememberRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginTestUser.email, password: 'SecurePass1!', rememberMe: true }),
    });
    const loginRememberBody = await loginRememberRes.json();
    assert(loginRememberRes.status === 200, `Login with rememberMe returns 200`);
    assert(!!loginRememberBody.token, 'Login with rememberMe returns a token');

    // Decode and check expiry (~30 days)
    const decodedRemember = jwt.decode(loginRememberBody.token);
    const rememberExpDays = (decodedRemember.exp - decodedRemember.iat) / 86400;
    assert(rememberExpDays >= 29 && rememberExpDays <= 31, `Remember Me token expires in ~30 days (got ${rememberExpDays.toFixed(1)}d)`);

    // Test: Login WITHOUT rememberMe → should get 1d token
    const loginNormalRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginTestUser.email, password: 'SecurePass1!' }),
    });
    const loginNormalBody = await loginNormalRes.json();
    assert(loginNormalRes.status === 200, `Login without rememberMe returns 200`);

    const decodedNormal = jwt.decode(loginNormalBody.token);
    const normalExpDays = (decodedNormal.exp - decodedNormal.iat) / 86400;
    assert(normalExpDays >= 0.9 && normalExpDays <= 1.1, `Normal token expires in ~1 day (got ${normalExpDays.toFixed(2)}d)`);

    // ============================================================
    // RESULTS
    // ============================================================
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log('═══════════════════════════════════════════════════════════════════');

    if (failed === 0) {
      console.log('\n🎉 ALL 4 FIXES VERIFIED SUCCESSFULLY! 🎉\n');
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please review.\n`);
      process.exitCode = 1;
    }
  } finally {
*/
