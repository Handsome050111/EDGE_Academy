const express = require('express');
const router = express.Router();
const {
  enrollInTrack,
  completeModule,
  getTrackProgress,
} = require('../controllers/progressController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateProgress } = require('../middleware/validateMiddleware');

router.post('/enroll', protect, authorize('Engineer', 'TeamLead', 'Admin'), validateProgress, enrollInTrack);
router.post('/complete-module', protect, authorize('Engineer', 'TeamLead', 'Admin'), validateProgress, completeModule);
router.get('/:trackId', protect, authorize('Engineer', 'TeamLead', 'Admin'), getTrackProgress);

module.exports = router;