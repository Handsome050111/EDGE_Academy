const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { saveProgress, getProgress } = require('../controllers/videoProgressController');

// Video progress tracking (Section 4.1)
router.post('/modules/:id/video-progress', protect, saveProgress);
router.get('/modules/:id/video-progress', protect, getProgress);

module.exports = router;
