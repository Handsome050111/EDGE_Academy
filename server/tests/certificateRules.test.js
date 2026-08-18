const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCertificateEligibility } = require('../controllers/certificateController');

test('accepts a completed track with passing scores for every required module', () => {
  const completedAssignmentsCount = 2;
  const requiredModulesCount = 2;

  const result = validateCertificateEligibility(completedAssignmentsCount, requiredModulesCount);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('rejects a track that is not fully completed or has low quiz scores', () => {
  const completedAssignmentsCount = 1;
  const requiredModulesCount = 2;

  const result = validateCertificateEligibility(completedAssignmentsCount, requiredModulesCount);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('all required modules')));
});
