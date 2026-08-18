const mongoose = require('mongoose');

const conceptScoreSchema = new mongoose.Schema(
  {
    engineer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    concept_tag: {
      type: String,
      required: true,
    },
    correct_count: {
      type: Number,
      default: 0,
    },
    total_count: {
      type: Number,
      default: 0,
    },
    accuracy: {
      type: Number,
      default: 0,
    },
    last_updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// UNIQUE(engineer_id, concept_tag)
conceptScoreSchema.index({ engineer_id: 1, concept_tag: 1 }, { unique: true });

// Pre-save hook to calculate accuracy
conceptScoreSchema.pre('save', function () {
  if (this.total_count > 0) {
    this.accuracy = this.correct_count / this.total_count;
  } else {
    this.accuracy = 0;
  }
});

module.exports = mongoose.model('ConceptScore', conceptScoreSchema);
