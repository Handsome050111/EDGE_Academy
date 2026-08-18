/**
 * Database Reset Script
 * Wipes all dummy collections, tracks, modules, teams, and transactional data,
 * preserving ONLY the Admin account (admin@technonex.de) for clean testing.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');

const User = require('./models/User');
const Team = require('./models/Team');
const Track = require('./models/Track');
const Module = require('./models/Module');
const ModulePrerequisite = require('./models/ModulePrerequisite');
const ModuleAttachment = require('./models/ModuleAttachment');
const Question = require('./models/Question');
const QuizAttempt = require('./models/QuizAttempt');
const AttemptResponse = require('./models/AttemptResponse');
const Assignment = require('./models/Assignment');
const Certificate = require('./models/Certificate');
const CertificateConfig = require('./models/CertificateConfig');
const VideoProgress = require('./models/VideoProgress');
const ConceptScore = require('./models/ConceptScore');
const Progress = require('./models/Progress');
const Notification = require('./models/Notification');
const AuditLog = require('./models/AuditLog');

const resetDatabase = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB.\n');

    // 1. Wipe all content and transactional collections completely
    console.log('🔄 Wiping all data collections...');
    const collectionsToWipe = [
      { model: Track, name: 'Tracks' },
      { model: Module, name: 'Modules' },
      { model: ModulePrerequisite, name: 'Module Prerequisites' },
      { model: ModuleAttachment, name: 'Module Attachments' },
      { model: Question, name: 'Questions' },
      { model: QuizAttempt, name: 'Quiz Attempts' },
      { model: AttemptResponse, name: 'Attempt Responses' },
      { model: Assignment, name: 'Assignments' },
      { model: Certificate, name: 'Certificates' },
      { model: CertificateConfig, name: 'Certificate Configs' },
      { model: VideoProgress, name: 'Video Progress' },
      { model: ConceptScore, name: 'Concept Scores' },
      { model: Progress, name: 'Progress' },
      { model: Notification, name: 'Notifications' },
      { model: AuditLog, name: 'Audit Logs' },
      { model: Team, name: 'Teams' },
    ];

    for (const { model, name } of collectionsToWipe) {
      const result = await model.deleteMany({});
      console.log(`  ✓ Deleted ${result.deletedCount} ${name}`);
    }

    // 2. Hash default admin password
    const BCRYPT_COST_FACTOR = 12;
    const adminPasswordHash = await bcrypt.hash('Password123!', BCRYPT_COST_FACTOR);

    // 3. Find or Create the Admin User
    let adminUser = await User.findOne({
      $or: [
        { email: 'admin@technonex.de' },
        { role: 'admin' },
      ],
    });

    if (adminUser) {
      adminUser.full_name = 'Admin User';
      adminUser.email = 'admin@technonex.de';
      adminUser.password_hash = adminPasswordHash;
      adminUser.role = 'admin';
      adminUser.locale = 'en';
      adminUser.team_id = null;
      adminUser.team_lead_id = null;
      adminUser.status = 'active';
      adminUser.is_active = true;
      adminUser.deleted_at = null;
      adminUser.lock_until = null;
      adminUser.failed_login_attempts = 0;
      adminUser.invite_token = null;
      adminUser.invite_token_expires = null;
      await adminUser.save();
      console.log(`\n  ✓ Preserved & Re-initialized Admin: ${adminUser.email}`);
    } else {
      adminUser = await User.create({
        full_name: 'Admin User',
        email: 'admin@technonex.de',
        password_hash: adminPasswordHash,
        role: 'admin',
        locale: 'en',
        team_id: null,
        team_lead_id: null,
        status: 'active',
        is_active: true,
        deleted_at: null,
      });
      console.log(`\n  ✓ Created Clean Admin Account: ${adminUser.email}`);
    }

    // 4. Delete all other users
    const userDeleteResult = await User.deleteMany({ _id: { $ne: adminUser._id } });
    console.log(`  ✓ Deleted ${userDeleteResult.deletedCount} other user accounts.`);

    console.log('\n==================================================');
    console.log('🎉 DATABASE RESET COMPLETE — CLEAN TESTING READY');
    console.log('==================================================');
    console.log(`Only the Admin account exists in the database:`);
    console.log(`  Email:    admin@technonex.de`);
    console.log(`  Password: Password123!`);
    console.log(`  Role:     admin`);
    console.log(`  Portal:   http://localhost:5173/admin`);
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    process.exit(1);
  }
};

resetDatabase();
