const express = require('express');
const router = express.Router();
const { getUserProfile, getUserProgress, updateUserProfile } = require('../controllers/userController');
const { getLearnerDashboard } = require('../controllers/dashboardController');
const { getUserCertificates, downloadCertificatePdf } = require('../controllers/certificateController');
const { protect } = require('../middleware/authMiddleware');

// User profile & progress endpoints (Spec Section 6.2 & 6.4)
router.get('/', protect, getUserProfile);
router.put('/', protect, updateUserProfile);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.get('/progress', protect, getUserProgress);
router.get('/dashboard', protect, getLearnerDashboard);
router.get('/certificates', protect, getUserCertificates);
router.get('/certificates/:id/pdf', protect, downloadCertificatePdf);

module.exports = router;

