const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'recipientId',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['assignment', 'review_quiz', 'certificate', 'invite', 'system'],
      default: 'system',
    },
    is_read: {
      type: Boolean,
      default: false,
      alias: 'isRead',
    },
    link: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual alias: created_at → createdAt
notificationSchema.virtual('created_at').get(function () {
  return this.createdAt;
});

notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);
