const mongoose = require('mongoose');

const completedModuleSchema = new mongoose.Schema({
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
  quizScore: {
    type: Number,
    required: true,
  },
});

const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track',
      required: true,
    },
    completedModules: [completedModuleSchema],
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate enrollments for the same user and track
progressSchema.index({ userId: 1, trackId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);