const AuditLog = require('../models/AuditLog');

const logAuditEvent = async (entry) => {
  try {
    await AuditLog.create(entry);
  } catch (error) {
    console.warn('Audit logging failed:', error.message);
  }
};

module.exports = {
  logAuditEvent,
};
