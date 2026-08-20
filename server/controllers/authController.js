const crypto = require('crypto');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validatePasswordStrength, buildAuditEntry } = require('../utils/security');
const { logAuditEvent } = require('../utils/audit');
const { notifyPasswordReset } = require('../services/notificationService');

// Helper function to generate JWT Token
const generateToken = (id, rememberMe = false) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? '30d' : '1d',
  });
};

// @desc    Register a new engineer / user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    // NOTE: `role` is intentionally NOT destructured from req.body.
    // Self-registration always creates Engineer accounts. Role assignment
    // is exclusively handled by the admin-gated POST /admin/users and
    // POST /admin/users/invite flows (protected by `protect + authorize('Admin')`).
    const { fullName, email, password, language } = req.body;

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: passwordCheck.errors.join(' ') } });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists && !userExists.deleted_at) {
      return res.status(400).json({ error: { code: 'USER_EXISTS', message: 'An account with this email address already exists.' } });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    let user;
    if (userExists && userExists.deleted_at) {
      userExists.full_name = fullName;
      userExists.password_hash = hashedPassword;
      userExists.role = 'engineer';
      userExists.locale = language || 'en';
      userExists.is_active = true;
      userExists.status = 'active';
      userExists.deleted_at = null;
      userExists.lock_until = null;
      userExists.failed_login_attempts = 0;
      user = await userExists.save();
    } else {
      user = await User.create({
        full_name: fullName,
        email: cleanEmail,
        password_hash: hashedPassword,
        role: 'engineer',
        locale: language || 'en',
      });
    }

    if (user) {
      const auditEntry = buildAuditEntry({
        req,
        actor: user,
        action: 'user_registered',
        resourceType: 'User',
        resourceId: user._id.toString(),
        outcome: 'success',
        description: 'New user registered',
      });
      await logAuditEvent(auditEntry, req);

      res.status(201).json({
        _id: user._id,
        fullName: user.full_name || user.fullName,
        email: user.email,
        role: user.role,
        language: user.locale,
        token: generateToken(user._id),
        auditEntry,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password, locale, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'Email and password are required.' },
      });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // Explicitly select password_hash field since it is set to select: false in schema
    const user = await User.findOne({ email: cleanEmail }).select('+password_hash +password');

    if (user) {
      // 1. Check if user is deactivated, access revoked, or soft-deleted
      const isDeactivated = user.is_active === false || user.isActive === false || user.status === 'deactivated' || user.deleted_at !== null;
      if (isDeactivated) {
        const auditEntry = buildAuditEntry({
          req,
          actor: user,
          action: 'login_blocked_account_deactivated',
          resourceType: 'Session',
          resourceId: user._id.toString(),
          outcome: 'denied',
          description: 'Login rejected: account is deactivated or access has been revoked',
        });
        await logAuditEvent(auditEntry, req);

        return res.status(403).json({
          error: {
            code: 'ACCOUNT_DEACTIVATED',
            message: 'Your account has been deactivated or access has been revoked. Please contact an administrator.',
          },
        });
      }

      // 2. Check if account is currently locked (5 failed attempts -> 15 min lockout as per Spec Section 10.1)
      if (user.lock_until && new Date(user.lock_until).getTime() > Date.now()) {
        const remainingSeconds = Math.ceil((new Date(user.lock_until).getTime() - Date.now()) / 1000);
        const remainingMinutes = Math.ceil(remainingSeconds / 60);

        const auditEntry = buildAuditEntry({
          req,
          actor: user,
          action: 'login_blocked_account_locked',
          resourceType: 'Session',
          resourceId: user._id.toString(),
          outcome: 'denied',
          description: `Login attempt blocked: account locked for ${remainingMinutes} more minute(s)`,
          metadata: { remainingSeconds },
        });
        await logAuditEvent(auditEntry, req);

        return res.status(403).json({
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again after ${remainingMinutes} minute(s).`,
            lock_remaining_seconds: remainingSeconds,
          },
        });
      }

      const userPassHash = user.password_hash || user.password;
      let isMatch = false;
      if (userPassHash) {
        if (userPassHash.startsWith('$2a$') || userPassHash.startsWith('$2b$') || userPassHash.startsWith('$2y$')) {
          isMatch = await bcrypt.compare(String(password), String(userPassHash));
        } else {
          // If legacy plain text was stored, compare and migrate to bcrypt hash
          if (String(password) === String(userPassHash)) {
            isMatch = true;
            user.password_hash = await bcrypt.hash(password, 12);
            await user.save();
          }
        }
      }



      if (isMatch) {
        // Reset failed login counter and clear lockout on successful authentication
        user.failed_login_attempts = 0;
        user.lock_until = null;
        user.last_login_at = new Date();

        if (locale && ['en', 'de'].includes(locale)) {
          user.locale = locale;
        }
        await user.save();

        const auditEntry = buildAuditEntry({
          req,
          actor: user,
          action: 'user_logged_in',
          resourceType: 'Session',
          resourceId: user._id.toString(),
          outcome: 'success',
          description: 'User authenticated successfully',
        });
        await logAuditEvent(auditEntry, req);

        return res.json({
          _id: user._id,
          fullName: user.full_name || user.fullName,
          email: user.email,
          role: user.role,
          team_id: user.team_id,
          locale: user.locale,
          language: user.locale,
          token: generateToken(user._id, rememberMe),
          auditEntry,
        });
      } else {
        // Increment failed attempts
        user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
        let lockoutTriggered = false;

        if (user.failed_login_attempts >= 5) {
          user.lock_until = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
          lockoutTriggered = true;
        }
        await user.save();

        const auditEntry = buildAuditEntry({
          req,
          actor: user,
          action: lockoutTriggered ? 'account_locked_failed_logins' : 'login_failed_invalid_credentials',
          resourceType: 'Session',
          resourceId: user._id.toString(),
          outcome: 'failure',
          description: lockoutTriggered
            ? 'Account locked for 15 minutes after 5 consecutive failed login attempts'
            : `Failed login attempt (${user.failed_login_attempts}/5)`,
          metadata: { failedAttempts: user.failed_login_attempts, lockoutTriggered },
        });
        await logAuditEvent(auditEntry, req);

        if (lockoutTriggered) {
          return res.status(403).json({
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Account has been locked for 15 minutes due to 5 consecutive failed login attempts.',
              lock_remaining_seconds: 900,
            },
          });
        }

        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
            attempts_remaining: 5 - user.failed_login_attempts,
          },
        });
      }
    } else {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }
  } catch (error) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

// @desc    Logout user / revoke session
// @route   POST /api/v1/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
  try {
    if (req.user) {
      const auditEntry = buildAuditEntry({
        req,
        actor: req.user,
        action: 'user_logged_out',
        resourceType: 'Session',
        resourceId: req.user._id ? req.user._id.toString() : 'Unknown',
        outcome: 'success',
        description: 'User logged out successfully',
      });
      await logAuditEvent(auditEntry, req);
    }
    // Spec Section 6.2: POST /api/v1/auth/logout → 204
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Accept invitation & set initial password
// @route   POST /api/v1/auth/accept-invite
// @access  Public
const acceptInvite = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    const user = await User.findOne({
      invite_token: token,
      invite_token_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired invitation token' });
    }

    const salt = await bcrypt.genSalt(12);
    user.password_hash = await bcrypt.hash(password, salt);
    user.status = 'active';
    user.is_active = true;
    user.invite_token = null;
    user.invite_token_expires = null;
    await user.save();

    res.json({
      message: 'Invitation accepted successfully. Account activated.',
      user: {
        _id: user._id,
        fullName: user.full_name || user.fullName,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Validate invite token and retrieve user details
// @route   GET /api/v1/auth/invite/:token
// @access  Public
const getInviteInfo = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const user = await User.findOne({
      invite_token: token,
      invite_token_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired invitation token' });
    }

    return res.json({
      valid: true,
      email: user.email,
      fullName: user.full_name || user.fullName,
      role: user.role,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Initiate password reset request
// @route   POST /api/v1/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail, deleted_at: null });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.reset_password_token = token;
      user.reset_password_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      await notifyPasswordReset({ user, token });
    }

    // Always return generic success message to prevent user enumeration
    return res.json({
      message: 'If this email is registered in our system, a password reset link has been dispatched.',
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Validate reset password token
// @route   GET /api/v1/auth/reset-password/:token
// @access  Public
const getResetPasswordInfo = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const user = await User.findOne({
      reset_password_token: token,
      reset_password_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
    }

    return res.json({
      valid: true,
      email: user.email,
      fullName: user.full_name || user.fullName,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Complete password reset
// @route   POST /api/v1/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const user = await User.findOne({
      reset_password_token: token,
      reset_password_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
    }

    const salt = await bcrypt.genSalt(12);
    user.password_hash = await bcrypt.hash(password, salt);
    user.reset_password_token = null;
    user.reset_password_expires = null;
    user.lock_until = null;
    user.failed_login_attempts = 0;
    await user.save();

    return res.json({
      message: 'Password reset successfully. You may now log in.',
      email: user.email,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  acceptInvite,
  getInviteInfo,
  forgotPassword,
  getResetPasswordInfo,
  resetPassword,
};