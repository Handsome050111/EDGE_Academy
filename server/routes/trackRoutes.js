const express = require('express');
const router = express.Router();
const {
  createTrack,
  getTracks,
  getTrackById,
  updateTrack,
  deleteTrack,
} = require('../controllers/trackController');
const { protect, optionalProtect, authorize } = require('../middleware/authMiddleware');

router
  .route('/')
  .post(protect, authorize('Admin'), createTrack)
  .get(optionalProtect, getTracks);

router
  .route('/:id')
  .get(optionalProtect, getTrackById)
  .put(protect, authorize('Admin'), updateTrack)
  .delete(protect, authorize('Admin'), deleteTrack);

module.exports = router;