/**
 * Auth Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login or register with phone number
 * @access  Public
 */
router.post('/login', authController.loginWithPhone);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   DELETE /api/v1/auth/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/account', authenticate, authController.deleteAccount);

module.exports = router;