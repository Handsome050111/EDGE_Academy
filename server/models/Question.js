const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    module_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      alias: 'moduleId',
    },
    question_text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      alias: 'questionText',
    },
    option_a: { type: String, required: true },
    option_b: { type: String, required: true },
    option_c: { type: String, required: true },
    option_d: { type: String, required: true },
    correct_option: {
      type: String,
      enum: ['A', 'B', 'C', 'D'],
      required: true,
    },
    explanation: {
      type: String, // Shown immediately after answering during feedback
      trim: true,
    },
    concept_tag: {
      type: String, // e.g., "router_config", "cable_termination" - used for retention algorithm
      required: true,
      lowercase: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    version: {
      type: Number,
      default: 1,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Spec Section 5.7 created_by BIGINT FK -> users.id
    },
    deleted_at: {
      type: Date,
      default: null, // Soft delete as per Spec Section 5.7
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals for backwards compatibility with createdAt/updatedAt
questionSchema.virtual('createdAt').get(function () {
  return this.created_at;
});
questionSchema.virtual('updatedAt').get(function () {
  return this.updated_at;
});

questionSchema.statics.insertManyQuestions = function (questions) {
  return this.insertMany(questions);
};

module.exports = mongoose.model('Question', questionSchema);