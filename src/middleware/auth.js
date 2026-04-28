/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify JWT authentication
 * Expects Authorization header: Bearer <jwt>
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
        code: 'INVALID_TOKEN',
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    user.lastActiveAt = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Middleware to check if user profile is complete
 */
const requireCompleteProfile = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      code: 'AUTH_REQUIRED',
    });
  }

  if (!req.user.isProfileComplete) {
    return res.status(403).json({
      success: false,
      message: 'Please complete your profile first.',
      code: 'PROFILE_INCOMPLETE',
    });
  }

  next();
};

/**
 * Middleware to check user's current mode
 * @param {string} requiredMode - 'employer' or 'worker'
 */
const requireMode = (requiredMode) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
    }

    if (req.user.currentMode !== requiredMode) {
      return res.status(403).json({
        success: false,
        message: `This action requires ${requiredMode} mode.`,
        code: 'WRONG_MODE',
        currentMode: req.user.currentMode,
        requiredMode,
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireCompleteProfile,
  requireMode,
};