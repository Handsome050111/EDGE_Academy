const AuditLog = require('../models/AuditLog');

/**
 * Extracts real client IP address considering reverse proxies (Railway, NGINX, Cloudflare)
 * and express trust proxy header forwarding.
 */
const getClientIp = (req) => {
  if (!req) return null;
  const xForwardedFor = req.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    return ips.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
};

/**
 * Log structured audit event
 */
const logAuditEvent = async (entry, req = null) => {
  try {
    const ip = entry.ip_address || entry.ipAddress || (req ? getClientIp(req) : null);
    await AuditLog.create({
      ...entry,
      ip_address: ip,
    });
  } catch (error) {
    console.warn('Audit logging failed:', error.message);
  }
};

/**
 * Standardized audit logging helper for controllers
 */
const logAudit = async ({
  req,
  action,
  resourceType,
  resourceId,
  outcome = 'success',
  description,
  metadata = {},
  before_json = null,
  after_json = null,
}) => {
  try {
    const ip = req ? getClientIp(req) : null;
    await AuditLog.create({
      actorId: req?.user?._id,
      actorRole: req?.user?.role || 'Unknown',
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      ip_address: ip,
      outcome,
      description,
      metadata,
      before_json,
      after_json,
    });
  } catch (error) {
    console.error('AuditLog creation error:', error.message);
  }
};

module.exports = {
  getClientIp,
  logAuditEvent,
  logAudit,
};
