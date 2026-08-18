const Notification = require('../models/Notification');

// Helper to create notifications internally across controllers/services
const createNotification = async ({ recipient_id, recipientId, title, message, type = 'system', link = null }) => {
  try {
    const targetRecipientId = recipient_id || recipientId;
    if (!targetRecipientId) return null;

    const notification = await Notification.create({
      recipient_id: targetRecipientId,
      title,
      message,
      type,
      link,
      is_read: false,
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    return null;
  }
};

// @desc    Get user notifications & unread count
// @route   GET /api/v1/notifications
// @access  Private
const getUserNotifications = async (req, res) => {
  try {
    const recipient_id = req.user._id;

    // Mongoose alias on the schema handles recipientId ↔ recipient_id automatically
    const notifications = await Notification.find({ recipient_id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      recipient_id,
      is_read: false,
    });

    res.json({
      unreadCount,
      notifications,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark single notification as read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;
    const recipient_id = req.user._id;

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient_id,
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.is_read = true;
    await notification.save();

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark all notifications as read for current user
// @route   PUT /api/v1/notifications/mark-all-read
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const recipient_id = req.user._id;

    const result = await Notification.updateMany(
      {
        recipient_id,
        is_read: false,
      },
      {
        $set: { is_read: true },
      }
    );

    res.json({ message: 'All notifications marked as read', modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
};
