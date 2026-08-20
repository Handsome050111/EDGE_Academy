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

const buildAuditEntry = ({ req, actor, action, resourceType, resourceId, outcome, description, metadata, ip_address }) => {
  let resolvedIp = ip_address || null;
  if (!resolvedIp && req) {
    const xForwardedFor = req.headers?.['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      resolvedIp = ips.split(',')[0].trim();
    } else {
      resolvedIp = req.ip || req.socket?.remoteAddress || null;
    }
  }

  return {
    actorId: actor?._id?.toString?.() || actor?.id || req?.user?._id?.toString?.() || null,
    actorRole: actor?.role || req?.user?.role || 'Unknown',
    action,
    resourceType,
    resourceId: resourceId || null,
    ip_address: resolvedIp,
    outcome,
    description: description || '',
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
  };
};

const hashValue = (value) => {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

module.exports = {
  validatePasswordStrength,
  buildAuditEntry,
  hashValue,
};
