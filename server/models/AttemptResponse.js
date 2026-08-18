const mongoose = require('mongoose');

const attemptResponseSchema = new mongoose.Schema(
  {
    attempt_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuizAttempt',
      required: true,
    },
    question_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    selected_option: {
      type: String,
      enum: ['A', 'B', 'C', 'D'],
      default: null,
    },
    was_correct: {
      type: Boolean,
      required: true,
    },
    response_time_ms: {
      type: Number,
      default: null,
    },
    displayed_order: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AttemptResponse', attemptResponseSchema);
