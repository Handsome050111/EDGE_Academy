const express = require('express');
const router = express.Router();
const {
  getLeaderboard,
  getUserStats,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/leaderboard', protect, getLeaderboard);
router.get('/users/me', protect, getUserStats);
router.get('/users/:userId', protect, getUserStats);

module.exports = router;
