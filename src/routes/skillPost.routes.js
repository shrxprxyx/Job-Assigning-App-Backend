/**
 * Skill Post Routes
 * Handles skill post endpoints for the Explore feature
 */

const express = require('express');
const router = express.Router();
const skillPostController = require('../controllers/skillPost.controller');
const { authenticate } = require('../middleware/auth');
const { validateSkillPost, validatePagination } = require('../middleware/validation');

/**
 * @route   POST /api/v1/skill-posts
 * @desc    Create a new skill post
 * @access  Private
 */
router.post('/', authenticate, validateSkillPost, skillPostController.createSkillPost);

/**
 * @route   GET /api/v1/skill-posts
 * @desc    Get all skill posts (for explore page)
 * @access  Private
 */
router.get('/', authenticate, validatePagination, skillPostController.getSkillPosts);

/**
 * @route   GET /api/v1/skill-posts/my-posts
 * @desc    Get my skill posts
 * @access  Private
 */
router.get('/my-posts', authenticate, skillPostController.getMySkillPosts);

/**
 * @route   GET /api/v1/skill-posts/:postId
 * @desc    Get skill post by ID
 * @access  Private
 */
router.get('/:postId', authenticate, skillPostController.getSkillPostById);

/**
 * @route   PUT /api/v1/skill-posts/:postId
 * @desc    Update skill post
 * @access  Private (Owner only)
 */
router.put('/:postId', authenticate, skillPostController.updateSkillPost);

/**
 * @route   DELETE /api/v1/skill-posts/:postId
 * @desc    Delete skill post
 * @access  Private (Owner only)
 */
router.delete('/:postId', authenticate, skillPostController.deleteSkillPost);

/**
 * @route   POST /api/v1/skill-posts/:postId/request
 * @desc    Request job from skill post
 * @access  Private
 */
router.post('/:postId/request', authenticate, skillPostController.requestJobFromSkillPost);

/**
 * @route   GET /api/v1/skill-posts/:postId/requests
 * @desc    Get all pending requests for a skill post (owner only)
 * @access  Private
 */
router.get('/:postId/requests', authenticate, skillPostController.getSkillPostRequests);

/**
 * @route   PUT /api/v1/skill-posts/:postId/requests/:requestId/accept
 * @desc    Accept a specific skill request
 * @access  Private (Owner only)
 */
router.put('/:postId/requests/:requestId/accept', authenticate, skillPostController.acceptSkillRequest);

module.exports = router;