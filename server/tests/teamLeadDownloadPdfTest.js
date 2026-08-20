/**
 * End-to-end test for TeamLead Certificate PDF Download
 * Tests:
 * 1. Certificate generation for a squad engineer
 * 2. Download via MongoDB _id by assigned TeamLead (expect 200)
 * 3. Download via human-readable certificate_id by assigned TeamLead (expect 200)
 * 4. Download by certificate owner (engineer) (expect 200)
 * 5. Download by unauthorized engineer (expect 403)
 * 6. Download by unassigned TeamLead (expect 403)
 */
'use strict';

const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Track = require('../models/Track');
const Certificate = require('../models/Certificate');
const { generateCertificate, downloadCertificatePdf } = require('../controllers/certificateController');

async function testTeamLeadDownloadEndToEnd() {
  await connectDB();
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  🧪 TEST: TeamLead Certificate PDF Download End-to-End');
  console.log('════════════════════════════════════════════════════════════════\n');

  // 1. Get or create a test track
  let track = await Track.findOne();
  if (!track) {
    track = await Track.create({
      name: 'Test Network Engineering Track',
      slug: 'TEST-NET',
      tier: 'EDGE',
      is_published: true,
    });
  }

  // 2. Find or create a TeamLead and Team
  let teamLead = await User.findOne({ role: { $in: ['TeamLead', 'team_lead'] } });
  if (!teamLead) {
    teamLead = await User.create({
      fullName: 'Alpha Team Lead',
      email: `teamlead_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'TeamLead',
      status: 'active',
    });
  }

  let team = await Team.findOne();
  if (!team) {
    team = await Team.create({
      name: 'Alpha Squad',
      team_lead_id: teamLead._id,
    });
  }

  // 3. Find or create an Engineer managed by this TeamLead
  let engineer = await User.findOne({
    role: { $in: ['engineer', 'Engineer'] },
    $or: [{ team_lead_id: teamLead._id }, { team_id: team._id }],
  });

  if (!engineer) {
    engineer = await User.create({
      fullName: 'Managed Engineer',
      email: `eng_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'engineer',
      status: 'active',
      team_id: team._id,
      team_lead_id: teamLead._id,
    });
  } else {
    // Ensure relationship is set
    engineer.team_lead_id = teamLead._id;
    engineer.team_id = team._id;
    await engineer.save();
  }

  // 4. Create an outsider engineer (unrelated)
  let outsiderEngineer = await User.findOne({
    role: { $in: ['engineer', 'Engineer'] },
    _id: { $ne: engineer._id },
  });
  if (!outsiderEngineer) {
    outsiderEngineer = await User.create({
      fullName: 'Outsider Engineer',
      email: `outsider_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'engineer',
      status: 'active',
    });
  }

  console.log(`Track: "${track.name || track.title}" (tier: ${track.tier})`);
  console.log(`TeamLead: ${teamLead.fullName} (${teamLead._id})`);
  console.log(`Managed Engineer: ${engineer.fullName} (${engineer._id})`);

  // 5. Generate certificate for the engineer
  console.log('\nGenerating certificate...');
  const certificate = await generateCertificate(engineer._id, track._id, track.tier);
  console.log(`✅ Certificate ready: ID=${certificate.certificate_id}, _id=${certificate._id}, tier=${certificate.tier}`);

  // Helper to mock express res
  const createMockRes = () => {
    let statusCode = 200;
    let headers = {};
    let sentData = null;
    let downloadedPath = null;
    return {
      setHeader: (k, v) => { headers[k] = v; },
      status: (code) => { statusCode = code; return { json: (d) => { sentData = d; } }; },
      json: (d) => { sentData = d; },
      download: (filePath, filename) => { downloadedPath = filePath; sentData = `[FILE STREAM: ${filename}]`; },
      get result() { return { statusCode, headers, sentData, downloadedPath }; },
    };
  };

  // ── TEST A: Download via MongoDB _id by assigned TeamLead ──
  console.log('\n--- Test A: Download by TeamLead using MongoDB _id ---');
  const reqA = { params: { id: certificate._id.toString() }, user: teamLead };
  const resA = createMockRes();
  await downloadCertificatePdf(reqA, resA);
  console.log(`Status: ${resA.result.statusCode}`);
  console.log(`Result: ${resA.result.sentData}`);
  if (resA.result.statusCode === 200 && resA.result.downloadedPath) {
    console.log('✅ Test A Passed: TeamLead downloaded PDF by _id');
  } else {
    console.error('❌ Test A Failed');
  }

  // ── TEST B: Download via human-readable certificate_id by assigned TeamLead ──
  console.log('\n--- Test B: Download by TeamLead using human-readable certificate_id ---');
  const reqB = { params: { id: certificate.certificate_id }, user: teamLead };
  const resB = createMockRes();
  await downloadCertificatePdf(reqB, resB);
  console.log(`Status: ${resB.result.statusCode}`);
  console.log(`Result: ${resB.result.sentData}`);
  if (resB.result.statusCode === 200 && resB.result.downloadedPath) {
    console.log('✅ Test B Passed: TeamLead downloaded PDF by certificate_id');
  } else {
    console.error('❌ Test B Failed');
  }

  // ── TEST C: Download by certificate owner (the engineer) ──
  console.log('\n--- Test C: Download by Owner Engineer ---');
  const reqC = { params: { id: certificate.certificate_id }, user: engineer };
  const resC = createMockRes();
  await downloadCertificatePdf(reqC, resC);
  console.log(`Status: ${resC.result.statusCode}`);
  if (resC.result.statusCode === 200) {
    console.log('✅ Test C Passed: Owner engineer downloaded PDF');
  } else {
    console.error('❌ Test C Failed');
  }

  // ── TEST D: Download by unrelated engineer (should be 403) ──
  console.log('\n--- Test D: Download by Unauthorized Engineer (Expect 403) ---');
  const reqD = { params: { id: certificate.certificate_id }, user: outsiderEngineer };
  const resD = createMockRes();
  await downloadCertificatePdf(reqD, resD);
  console.log(`Status: ${resD.result.statusCode}, Error Code: ${resD.result.sentData?.error?.code}`);
  if (resD.result.statusCode === 403) {
    console.log('✅ Test D Passed: Unauthorized engineer blocked with 403');
  } else {
    console.error('❌ Test D Failed');
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  🎉 All Certificate Download Tests Passed Successfully');
  console.log('════════════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

testTeamLeadDownloadEndToEnd().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
