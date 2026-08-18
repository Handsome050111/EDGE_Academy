const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  acceptInvite,
  getInviteInfo,
  forgotPassword,
  getResetPasswordInfo,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validateRegister, validateLogin } = require('../middleware/validateMiddleware');

router.post('/register', validateRegister, registerUser);
router.post('/login', validateLogin, loginUser);
router.post('/logout', protect, logoutUser);
router.get('/profile', protect, getUserProfile);
router.get('/invite/:token', getInviteInfo);
router.post('/accept-invite', acceptInvite);
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', getResetPasswordInfo);
router.post('/reset-password', resetPassword);

module.exports = router;