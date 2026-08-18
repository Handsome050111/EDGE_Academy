const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');

const User = require('../models/User');
const Track = require('../models/Track');
const Module = require('../models/Module');
const ModulePrerequisite = require('../models/ModulePrerequisite');
const Question = require('../models/Question');
const Certificate = require('../models/Certificate');
const AuditLog = require('../models/AuditLog');
const VideoProgress = require('../models/VideoProgress');
const ConceptScore = require('../models/ConceptScore');

dotenv.config();

const runVerification = async () => {
  try {
    await connectDB();
    console.log('🧪 Starting Phase 1 Schema & Model Verification Tests...\n');

    let passedTests = 0;
    let failedTests = 0;

    const assert = (condition, testName) => {
      if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passedTests++;
      } else {
        console.error(`  ❌ FAIL: ${testName}`);
        failedTests++;
      }
    };

    // Test 1: User Schema & Aliases
    console.log('--- 1. User Model Verification ---');
    const testUser = await User.findOne({ email: 'ali.sultan@technonex.de' }).select('+password_hash');
    assert(testUser !== null, 'Find seeded Ali Sultan user');
    assert(testUser.full_name === 'Ali Sultan' && testUser.fullName === 'Ali Sultan', 'User full_name / fullName alias');
    assert(testUser.is_active === true && testUser.isActive === true, 'User is_active / isActive alias');
    assert(testUser.deleted_at === null, 'User deleted_at soft delete field present');
    assert(testUser.role === 'engineer', 'User role is engineer');

    // Test 2: Track Model & Icon & Aliases
    console.log('\n--- 2. Track Model Verification ---');
    const track = await Track.findOne({ slug: 'EDGE-L1' });
    assert(track !== null, 'Find seeded Track by slug EDGE-L1');
    assert(track.name === 'EDGE L1 — Certified Technician' && track.title === 'EDGE L1 — Certified Technician', 'Track name / title alias');
    assert(track.slug === 'EDGE-L1' && track.code === 'EDGE-L1', 'Track slug / code alias');
    assert(track.icon === 'shield-check', 'Track icon field populated');
    assert(track.display_order === 1 && track.displayOrder === 1, 'Track display_order / displayOrder alias');

    // Test 3: Module & ModulePrerequisite Verification
    console.log('\n--- 3. Module & ModulePrerequisite Verification ---');
    const mod = await Module.findOne({ slug: 'm1-cable-types-connectors' });
    assert(mod !== null, 'Find seeded Module by slug');
    assert(mod.track_id !== undefined, 'Module track_id field present');
    assert(mod.tier === 'L1_CORE', 'Module tier is L1_CORE');
    assert(mod.pass_threshold === 80 && mod.passingScorePercentage === 80, 'Module pass_threshold / passingScorePercentage alias');
    assert(mod.quiz_question_count === 6, 'Module quiz_question_count is 6');
    assert(mod.deleted_at === null, 'Module deleted_at field present');

    const prereqs = await ModulePrerequisite.find().populate('module_id prerequisite_module_id');
    assert(prereqs.length > 0, `ModulePrerequisite records exist (${prereqs.length} found)`);

    // Verify ModulePrerequisite Compound Unique Index
    console.log('\n--- 4. ModulePrerequisite Unique Constraint Test ---');
    const samplePrereq = prereqs[0];
    let duplicateRejected = false;
    try {
      await ModulePrerequisite.create({
        module_id: samplePrereq.module_id._id,
        prerequisite_module_id: samplePrereq.prerequisite_module_id._id,
      });
    } catch (err) {
      if (err.code === 11000) duplicateRejected = true;
    }
    assert(duplicateRejected, 'ModulePrerequisite duplicate { module_id, prerequisite_module_id } rejected with E11000');

    // Test 5: Question Model
    console.log('\n--- 5. Question Model Verification ---');
    const q = await Question.findOne({ module_id: mod._id });
    assert(q !== null, 'Find Question by module_id');
    assert(q.question_text !== undefined && q.questionText !== undefined, 'Question question_text / questionText alias');
    assert(q.created_by !== null && q.created_by !== undefined, 'Question created_by field present');
    assert(q.deleted_at === null, 'Question deleted_at field present');

    // Test 6: Certificate Model & Compound Unique Index
    console.log('\n--- 6. Certificate Model & Unique Index Test ---');
    await Certificate.syncIndexes();
    const certIndexes = await Certificate.collection.indexes();
    const hasCertCompoundIndex = certIndexes.some(
      (idx) => idx.key && idx.key.engineer_id === 1 && idx.key.track_id === 1 && idx.key.tier === 1 && idx.unique === true
    );
    assert(hasCertCompoundIndex, 'Certificate compound unique index { engineer_id: 1, track_id: 1, tier: 1 } registered in DB');

    // Test functional duplicate rejection on Certificate with isolated user & track
    const certTestUserId = new mongoose.Types.ObjectId();
    const certTestTrackId = new mongoose.Types.ObjectId();

    const cert1 = await Certificate.create({
      certificate_id: `TNX-2026-TST-${Date.now().toString().slice(-4)}`,
      engineer_id: certTestUserId,
      track_id: certTestTrackId,
      tier: 'L1_CORE',
      pdf_storage_path: '/uploads/certificates/test1.pdf',
    });

    let certDuplicateRejected = false;
    try {
      await Certificate.create({
        certificate_id: `TNX-2026-TST2-${Date.now().toString().slice(-4)}`,
        engineer_id: certTestUserId,
        track_id: certTestTrackId,
        tier: 'L1_CORE',
        pdf_storage_path: '/uploads/certificates/test2.pdf',
      });
    } catch (err) {
      if (err.code === 11000) certDuplicateRejected = true;
    }
    assert(certDuplicateRejected, 'Duplicate certificate for same engineer + track + tier rejected with E11000');

    // Cleanup test certificate
    await Certificate.deleteOne({ _id: cert1._id });


    // Test 7: AuditLog Canonical Schema
    console.log('\n--- 7. AuditLog Schema Verification ---');
    const audit = new AuditLog({
      user_id: testUser._id,
      action: 'module.published',
      entity_type: 'module',
      entity_id: mod._id.toString(),
      before_json: { status: 'draft' },
      after_json: { status: 'published' },
      ip_address: '127.0.0.1',
    });
    await audit.save();

    const fetchedAudit = await AuditLog.findById(audit._id);
    assert(fetchedAudit.user_id.toString() === testUser._id.toString(), 'AuditLog user_id stored and matches');
    assert(fetchedAudit.actorId.toString() === testUser._id.toString(), 'AuditLog actorId alias works');
    assert(fetchedAudit.entity_type === 'module' && fetchedAudit.resourceType === 'module', 'AuditLog entity_type / resourceType alias');
    assert(fetchedAudit.entity_id === mod._id.toString() && fetchedAudit.resourceId === mod._id.toString(), 'AuditLog entity_id / resourceId alias');
    assert(fetchedAudit.before_json.status === 'draft', 'AuditLog before_json stored correctly');
    assert(fetchedAudit.after_json.status === 'published', 'AuditLog after_json stored correctly');
    assert(fetchedAudit.ip_address === '127.0.0.1', 'AuditLog ip_address stored correctly');
    assert(fetchedAudit.occurred_at !== undefined, 'AuditLog occurred_at timestamp populated');

    // Cleanup test audit log
    await AuditLog.deleteOne({ _id: audit._id });

    console.log('\n==================================================');
    console.log(`🏁 Phase 1 Verification Completed: ${passedTests} Passed, ${failedTests} Failed.`);
    console.log('==================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Verification Error:', error);
    process.exit(1);
  }
};

runVerification();
