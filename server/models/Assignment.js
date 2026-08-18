const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    module_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      alias: 'moduleId',
    },
    engineer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'userId',
    },
    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'assignedBy',
    },
    assigned_at: {
      type: Date,
      default: Date.now,
      alias: 'assignedAt',
    },
    started_at: {
      type: Date,
      default: null,
      alias: 'startedAt',
    },
    deadline_at: {
      type: Date,
      default: null,
      alias: 'deadlineAt',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'overdue'],
      default: 'pending',
    },
    completed_at: {
      type: Date,
      default: null,
      alias: 'completedAt',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals for backwards compatibility with createdAt/updatedAt
assignmentSchema.virtual('createdAt').get(function () {
  return this.created_at;
});
assignmentSchema.virtual('updatedAt').get(function () {
  return this.updated_at;
});

module.exports = mongoose.model('Assignment', assignmentSchema);

