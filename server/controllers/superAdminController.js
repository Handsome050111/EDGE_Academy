const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Certificate = require('../models/Certificate');


// Helper to log audit actions
const logAudit = async ({ req, action, resourceType, resourceId, outcome = 'success', description, metadata = {} }) => {
  try {
    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role || 'Unknown',
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      outcome,
      description,
      metadata,
    });
  } catch (error) {
    console.error('AuditLog creation error:', error.message);
  }
};

// @desc    Get paginated audit logs with search and date filters
// @route   GET /api/v1/admin/audit-log
// @access  Private/SuperAdmin
const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.action) {
      query.action = { $regex: req.query.action, $options: 'i' };
    }

    const actorId = req.query.actorId || req.query.user_id;
    if (actorId && mongoose.Types.ObjectId.isValid(actorId)) {
      query.actorId = actorId;
    }

    if (req.query.outcome) {
      query.outcome = req.query.outcome;
    }

    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
    }

    const total = await AuditLog.countDocuments(query);
    const auditLogs = await AuditLog.find(query)
      .populate('user_id', 'full_name fullName email role')
      .sort({ occurred_at: -1, created_at: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedLogs = auditLogs.map((log) => {
      const obj = log.toObject();
      const populatedUser = log.user_id;
      if (populatedUser && typeof populatedUser === 'object' && populatedUser._id) {
        const actorObj = {
          _id: populatedUser._id,
          fullName: populatedUser.full_name || populatedUser.fullName,
          email: populatedUser.email,
          role: populatedUser.role,
        };
        obj.actorId = actorObj;
        obj.user_id = actorObj;
      }
      return obj;
    });

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      auditLogs: formattedLogs,
    });
  } catch (error) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};


// @desc    Revoke a certificate with mandatory reason logging
// @route   POST /api/v1/admin/certificates/:id/revoke
// @access  Private/SuperAdmin
const revokeCertificate = async (req, res) => {
  try {
    const certificateIdParam = req.params.id;
    const { reason, revocation_reason, revocationReason } = req.body;

    const parsedReason = (revocation_reason || revocationReason || reason || '').trim();
    if (!parsedReason) {
      return res.status(400).json({ error: { code: 'REASON_REQUIRED', message: 'revocation_reason is required' } });
    }


    let certificate;
    if (mongoose.Types.ObjectId.isValid(certificateIdParam)) {
      certificate = await Certificate.findById(certificateIdParam);
    }
    if (!certificate) {
      certificate = await Certificate.findOne({ certificate_id: certificateIdParam.toUpperCase() });
    }

    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    if (certificate.status === 'revoked') {
      return res.status(400).json({ message: 'Certificate is already revoked', certificate });
    }

    certificate.status = 'revoked';
    certificate.revoked_at = new Date();
    certificate.revoked_by = req.user._id;
    certificate.revocation_reason = parsedReason;
    await certificate.save();

    await logAudit({
      req,
      action: 'REVOKE_CERTIFICATE',
      resourceType: 'Certificate',
      resourceId: certificate._id,
      outcome: 'success',
      description: `Revoked certificate ${certificate.certificate_id} for user ${certificate.engineer_id}. Reason: ${parsedReason}`,
      metadata: { certificate_id: certificate.certificate_id, revocation_reason: parsedReason },
    });


    return res.status(200).json({
      message: 'Certificate revoked successfully',
      certificate,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAuditLogs,
  revokeCertificate,
};
