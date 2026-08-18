const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runPhase2Verification() {
  try {
    console.log('--- Starting Team Lead Phase 2 Verification ---');
    await mongoose.connect(process.env.MONGO_URI);

    // 1. Login as Team Lead (lead@technonex.de)
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lead@technonex.de',
        password: 'Password123!',
      }),
    });

    const loginData = await loginRes.json();
    console.log(`Login Status: ${loginRes.status}`);
    if (loginRes.status !== 200 || !loginData.token) {
      throw new Error(`Login failed for lead@technonex.de: ${JSON.stringify(loginData)}`);
    }

    const token = loginData.token;
    const teamId = loginData.user?.team_id || loginData.user?.teamId;
    console.log(`✅ Logged in as Team Lead. User Team ID: ${teamId}`);

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 2. Fetch Team Report
    console.log('\n[TEST 1] Fetching Team Report for Team Lead');
    const teamReportRes = await fetch(`${BASE_URL}/admin/reports/team/${teamId || 'me'}`, { headers: authHeaders });
    const teamReport = await teamReportRes.json();
    console.log(`Team Report Status: ${teamReportRes.status}`);
    console.log('Team Metrics:', {
      teamId: teamReport.teamId,
      totalEngineers: teamReport.totalEngineers,
      activeAssignments: teamReport.activeAssignments,
      averageQuizScore: teamReport.averageQuizScore,
      completionRate: teamReport.completionRate,
      engineersCount: teamReport.engineers?.length,
    });

    if (teamReportRes.status !== 200 || !teamReport.engineers) {
      throw new Error(`TEST 1 Failed: ${JSON.stringify(teamReport)}`);
    }

    const sampleEng = teamReport.engineers[0];
    if (sampleEng) {
      console.log('Sample Engineer Data:', {
        fullName: sampleEng.fullName,
        email: sampleEng.email,
        completedModulesCount: sampleEng.completedModulesCount,
        activeAssignmentsCount: sampleEng.activeAssignmentsCount,
        earnedCertificatesCount: sampleEng.earnedCertificatesCount,
        weakConcept: sampleEng.weakConcept,
      });
      if (
        sampleEng.completedModulesCount === undefined ||
        sampleEng.activeAssignmentsCount === undefined ||
        sampleEng.earnedCertificatesCount === undefined
      ) {
        throw new Error('TEST 1 Failed: Enhanced metrics missing on engineer object');
      }
    }
    console.log('✅ TEST 1 Passed: Team Report API returns valid metrics and enhanced engineer objects');

    // 3. Fetch Weak Concepts Report
    console.log('\n[TEST 2] Fetching Weak Concepts Report for Team Lead');
    const conceptsRes = await fetch(`${BASE_URL}/admin/reports/weak-concepts`, { headers: authHeaders });
    const conceptsData = await conceptsRes.json();
    console.log(`Weak Concepts Status: ${conceptsRes.status}`);
    console.log(`Tracked Concepts: ${conceptsData.totalConceptsTracked}`);

    if (conceptsRes.status !== 200 || !Array.isArray(conceptsData.weakConcepts)) {
      throw new Error(`TEST 2 Failed: ${JSON.stringify(conceptsData)}`);
    }
    console.log('✅ TEST 2 Passed: Weak concepts API returns team-scoped structure');

    console.log('\n🎉 PHASE 2 BACKEND-FRONTEND API INTEGRATION VERIFIED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Phase 2 Verification Failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase2Verification();
