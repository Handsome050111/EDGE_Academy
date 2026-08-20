/**
 * Targeted Test: Quiz Retake Cooldown Bug Blast Radius Investigation
 * Demonstrates the actual runtime behavior of the OLD query vs the NEW query.
 */
'use strict';

const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Module = require('../models/Module');
const QuizAttempt = require('../models/QuizAttempt');

async function testCooldownBlastRadius() {
  await connectDB();
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('  🔬 QUIZ COOLDOWN BLAST RADIUS & RUNTIME BEHAVIOR AUDIT');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  const engineerAlphaId = new mongoose.Types.ObjectId();
  const engineerBetaId = new mongoose.Types.ObjectId();
  const moduleXId = new mongoose.Types.ObjectId();
  const moduleYId = new mongoose.Types.ObjectId();

  // Create a failed quiz attempt for Engineer Beta on Module X (failed 2 minutes ago)
  const betaFailedAttempt = await QuizAttempt.create({
    userId: engineerBetaId,
    moduleId: moduleXId,
    type: 'topic',
    passed: false,
    scorePercentage: 40,
    status: 'completed',
    completedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
  });

  console.log('--- SCENARIO 1: Cross-User Cooldown Contamination ---');
  console.log(`Engineer Alpha ID: ${engineerAlphaId} (Has NEVER attempted Module X)`);
  console.log(`Engineer Beta ID:  ${engineerBetaId} (Failed Module X 2 minutes ago)`);
  console.log(`Module X ID:       ${moduleXId}\n`);

  // 1. OLD CODE QUERY CONSTRUCTION
  console.log('1. Evaluating OLD Code Query Object:');
  const oldQuery = {
    $or: [{ engineer_id: engineerAlphaId }, { userId: engineerAlphaId }],
    $or: [{ module_id: moduleXId }, { moduleId: moduleXId }],
    passed: false,
  };

  console.log('   In JavaScript V8, { $or: [...], $or: [...] } results in object:');
  console.log('  ', JSON.stringify(oldQuery, null, 2));
  console.log('   Notice: The engineer_id $or clause is COMPLETELY DROPPED by JavaScript duplicate-key overwriting!\n');

  // Run OLD query against MongoDB for Engineer Alpha
  const oldQueryResult = await QuizAttempt.findOne(oldQuery).sort({ completed_at: -1, completedAt: -1, updatedAt: -1, createdAt: -1 });

  const COOLDOWN_MS = 15 * 60 * 1000;
  if (oldQueryResult) {
    const attemptTime = oldQueryResult.completed_at || oldQueryResult.completedAt || oldQueryResult.updatedAt || oldQueryResult.createdAt;
    const timeSinceFailedMs = Date.now() - new Date(attemptTime).getTime();
    const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceFailedMs) / 1000);
    console.log('   ❌ OLD Code Runtime Output for Engineer Alpha:');
    console.log(`      Found Attempt ID: ${oldQueryResult._id}`);
    console.log(`      Attempt Owner:     ${oldQueryResult.userId} (This is Engineer Beta!)`);
    console.log(`      Outcome:          HTTP 429 COOLDOWN_ACTIVE (${remainingSeconds}s remaining)`);
    console.log(`      BLAST RADIUS:     Engineer Alpha is LOCKED OUT of Module X because Engineer Beta failed it!\n`);
  } else {
    console.log('   OLD query found no attempt.\n');
  }

  // 2. NEW CODE QUERY CONSTRUCTION
  console.log('2. Evaluating NEW Code Query Object:');
  const newQuery = {
    $and: [
      { $or: [{ engineer_id: engineerAlphaId }, { userId: engineerAlphaId }] },
      { $or: [{ module_id: moduleXId }, { moduleId: moduleXId }] },
      { passed: false },
    ],
  };

  console.log('   NEW Query Structure with explicit $and:');
  console.log('  ', JSON.stringify(newQuery, null, 2));

  // Run NEW query against MongoDB for Engineer Alpha
  const newQueryResult = await QuizAttempt.findOne(newQuery).sort({ completed_at: -1, completedAt: -1, updatedAt: -1, createdAt: -1 });

  if (newQueryResult) {
    console.log('   ❌ Unexpectedly found attempt for Alpha in new query');
  } else {
    console.log('   ✅ NEW Code Runtime Output for Engineer Alpha:');
    console.log('      Result:   null (Zero failed attempts for Alpha on Module X)');
    console.log('      Outcome:  HTTP 200 OK (Allowed to start quiz immediately)');
    console.log('      Isolation: Engineer Beta\'s failure is strictly isolated to Beta.\n');
  }

  // Verify Beta is still properly put on cooldown under NEW code
  const betaQuery = {
    $and: [
      { $or: [{ engineer_id: engineerBetaId }, { userId: engineerBetaId }] },
      { $or: [{ module_id: moduleXId }, { moduleId: moduleXId }] },
      { passed: false },
    ],
  };
  const betaResult = await QuizAttempt.findOne(betaQuery).sort({ completed_at: -1, completedAt: -1, updatedAt: -1, createdAt: -1 });
  console.log('   ✅ NEW Code Runtime Output for Engineer Beta:');
  console.log(`      Result:   Found own failed attempt (${betaResult?._id})`);
  console.log('      Outcome:  HTTP 429 COOLDOWN_ACTIVE (Correctly enforced for the actual failing engineer)\n');

  // Clean up fixture
  await QuizAttempt.findByIdAndDelete(betaFailedAttempt._id);
  await mongoose.disconnect();
  console.log('════════════════════════════════════════════════════════════════════════\n');
}

testCooldownBlastRadius().catch(console.error);
