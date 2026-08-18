const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Team = require('../models/Team');
const ConceptScore = require('../models/ConceptScore');
const { getWeakConceptsReport } = require('../controllers/adminReportController');

const testWeakConceptsReport = async () => {
  try {
    await connectDB();
    console.log('Testing Weak Concepts Map Aggregation & Team Lead Scope Isolation...\n');

    // 1. Setup Team & Team Lead
    const teamLead = await User.create({
      full_name: 'Concept Lead Tester',
      email: `lead_concept_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'team_lead',
      is_active: true,
      status: 'active',
    });

    const testTeam = await Team.create({
      name: 'Field Ops Concept Squad',
      region: 'EMEA',
      lead_user_id: teamLead._id,
    });

    teamLead.team_id = testTeam._id;
    await teamLead.save();

    // 2. Setup 2 Squad Engineers + 1 Outside Engineer
    const squadEng1 = await User.create({
      full_name: 'Squad Eng 1',
      email: `squad_eng1_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'engineer',
      team_id: testTeam._id,
      team_lead_id: teamLead._id,
      is_active: true,
      status: 'active',
    });

    const squadEng2 = await User.create({
      full_name: 'Squad Eng 2',
      email: `squad_eng2_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'engineer',
      team_id: testTeam._id,
      team_lead_id: teamLead._id,
      is_active: true,
      status: 'active',
    });

    const outsideEng = await User.create({
      full_name: 'Outside Eng',
      email: `outside_eng_${Date.now()}@technonex.de`,
      password_hash: 'hash123',
      role: 'engineer',
      is_active: true,
      status: 'active',
    });

    // Helper mock response
    const mockRes = () => {
      const res = {
        statusCode: 200,
        data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.data = payload;
          return this;
        },
      };
      return res;
    };

    // TEST 1: Empty Team handling (0 quiz attempts / concept scores)
    const reqEmpty = { user: teamLead };
    const resEmpty = mockRes();
    await getWeakConceptsReport(reqEmpty, resEmpty);
    assert.strictEqual(resEmpty.statusCode, 200, 'Empty state should return 200 OK');
    assert.strictEqual(resEmpty.data.totalConceptsTracked, 0, 'totalConceptsTracked should be 0');
    assert(Array.isArray(resEmpty.data.weakConcepts), 'weakConcepts should be an array');
    assert.strictEqual(resEmpty.data.weakConcepts.length, 0, 'weakConcepts should be empty');
    console.log('✓ TEST 1 Passed: Clean empty state handling with 0 quiz attempts');

    // 3. Seed Concept Scores for Squad Engineers
    // Concept A: FIBER_SPLICING -> 1 correct / 4 total = 25% (Weakest)
    await ConceptScore.create({
      engineer_id: squadEng1._id,
      concept_tag: 'FIBER_SPLICING',
      correct_count: 1,
      total_count: 2,
    });
    await ConceptScore.create({
      engineer_id: squadEng2._id,
      concept_tag: 'FIBER_SPLICING',
      correct_count: 0,
      total_count: 2,
    });

    // Concept B: OTDR_ANALYSIS -> 3 correct / 4 total = 75% (Moderate)
    await ConceptScore.create({
      engineer_id: squadEng1._id,
      concept_tag: 'OTDR_ANALYSIS',
      correct_count: 2,
      total_count: 2,
    });
    await ConceptScore.create({
      engineer_id: squadEng2._id,
      concept_tag: 'OTDR_ANALYSIS',
      correct_count: 1,
      total_count: 2,
    });

    // Concept C: SAFETY_PROTOCOLS -> 4 correct / 4 total = 100% (Strongest)
    await ConceptScore.create({
      engineer_id: squadEng1._id,
      concept_tag: 'SAFETY_PROTOCOLS',
      correct_count: 2,
      total_count: 2,
    });
    await ConceptScore.create({
      engineer_id: squadEng2._id,
      concept_tag: 'SAFETY_PROTOCOLS',
      correct_count: 2,
      total_count: 2,
    });

    // Outside engineer score: CONDUIT_ROUTING (Should be EXCLUDED from Team Lead report)
    await ConceptScore.create({
      engineer_id: outsideEng._id,
      concept_tag: 'CONDUIT_ROUTING',
      correct_count: 0,
      total_count: 5,
    });

    // TEST 2: Verify aggregation and sorting (lowest accuracy first)
    const reqFilled = { user: teamLead };
    const resFilled = mockRes();
    await getWeakConceptsReport(reqFilled, resFilled);
    assert.strictEqual(resFilled.statusCode, 200, 'Filled report should return 200 OK');
    assert.strictEqual(resFilled.data.totalConceptsTracked, 3, 'Should track exactly 3 squad concepts');

    const concepts = resFilled.data.weakConcepts;
    assert.strictEqual(concepts.length, 3, 'Should return 3 concept aggregates');

    // 1st should be FIBER_SPLICING (25%)
    assert.strictEqual(concepts[0].concept_tag, 'FIBER_SPLICING');
    assert.strictEqual(concepts[0].accuracyPercentage, 25);
    assert.strictEqual(concepts[0].totalCorrect, 1);
    assert.strictEqual(concepts[0].totalAttempts, 4);
    assert.strictEqual(concepts[0].engineerCount, 2);

    // 2nd should be OTDR_ANALYSIS (75%)
    assert.strictEqual(concepts[1].concept_tag, 'OTDR_ANALYSIS');
    assert.strictEqual(concepts[1].accuracyPercentage, 75);
    assert.strictEqual(concepts[1].totalCorrect, 3);
    assert.strictEqual(concepts[1].totalAttempts, 4);

    // 3rd should be SAFETY_PROTOCOLS (100%)
    assert.strictEqual(concepts[2].concept_tag, 'SAFETY_PROTOCOLS');
    assert.strictEqual(concepts[2].accuracyPercentage, 100);
    assert.strictEqual(concepts[2].totalCorrect, 4);
    assert.strictEqual(concepts[2].totalAttempts, 4);

    console.log('✓ TEST 2 Passed: Correct aggregation & ascending accuracy sorting (lowest accuracy first: 25% -> 75% -> 100%)');

    // TEST 3: Team Lead Scope Isolation (outside concept excluded)
    const hasOutsideConcept = concepts.some((c) => c.concept_tag === 'CONDUIT_ROUTING');
    assert.strictEqual(hasOutsideConcept, false, 'Outside engineer concept scores must NOT be present in Team Lead report');
    console.log('✓ TEST 3 Passed: Team Lead scope isolation strictly verified (outside data excluded)');

    // Clean up
    await User.deleteMany({ _id: { $in: [teamLead._id, squadEng1._id, squadEng2._id, outsideEng._id] } });
    await Team.deleteOne({ _id: testTeam._id });
    await ConceptScore.deleteMany({
      engineer_id: { $in: [squadEng1._id, squadEng2._id, outsideEng._id] },
    });

    console.log('\n===================================================================');
    console.log('🎉 ALL WEAK CONCEPTS MAP AUDIT & PIPELINE TESTS PASSED 100%');
    console.log('===================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
};

testWeakConceptsReport();
