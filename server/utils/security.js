const crypto = require('crypto');

const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  if (!/[A-Z]/.test(password || '')) {
    errors.push('Password must include at least one uppercase letter.');
  }

  if (!/[0-9]/.test(password || '')) {
    errors.push('Password must include at least one number.');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password || '')) {
    errors.push('Password must include at least one special character.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const buildAuditEntry = ({ actor, action, resourceType, resourceId, outcome, description, metadata }) => ({
  actorId: actor?._id?.toString?.() || actor?.id || null,
  actorRole: actor?.role || 'Unknown',
  action,
  resourceType,
  resourceId: resourceId || null,
  outcome,
  description: description || '',
  metadata: metadata || {},
  timestamp: new Date().toISOString(),
});

const hashValue = (value) => {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

module.exports = {
  validatePasswordStrength,
  buildAuditEntry,
  hashValue,
};
