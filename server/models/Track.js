const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema(
  {
    name: {
      type: String, // e.g., "EDGE Certified Technician"
      required: [true, 'Track name is required'],
      trim: true,
      alias: 'title',
    },
    slug: {
      type: String, // Short code / slug used for Certificate IDs, e.g., "EDGE-L1", "CORE-L2"
      required: [true, 'Track slug is required'],
      uppercase: true,
      trim: true,
      alias: 'code',
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String, // e.g., icon identifier or URL
      default: null,
    },
    // Array of references to Module documents in exact order
    modules: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
      },
    ],
    is_published: {
      type: Boolean,
      default: false,
      alias: 'isPublished',
    },
    display_order: {
      type: Number,
      default: 0,
      alias: 'displayOrder',
    },
    // Certification level for this track. Authoritative source of tier — not Module.
    // EDGE = Level 1 (deployment-ready technician, works under CORE supervision)
    // CORE = Level 2 (technical leader, mentors EDGE engineers, validates quality)
    tier: {
      type: String,
      enum: ['EDGE', 'CORE'],
      required: [true, 'Track tier is required'],
      default: 'EDGE',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals for backwards compatibility with createdAt/updatedAt
trackSchema.virtual('createdAt').get(function () {
  return this.created_at;
});
trackSchema.virtual('updatedAt').get(function () {
  return this.updated_at;
});

// Cascade soft-delete or remove modules when a track is deleted via findOneAndDelete / findByIdAndDelete
trackSchema.pre('findOneAndDelete', async function () {
  const trackId = this.getQuery()['_id'];
  if (trackId) {
    await mongoose.model('Module').updateMany(
      { $or: [{ track_id: trackId }, { trackId: trackId }] },
      { $set: { deleted_at: new Date(), status: 'archived' } }
    );
  }
});


module.exports = mongoose.model('Track', trackSchema);