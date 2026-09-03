const express = require('express');
const router = express.Router();
const {
  startTopicQuiz,
  submitQuizAttempt,
  getModuleQuizResult,
} = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/v1/modules/:id/quiz/start
router.post('/modules/:id/quiz/start', protect, startTopicQuiz);

// @route   POST /api/v1/attempts/:id/submit
router.post('/attempts/:id/submit', protect, submitQuizAttempt);

// @route   GET /api/v1/modules/:id/quiz-result
router.get('/modules/:id/quiz-result', protect, getModuleQuizResult);

module.exports = router;