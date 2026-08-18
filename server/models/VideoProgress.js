const mongoose = require('mongoose');

const videoProgressSchema = new mongoose.Schema(
  {
    engineer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    module_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
    },
    position_sec: {
      type: Number,
      default: 0,
    },
    percent_watched: {
      type: Number,
      default: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    last_watched_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// UNIQUE(engineer_id, module_id)
videoProgressSchema.index({ engineer_id: 1, module_id: 1 }, { unique: true });

module.exports = mongoose.model('VideoProgress', videoProgressSchema);
