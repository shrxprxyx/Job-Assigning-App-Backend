/**
 * Chat Routes
 * Handles chat functionality endpoints
 */

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth');
const { validateSendMessage } = require('../middleware/validation');

/**
 * @route   GET /api/v1/chat
 * @desc    Get user's chat rooms
 * @access  Private
 */
router.get('/', authenticate, chatController.getChatRooms);

/**
 * @route   GET /api/v1/chat/:chatRoomId
 * @desc    Get chat room details
 * @access  Private
 */
router.get('/:chatRoomId', authenticate, chatController.getChatRoom);

/**
 * @route   GET /api/v1/chat/:chatRoomId/messages
 * @desc    Get chat messages
 * @access  Private
 */
router.get('/:chatRoomId/messages', authenticate, chatController.getMessages);

/**
 * @route   POST /api/v1/chat/:chatRoomId/message
 * @desc    Send a message in chat room
 * @access  Private
 */
router.post('/:chatRoomId/message', authenticate, chatController.sendMessage);

module.exports = router;
