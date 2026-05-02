/**
 * User Routes
 * Handles user profile and management endpoints
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, requireCompleteProfile } = require('../middleware/auth');
const { validateUserProfile, validateLocation, validateCompleteProfile } = require('../middleware/validation');

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, userController.getProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, validateUserProfile, userController.updateProfile);

/**
 * @route   POST /api/v1/users/complete-profile
 * @desc    Complete user profile after signup
 * @access  Private
 */
router.post('/complete-profile', authenticate, validateCompleteProfile, userController.completeProfile);

/**
 * @route   PUT /api/v1/users/location
 * @desc    Update user location
 * @access  Private
 */
router.put('/location', authenticate, validateLocation, userController.updateLocation);

/**
 * @route   POST /api/v1/users/add-skills
 * @desc    Add skills to user profile
 * @access  Private
 */
router.post('/add-skills', authenticate, userController.addSkills);

/**
 * @route   PUT /api/v1/users/switch-mode
 * @desc    Switch between employer and worker mode
 * @access  Private
 */
router.put('/switch-mode', authenticate, userController.switchMode);

/**
 * @route   PUT /api/v1/users/toggle-availability
 * @desc    Toggle worker availability status
 * @access  Private
 */
router.put('/toggle-availability', authenticate, userController.toggleAvailability);

/**
 * @route   GET /api/v1/users/:userId
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:userId', authenticate, userController.getUserById);

module.exports = router;
