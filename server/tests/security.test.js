const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePasswordStrength, buildAuditEntry } = require('../utils/security');

test('accepts strong passwords', () => {
  const result = validatePasswordStrength('Str0ng!Pass');
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('rejects weak passwords', () => {
  const result = validatePasswordStrength('password');
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('uppercase')));
  assert.ok(result.errors.some((error) => error.includes('number')));
  assert.ok(result.errors.some((error) => error.includes('special')));
});

test('builds a normalized audit entry', () => {
  const entry = buildAuditEntry({
    actor: { _id: 'user-1', role: 'Admin' },
    action: 'certificate_issued',
    resourceType: 'Certificate',
    resourceId: 'cert-123',
    outcome: 'success',
    description: 'Issued certificate',
  });

  assert.equal(entry.action, 'certificate_issued');
  assert.equal(entry.outcome, 'success');
  assert.equal(entry.actorRole, 'Admin');
  assert.equal(entry.resourceType, 'Certificate');
});
