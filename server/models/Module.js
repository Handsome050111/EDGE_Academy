const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema(
  {
    track_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Module title is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    estimated_minutes: {
      type: Number,
      default: 0,
      alias: 'estimatedDurationMinutes',
    },
    video_provider_id: {
      type: String, // Cloudflare Stream video UID
      default: null,
      alias: 'cloudflareVideoId',
    },
    video_duration_sec: {
      type: Number,
      default: null,
    },
    thumbnail_url: {
      type: String,
      default: null,
      trim: true,
      alias: 'thumbnailUrl',
    },
    chapters: [
      {
        title: { type: String, required: true },
        timestamp_sec: { type: Number, required: true },
        description: { type: String, default: '' },
      },
    ],
    pass_threshold: {

      type: Number,
      default: 80, // percent
      alias: 'passingScorePercentage',
    },
    quiz_question_count: {
      type: Number,
      default: 6, // number of Qs in Topic Quiz
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    published_at: {
      type: Date,
      default: null,
    },
    deleted_at: {
      type: Date,
      default: null, // Soft delete as per Spec Section 5.4
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual populate for trackId for backward compatibility
moduleSchema.virtual('trackId', {
  ref: 'Track',
  localField: 'track_id',
  foreignField: '_id',
  justOne: true,
});

// Getter and setter for trackId field
moduleSchema.virtual('trackIdValue')
  .get(function () {
    return this.track_id;
  })
  .set(function (val) {
    this.track_id = val;
  });

// Pre-validate hook to handle trackId passed in payload
moduleSchema.pre('validate', function () {
  if (this.trackId && !this.track_id) {
    this.track_id = this.trackId;
  }
});

// Virtuals for backwards compatibility with createdAt/updatedAt
moduleSchema.virtual('createdAt').get(function () {
  return this.created_at;
});
moduleSchema.virtual('updatedAt').get(function () {
  return this.updated_at;
});


module.exports = mongoose.model('Module', moduleSchema);