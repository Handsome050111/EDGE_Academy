const { body, validationResult } = require('express-validator');
const { validatePasswordStrength } = require('../utils/security');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }
  next();
};

const validateRegister = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').custom((value) => {
    const result = validatePasswordStrength(value);
    if (!result.valid) {
      throw new Error(result.errors.join(' '));
    }
    return true;
  }),
  validateRequest,
];

const validateLogin = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  validateRequest,
];

const validateProgress = [
  body('trackId').notEmpty().withMessage('Track ID is required'),
  body('moduleId').optional().notEmpty().withMessage('Module ID cannot be empty'),
  body('quizScore').optional().isNumeric().withMessage('Quiz score must be numeric'),
  validateRequest,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProgress,
};
