const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runPhase3Verification() {
  try {
    console.log('--- Starting Team Lead Phase 3 Verification ---');
    await mongoose.connect(process.env.MONGO_URI);

    // 1. Login as Team Lead
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lead@technonex.de',
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.token) {
      throw new Error(`Login failed for lead@technonex.de: ${JSON.stringify(loginData)}`);
    }

    const token = loginData.token;
    const teamId = loginData.team_id || loginData.user?.team_id || loginData.user?.teamId;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    console.log(`✅ Logged in as Team Lead. Team ID: ${teamId}`);

    // 2. Fetch Curriculum Tracks
    console.log('\n[TEST 1] Fetching Curriculum Tracks');
    const tracksRes = await fetch(`${BASE_URL}/tracks`, { headers: authHeaders });
    const tracksData = await tracksRes.json();
    console.log(`Tracks Fetch Status: ${tracksRes.status}`);

    if (tracksRes.status !== 200 || !Array.isArray(tracksData) || tracksData.length === 0) {
      throw new Error(`TEST 1 Failed: ${JSON.stringify(tracksData)}`);
    }

    const targetModule = tracksData[0]?.modules?.[0];
    if (!targetModule) {
      throw new Error('TEST 1 Failed: No target module found in seeded tracks');
    }
    console.log(`✅ TEST 1 Passed: Retrieved ${tracksData.length} published tracks. Target Module: ${targetModule.title} (${targetModule._id})`);

    // 3. Create Assignment via Team Lead Endpoint
    console.log('\n[TEST 2] Assigning Target Module to Entire Team');
    const assignRes = await fetch(`${BASE_URL}/admin/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        module_id: targetModule._id,
        team_id: teamId,
        deadline_at: '2026-12-31T23:59:59.000Z',
      }),
    });

    const assignData = await assignRes.json();
    console.log(`Assignment Status: ${assignRes.status}`);
    console.log(`Assignment Result:`, assignData.message);

    if (assignRes.status !== 201 || assignData.createdCount < 1) {
      throw new Error(`TEST 2 Failed: ${JSON.stringify(assignData)}`);
    }
    console.log('✅ TEST 2 Passed: Successfully created team module assignment');

    // 4. Verify Updated Metrics in Team Report
    console.log('\n[TEST 3] Verifying Team Dashboard Metrics reflect new assignment');
    const reportRes = await fetch(`${BASE_URL}/admin/reports/team/${teamId}`, { headers: authHeaders });
    const reportData = await reportRes.json();
    console.log(`Team Report Active Assignments: ${reportData.activeAssignments}`);

    if (reportRes.status !== 200 || reportData.activeAssignments < 1) {
      throw new Error(`TEST 3 Failed: Active assignments metric was not updated: ${JSON.stringify(reportData)}`);
    }
    console.log('✅ TEST 3 Passed: Live Team Dashboard metrics updated with active assignment!');

    console.log('\n🎉 PHASE 3 ASSIGNMENT MODAL & CURRICULUM BROWSER BACKEND-FRONTEND SYSTEM FULLY VERIFIED! 🎉');
  } catch (err) {
    console.error('❌ Phase 3 Verification Failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase3Verification();
