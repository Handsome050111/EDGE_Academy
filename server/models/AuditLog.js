const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      alias: 'actorId',
    },
    actor_role: {
      type: String,
      default: 'Unknown',
      alias: 'actorRole',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entity_type: {
      type: String,
      required: true,
      trim: true,
      alias: 'resourceType',
    },
    entity_id: {
      type: String,
      trim: true,
      alias: 'resourceId',
    },
    before_json: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after_json: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip_address: {
      type: String,
      default: null,
    },
    outcome: {
      type: String,
      enum: ['success', 'failure', 'denied'],
      default: 'success',
    },
    description: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
    occurred_at: {
      type: Date,
      default: Date.now,
      alias: 'timestamp',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals for backwards compatibility with createdAt/updatedAt
auditLogSchema.virtual('createdAt').get(function () {
  return this.created_at;
});
auditLogSchema.virtual('updatedAt').get(function () {
  return this.updated_at;
});

module.exports = mongoose.model('AuditLog', auditLogSchema);

