const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    certificate_id: {
      type: String, // e.g., TNX-2026-ALS-04
      required: true,
      unique: true,
      trim: true,
      alias: 'certificateId',
    },
    engineer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'userId',
    },
    track_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track',
      required: true,
      alias: 'trackId',
    },
    tier: {
      type: String,
      // Normalized values post-migration. Historical certificates may retain
      // legacy values (L1_CORE, L2_ADVANCED) — see Step 5 decision note.
      enum: ['EDGE', 'CORE', 'L1_CORE', 'L2_ADVANCED'],
      default: 'EDGE',
    },
    issued_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    pdf_storage_path: {
      type: String,
      required: true,
    },
    director_name: {
      type: String,
      required: true, // Snapshot from CertificateConfig at issuance
    },
    director_signature_url: {
      type: String,
      default: null,
    },
    instructor_name: {
      type: String,
      default: null, // Snapshot from CertificateConfig at issuance
    },
    instructor_signature_url: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
    },
    revoked_at: {
      type: Date,
      default: null,
    },
    revoked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revocation_reason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Enforce UNIQUE(engineer_id, track_id, tier) -- one cert per track+tier per engineer as per Spec Section 5.13
certificateSchema.index(
  { engineer_id: 1, track_id: 1, tier: 1 },
  { unique: true }
);

// Virtuals for backwards compatibility with createdAt/updatedAt
certificateSchema.virtual('createdAt').get(function () {
  return this.created_at;
});
certificateSchema.virtual('updatedAt').get(function () {
  return this.updated_at;
});

module.exports = mongoose.model('Certificate', certificateSchema);