const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');

const User = require('../models/User');
const Team = require('../models/Team');
const Track = require('../models/Track');
const Module = require('../models/Module');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const AttemptResponse = require('../models/AttemptResponse');
const AuditLog = require('../models/AuditLog');

const { loginUser, logoutUser } = require('../controllers/authController');
const { getTeamReport, getModuleReport, getWeakConceptsReport } = require('../controllers/adminReportController');
const { getUsers } = require('../controllers/adminUserController');

const runTests = async () => {
  try {
    await connectDB();
    console.log('🧪 Starting Phase 2 Security, Auth & Team Scope Isolation Verification Tests...\n');

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

    const mockRes = () => {
      let resData = null;
      let resStatus = 200;
      let resHeaders = {};
      return {
        status: (code) => {
          resStatus = code;
          return {
            json: (data) => {
              resData = data;
              return data;
            },
            send: (data) => {
              resData = data;
              return data;
            },
          };
        },
        json: (data) => {
          resData = data;
          return data;
        },
        send: (data) => {
          resData = data;
          return data;
        },
        getData: () => resData,
        getStatus: () => resStatus,
      };
    };

    // ==========================================
    // SECTION 1: POST /api/v1/auth/logout (204)
    // ==========================================
    console.log('--- 1. Authentication Logout Test ---');
    const testUser = await User.findOne({ email: 'ali.sultan@technonex.de' });
    const logoutReq = { user: testUser };
    const logoutRes = mockRes();
    await logoutUser(logoutReq, logoutRes);

    assert(logoutRes.getStatus() === 204, 'POST /api/v1/auth/logout returns HTTP 204 No Content');

    const logoutAudit = await AuditLog.findOne({
      user_id: testUser._id,
      action: 'user_logged_out',
    }).sort({ occurred_at: -1 });
    assert(logoutAudit !== null, 'Logout event recorded in AuditLog');

    // ==========================================
    // SECTION 2: 5-Failed Logins 15-Min Lockout
    // ==========================================
    console.log('\n--- 2. Brute-Force Protection & Account Lockout Test ---');
    const lockoutEmail = `lockout_test_${Date.now()}@technonex.de`;
    const passwordHash = await bcrypt.hash('CorrectPassword123!', 12);
    const lockoutUser = await User.create({
      full_name: 'Lockout Test Engineer',
      email: lockoutEmail,
      password_hash: passwordHash,
      role: 'engineer',
      status: 'active',
      is_active: true,
      failed_login_attempts: 0,
      lock_until: null,
    });

    // Attempts 1 to 4 with incorrect password
    for (let i = 1; i <= 4; i++) {
      const res = mockRes();
      await loginUser({ body: { email: lockoutEmail, password: 'WrongPassword!' } }, res);
      assert(res.getStatus() === 401, `Failed login attempt ${i}/5 returns 401 Unauthorized`);
      const updatedUser = await User.findById(lockoutUser._id);
      assert(updatedUser.failed_login_attempts === i, `failed_login_attempts incremented to ${i}`);
      assert(updatedUser.lock_until === null, `lock_until is null after attempt ${i}`);
    }

    // 5th failed attempt -> Must trigger 15-minute account lockout
    const res5 = mockRes();
    await loginUser({ body: { email: lockoutEmail, password: 'WrongPassword!' } }, res5);
    assert(res5.getStatus() === 403, '5th consecutive failed attempt returns 403 Forbidden');
    const res5Data = res5.getData();
    assert(res5Data && res5Data.error && res5Data.error.code === 'ACCOUNT_LOCKED', 'Response code is ACCOUNT_LOCKED');

    const lockedUser = await User.findById(lockoutUser._id);
    assert(lockedUser.lock_until !== null && lockedUser.lock_until > Date.now(), 'lock_until is set in future (~15 mins)');
    assert(lockedUser.isLocked === true, 'Virtual isLocked returns true');

    // Attempt login with CORRECT password while account is locked -> Must still be rejected with 403
    const resLockedCorrect = mockRes();
    await loginUser({ body: { email: lockoutEmail, password: 'CorrectPassword123!' } }, resLockedCorrect);
    assert(resLockedCorrect.getStatus() === 403, 'Login with correct password while locked is rejected with 403');

    // Simulate lockout expiry
    lockedUser.lock_until = new Date(Date.now() - 1000);
    await lockedUser.save();

    // Login after expiry with correct password -> Must succeed and reset counters
    const resUnlockedSuccess = mockRes();
    await loginUser({ body: { email: lockoutEmail, password: 'CorrectPassword123!' } }, resUnlockedSuccess);
    assert(resUnlockedSuccess.getStatus() === 200, 'Login succeeds after lock expiry with correct password');

    const freshUser = await User.findById(lockoutUser._id);
    assert(freshUser.failed_login_attempts === 0, 'failed_login_attempts reset to 0 on success');
    assert(freshUser.lock_until === null, 'lock_until reset to null on success');

    // Cleanup lockout test user
    await User.deleteOne({ _id: lockoutUser._id });

    // ==========================================
    // SECTION 3: Query-Level Team Scope Isolation
    // ==========================================
    console.log('\n--- 3. Query-Level Team Scope Isolation Tests ---');

    // Create 2 teams: Team Alpha & Team Beta
    const teamAlpha = await Team.create({ name: 'Alpha Squad', region: 'EMEA' });
    const teamBeta = await Team.create({ name: 'Beta Squad', region: 'APAC' });

    // Create Team Lead for Alpha
    const teamLeadAlpha = await User.create({
      full_name: 'Lead Alpha',
      email: `lead_alpha_${Date.now()}@technonex.de`,
      password_hash: passwordHash,
      role: 'team_lead',
      team_id: teamAlpha._id,
      status: 'active',
      is_active: true,
    });

    // Create Engineers in Alpha & Beta
    const engAlpha1 = await User.create({
      full_name: 'Alpha Engineer 1',
      email: `alpha1_${Date.now()}@technonex.de`,
      password_hash: passwordHash,
      role: 'engineer',
      team_id: teamAlpha._id,
      status: 'active',
      is_active: true,
    });
    const engAlpha2 = await User.create({
      full_name: 'Alpha Engineer 2',
      email: `alpha2_${Date.now()}@technonex.de`,
      password_hash: passwordHash,
      role: 'engineer',
      team_id: teamAlpha._id,
      status: 'active',
      is_active: true,
    });
    const engBeta1 = await User.create({
      full_name: 'Beta Engineer 1',
      email: `beta1_${Date.now()}@technonex.de`,
      password_hash: passwordHash,
      role: 'engineer',
      team_id: teamBeta._id,
      status: 'active',
      is_active: true,
    });

    // 3A: getUsers Scope Isolation
    console.log('  -> Testing getUsers team isolation:');
    const reqUsersTL = { user: teamLeadAlpha, query: {} };
    const resUsersTL = mockRes();
    await getUsers(reqUsersTL, resUsersTL);
    const returnedUsersTL = resUsersTL.getData() || [];

    const returnedUserIds = returnedUsersTL.map((u) => u._id.toString());
    assert(returnedUserIds.includes(engAlpha1._id.toString()), 'Team Alpha engineer 1 included in user list');
    assert(returnedUserIds.includes(engAlpha2._id.toString()), 'Team Alpha engineer 2 included in user list');
    assert(!returnedUserIds.includes(engBeta1._id.toString()), 'Team Beta engineer excluded from user list');
    assert(!returnedUserIds.includes(teamLeadAlpha._id.toString()), 'Admin / non-engineer excluded from team user list');

    // 3B: getTeamReport Scope Isolation
    console.log('  -> Testing getTeamReport team isolation:');
    // Team Lead Alpha tries to query Team Beta
    const reqCrossTeam = { user: teamLeadAlpha, params: { id: teamBeta._id.toString() } };
    const resCrossTeam = mockRes();
    await getTeamReport(reqCrossTeam, resCrossTeam);
    assert(resCrossTeam.getStatus() === 403, 'Team Lead requesting another team report rejected with 403 Forbidden');

    // Team Lead Alpha queries own team
    const reqOwnTeam = { user: teamLeadAlpha, params: { id: teamAlpha._id.toString() } };
    const resOwnTeam = mockRes();
    await getTeamReport(reqOwnTeam, resOwnTeam);
    assert(resOwnTeam.getStatus() === 200, 'Team Lead requesting own team report succeeds');
    const ownTeamData = resOwnTeam.getData();
    assert(ownTeamData.totalEngineers === 2, 'Team Lead sees exactly 2 engineers in their squad');

    // 3C: getModuleReport Scope Isolation
    console.log('  -> Testing getModuleReport team isolation:');
    const sampleMod = await Module.findOne({ status: 'published' });

    // Create a QuizAttempt for Alpha1 (Score: 100, Passed: true) and Beta1 (Score: 50, Passed: false)
    const attemptAlpha = await QuizAttempt.create({
      engineer_id: engAlpha1._id,
      module_id: sampleMod._id,
      quiz_type: 'topic',
      score_percent: 100,
      passed: true,
      status: 'completed',
    });
    const attemptBeta = await QuizAttempt.create({
      engineer_id: engBeta1._id,
      module_id: sampleMod._id,
      quiz_type: 'topic',
      score_percent: 50,
      passed: false,
      status: 'completed',
    });


    const reqModReportTL = { user: teamLeadAlpha, params: { id: sampleMod._id.toString() } };
    const resModReportTL = mockRes();
    await getModuleReport(reqModReportTL, resModReportTL);
    const modReportData = resModReportTL.getData();

    assert(modReportData.totalAttempts === 1, 'Team Lead only sees 1 attempt belonging to their team (Beta attempt excluded)');
    assert(modReportData.averageScore === 100, 'Average score is 100% (scoped to Team Alpha)');
    assert(modReportData.passedAttempts === 1, 'Passed attempts is 1 (scoped to Team Alpha)');

    // Clean up test data
    await QuizAttempt.deleteMany({ _id: { $in: [attemptAlpha._id, attemptBeta._id] } });
    await User.deleteMany({ _id: { $in: [teamLeadAlpha._id, engAlpha1._id, engAlpha2._id, engBeta1._id] } });
    await Team.deleteMany({ _id: { $in: [teamAlpha._id, teamBeta._id] } });

    console.log('\n==================================================');
    console.log(`🏁 Phase 2 Verification Completed: ${passedTests} Passed, ${failedTests} Failed.`);
    console.log('==================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Verification Error:', error);
    process.exit(1);
  }
};

runTests();
