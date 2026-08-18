const jwt = require('jsonwebtoken');
const User = require('../models/User');

const normalizeRole = (role) => {
  if (!role) return '';
  return String(role).trim().toLowerCase();
};

const ROLE_ALIASES = {
  engineer: 'Engineer',
  teamlead: 'TeamLead',
  team_lead: 'TeamLead',
  admin: 'Admin',
};

const normalizeUserRole = (role) => {
  const normalized = normalizeRole(role);
  return ROLE_ALIASES[normalized] || role;
};

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user object without password
      const user = await User.findById(decoded.id).select('-password_hash -password');
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      if (user.is_active === false || user.isActive === false || user.status === 'deactivated' || user.deleted_at !== null) {
        return res.status(403).json({
          error: {
            code: 'ACCOUNT_DEACTIVATED',
            message: 'Your account has been deactivated or access has been revoked. Please contact an administrator.',
          },
        });
      }

      user.role = normalizeUserRole(user.role);
      req.user = user;
      return next();

    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// Optional authentication middleware - attaches user if valid token present, but does not block if not
const optionalProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select('-password_hash -password');
      if (user && user.is_active !== false && user.isActive !== false && user.status !== 'deactivated' && user.deleted_at === null) {
        user.role = normalizeUserRole(user.role);
        req.user = user;
      }
    } catch (error) {
      // Proceed unauthenticated
    }
  }

  next();
};

// Authorize specific roles (e.g., 'Admin', 'TeamLead')
const authorize = (...roles) => {
  return (req, res, next) => {
    const allowedRoles = roles.map((role) => normalizeUserRole(role));
    const userRole = normalizeUserRole(req.user?.role);

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: `User role '${userRole}' is not authorized to access this route`,
      });
    }

    next();
  };
};

module.exports = { protect, optionalProtect, authorize };