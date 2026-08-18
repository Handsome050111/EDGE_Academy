const express = require('express');
const router = express.Router();
const {
  startTopicQuiz,
  submitQuizAttempt,
} = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/v1/modules/:id/quiz/start
router.post('/modules/:id/quiz/start', protect, startTopicQuiz);

// @route   POST /api/v1/attempts/:id/submit
router.post('/attempts/:id/submit', protect, submitQuizAttempt);

module.exports = router;