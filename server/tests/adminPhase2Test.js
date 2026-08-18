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
const ModuleAttachment = require('../models/ModuleAttachment');
const AuditLog = require('../models/AuditLog');
const adminRoutes = require('../routes/adminRoutes');

const TEST_PORT = 5051;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runTests = async () => {
  console.log('--- Starting Admin Phase 2 Automated Test Suite ---');
  await connectDB();

  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);

  const server = app.listen(TEST_PORT);
  console.log(`Test server running on port ${TEST_PORT}`);

  try {
    // 1. Setup Admin user
    let adminUser = await User.findOne({ role: { $in: ['Admin', 'SuperAdmin', 'admin', 'superadmin'] } });
    if (!adminUser) {
      adminUser = await User.create({
        fullName: 'Test Admin Phase2',
        email: `testadmin2_${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Admin',
      });
    }

    const token = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 2. Create dedicated fresh draft module for testing
    let testTrack = await Track.findOne();
    if (!testTrack) {
      testTrack = await Track.create({ title: 'Phase2 Track', code: 'P2', description: 'Test track' });
    }

    const testModule = await Module.create({
      trackId: testTrack._id,
      title: `Phase 2 Test Module ${Date.now()}`,
      description: 'Testing video, attachments, and publish guard',
      status: 'draft',
    });

    console.log(`Using Test Module ID: ${testModule._id}`);

    // TEST 1: Publish Guard Failure (No video & No questions)
    console.log('\n[TEST 1] Publish Guard Failure Check (POST /api/v1/admin/modules/:id/publish)');
    const publishFailRes1 = await fetch(`${BASE_URL}/admin/modules/${testModule._id}/publish`, {
      method: 'POST',
      headers: authHeaders,
    });

    const publishFailBody1 = await publishFailRes1.json();
    console.log(`Publish Fail Status: ${publishFailRes1.status}, Error:`, publishFailBody1.error);
    if (publishFailRes1.status !== 422 || !publishFailBody1.error.includes('Video attached: false')) {
      throw new Error(`Failed Test 1: expected 422 Unprocessable Entity, got ${publishFailRes1.status}`);
    }
    console.log('✅ Publish Guard correctly rejected module missing video and questions');

    // TEST 2: Video Upload Proxy
    console.log('\n[TEST 2] Video Upload Proxy (POST /api/v1/admin/modules/:id/video)');
    const videoFormData = new FormData();
    const mockVideoBlob = new Blob(['mock video binary content'], { type: 'video/mp4' });
    videoFormData.append('video', mockVideoBlob, 'sample_lecture.mp4');

    const videoRes = await fetch(`${BASE_URL}/admin/modules/${testModule._id}/video`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: videoFormData,
    });

    const videoBody = await videoRes.json();
    console.log(`Video Upload Status: ${videoRes.status}`);
    console.log(`Video Provider ID: ${videoBody.video_provider_id}`);

    const updatedModuleAfterVideo = await Module.findById(testModule._id);
    if (videoRes.status !== 200 || !updatedModuleAfterVideo.video_provider_id) {
      throw new Error(`Failed Test 2 Video Upload: ${JSON.stringify(videoBody)}`);
    }
    console.log('✅ Module video attached successfully');

    // TEST 3: Attachment Upload
    console.log('\n[TEST 3] Attachment Upload (POST /api/v1/admin/modules/:id/attachments)');
    const attachFormData = new FormData();
    const mockPdfBlob = new Blob(['%PDF-1.4 mock pdf content'], { type: 'application/pdf' });
    attachFormData.append('attachment', mockPdfBlob, 'handout.pdf');

    const attachRes = await fetch(`${BASE_URL}/admin/modules/${testModule._id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: attachFormData,
    });

    const attachBody = await attachRes.json();
    console.log(`Attachment Status: ${attachRes.status}`);
    const attachmentDoc = await ModuleAttachment.findOne({ module_id: testModule._id });
    if (attachRes.status !== 201 || !attachmentDoc) {
      throw new Error(`Failed Test 3 Attachment Upload: ${JSON.stringify(attachBody)}`);
    }
    console.log(`✅ ModuleAttachment created ID: ${attachmentDoc._id}, Filename: ${attachmentDoc.filename}`);

    // TEST 4: Publish Guard Failure (Video attached, but < 5 questions)
    console.log('\n[TEST 4] Publish Guard Failure Check with Video Attached but 0 Questions');
    const publishFailRes2 = await fetch(`${BASE_URL}/admin/modules/${testModule._id}/publish`, {
      method: 'POST',
      headers: authHeaders,
    });
    const publishFailBody2 = await publishFailRes2.json();
    console.log(`Publish Fail Status: ${publishFailRes2.status}, Error:`, publishFailBody2.error);
    if (publishFailRes2.status !== 422 || !publishFailBody2.error.includes('Video attached: true')) {
      throw new Error(`Failed Test 4: expected 422 with Video attached: true, got ${publishFailRes2.status}`);
    }
    console.log('✅ Publish Guard correctly rejected module with video but < 5 questions');

    // TEST 5: Create 5 Active Questions & Publish Successfully
    console.log('\n[TEST 5] Adding 5 Active MCQs and Publishing Module');
    const questionDocs = [];
    for (let i = 1; i <= 5; i++) {
      questionDocs.push({
        moduleId: testModule._id,
        questionText: `Question ${i} for Phase 2 Publish Test`,
        option_a: 'Option A',
        option_b: 'Option B',
        option_c: 'Option C',
        option_d: 'Option D',
        correct_option: 'A',
        concept_tag: 'phase2_test',
        difficulty: 'medium',
        version: 1,
        is_active: true,
      });
    }
    await Question.insertMany(questionDocs);
    console.log('Inserted 5 active questions');

    const publishSuccessRes = await fetch(`${BASE_URL}/admin/modules/${testModule._id}/publish`, {
      method: 'POST',
      headers: authHeaders,
    });

    const publishSuccessBody = await publishSuccessRes.json();
    console.log(`Publish Success Status: ${publishSuccessRes.status}`);
    console.log(`Published Status in DB: ${publishSuccessBody.module?.status}`);

    const publishedModule = await Module.findById(testModule._id);
    if (publishSuccessRes.status !== 200 || publishedModule.status !== 'published' || !publishedModule.published_at) {
      throw new Error(`Failed Test 5 Publish: ${JSON.stringify(publishSuccessBody)}`);
    }
    console.log('✅ Module publish validation guard passed and module successfully published!');

    // TEST 6: AuditLog Verification
    console.log('\n[TEST 6] AuditLog Verification for Phase 2 Actions');
    const phase2Logs = await AuditLog.find({ actorId: adminUser._id }).sort({ createdAt: -1 }).limit(10);
    console.log(`Found ${phase2Logs.length} audit log entries for user:`);
    phase2Logs.forEach((l) => console.log(`- Action: ${l.action} | Resource: ${l.resourceType}:${l.resourceId || 'N/A'} | Outcome: ${l.outcome}`));

    const videoLog = phase2Logs.find((l) => l.action === 'UPLOAD_MODULE_VIDEO');
    const attachLog = phase2Logs.find((l) => l.action === 'UPLOAD_MODULE_ATTACHMENT');
    const publishLog = phase2Logs.find((l) => l.action === 'PUBLISH_MODULE' && l.outcome === 'success');

    if (!videoLog || !attachLog || !publishLog) {
      throw new Error('Failed Test 6 AuditLog check: missing expected Phase 2 audit log entries');
    }
    console.log('✅ AuditLog creation for Phase 2 verified successfully');

    console.log('\n========================================================================');
    console.log('🎉 ALL PHASE 2 VIDEO, ATTACHMENT, & PUBLISH GUARD TESTS PASSED CLEANLY! 🎉');
    console.log('========================================================================');
  } finally {
    server.close();
    await mongoose.connection.close();
  }
};

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
