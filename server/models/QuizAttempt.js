const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'engineer_id',
    },
    type: {
      type: String,
      alias: 'quiz_type',
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      alias: 'module_id',
    },
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question',
        },
        selectedOptionId: {
          type: mongoose.Schema.Types.ObjectId,
        },
        isCorrect: {
          type: Boolean,
        },
      },
    ],
    scorePercentage: {
      type: Number,
      alias: 'score_percent',
    },
    passed: {
      type: Boolean,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'abandoned'],
      default: 'in_progress',
    },
    completedAt: {
      type: Date,
      alias: 'completed_at',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);