const assert = require('assert');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = require('../server');
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const AttemptResponse = require('../models/AttemptResponse');
const Certificate = require('../models/Certificate');
const CertificateConfig = require('../models/CertificateConfig');

const prefix = `hardening_${Date.now()}`;
const emailA = `${prefix}_a@example.com`;
const emailB = `${prefix}_b@example.com`;
const emailAdmin = `${prefix}_admin@example.com`;
let server;
let baseUrl;
let userA;
let userB;
let admin;
let track;
let testModule;
let questionIssued;
let questionForeign;
let attempt;

const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET);

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }
  return { response, body };
}

async function run() {
  await connectDB();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  userA = await User.create({ full_name: 'Hardening User A', email: emailA, role: 'engineer', password_hash: 'passwordA' });
  userB = await User.create({ full_name: 'Hardening User B', email: emailB, role: 'engineer', password_hash: 'passwordB' });
  admin = await User.create({ full_name: 'Hardening Admin', email: emailAdmin, role: 'admin', password_hash: 'passwordAdmin' });
  track = await Track.create({ name: `${prefix} Track`, slug: prefix, tier: 'EDGE', is_published: true });
  testModule = await Module.create({
    track_id: track._id,
    title: `${prefix} Module`,
    status: 'published',
    deleted_at: null,
    video_provider_id: 'test-video',
  });
  await Track.updateOne({ _id: track._id }, { $set: { modules: [testModule._id] } });
  questionIssued = await Question.create({
    module_id: testModule._id,
    question_text: `${prefix} issued`,
    option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
    correct_option: 'A', concept_tag: `${prefix}_issued`, difficulty: 'easy',
  });
  questionForeign = await Question.create({
    module_id: testModule._id,
    question_text: `${prefix} foreign`,
    option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
    correct_option: 'A', concept_tag: `${prefix}_foreign`, difficulty: 'easy',
  });
  attempt = await QuizAttempt.create({
    userId: userA._id,
    type: 'topic',
    moduleId: testModule._id,
    issuedQuestionIds: [questionIssued._id],
    status: 'in_progress',
  });

  const certificateConfig = await CertificateConfig.findOneAndUpdate(
    {},
    { $set: { director_name: `${prefix} Director` } },
    { upsert: true, new: true }
  );
  await Certificate.create({
    certificate_id: `${prefix}-CERT`, engineer_id: userA._id, track_id: track._id,
    tier: 'EDGE', issued_at: new Date(), pdf_storage_path: '/uploads/certificates/test.pdf',
    director_name: certificateConfig.director_name, status: 'active',
  });

  const crossUserCertificate = await request('/api/v1/certificates/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userA)}` },
    body: JSON.stringify({ engineer_id: userB._id.toString(), track_id: track._id.toString() }),
  });
  assert.strictEqual(crossUserCertificate.response.status, 403);
  console.log('CERTIFICATE before/after regression: cross-user request rejected with 403');

  const ownCertificate = await request('/api/v1/certificates/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userA)}` },
    body: JSON.stringify({ engineer_id: userA._id.toString(), track_id: track._id.toString() }),
  });
  assert.strictEqual(ownCertificate.response.status, 200);
  console.log('CERTIFICATE regression: own-user request succeeds with 200');

  const foreignQuestion = await request(`/api/v1/attempts/${attempt._id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userA)}` },
    body: JSON.stringify({ answers: [{ question_id: questionForeign._id.toString(), selected_option: 'A' }] }),
  });
  assert.strictEqual(foreignQuestion.response.status, 400);
  assert.strictEqual(foreignQuestion.body.error.code, 'INVALID_QUESTION');
  console.log('QUIZ before/after regression: unissued question rejected with 400 INVALID_QUESTION');

  const issuedQuestion = await request(`/api/v1/attempts/${attempt._id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userA)}` },
    body: JSON.stringify({ answers: [{ question_id: questionIssued._id.toString(), selected_option: 'A' }] }),
  });
  assert.strictEqual(issuedQuestion.response.status, 200);
  console.log('QUIZ regression: issued question submission succeeds with 200');

  const progress = await request('/api/v1/progress/complete-module', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userB)}` },
    body: JSON.stringify({ trackId: track._id.toString(), moduleId: testModule._id.toString(), quizScore: 100 }),
  });
  assert.strictEqual(progress.response.status, 404);
  console.log('PROGRESS before/after regression: removed legacy endpoint rejects direct request with 404');

  const invalidUpload = new FormData();
  invalidUpload.append('video', new Blob(['not a video'], { type: 'text/plain' }), 'payload.txt');
  const invalidVideo = await request(`/api/v1/admin/modules/${testModule._id}/video`, {
    method: 'POST', headers: { Authorization: `Bearer ${tokenFor(admin)}` }, body: invalidUpload,
  });
  assert.strictEqual(invalidVideo.response.status, 400);
  console.log('UPLOAD before/after regression: non-video upload rejected with 400');

  const validUpload = new FormData();
  validUpload.append('video', new Blob([Buffer.from('fake mp4 fixture')], { type: 'video/mp4' }), 'fixture.mp4');
  const validVideo = await request(`/api/v1/admin/modules/${testModule._id}/video`, {
    method: 'POST', headers: { Authorization: `Bearer ${tokenFor(admin)}` }, body: validUpload,
  });
  assert.strictEqual(validVideo.response.status, 200);
  console.log('UPLOAD regression: MP4 upload accepted with 200');

  if (validVideo.body?.module?.videoUrl) {
    const uploadedPath = path.join(__dirname, '..', validVideo.body.module.videoUrl);
    if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
  }

  console.log('All new security-hardening integration checks passed.');
}

run()
  .catch((error) => {
    console.error('Security-hardening integration test failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState) {
      await Promise.all([
        User.deleteMany({ email: { $in: [emailA, emailB, emailAdmin] } }),
        Track.deleteOne({ _id: track?._id }),
        Module.deleteOne({ _id: testModule?._id }),
        Question.deleteMany({ _id: { $in: [questionIssued?._id, questionForeign?._id] } }),
        QuizAttempt.deleteOne({ _id: attempt?._id }),
        AttemptResponse.deleteMany({ attempt_id: attempt?._id }),
        Certificate.deleteMany({ certificate_id: `${prefix}-CERT` }),
      ]);
      await mongoose.disconnect();
    }
  });
