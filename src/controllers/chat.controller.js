/**
 * Chat Controller
 * Handles chat functionality using Firebase Firestore
 */

const AcceptedJob = require('../models/AcceptedJob');
const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getFirestore, sendPushNotification } = require('../config/firebase');

/**
 * @desc    Get chat room details
 * @route   GET /api/v1/chat/:chatRoomId
 * @access  Private
 */
const getChatRoom = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;

  // Find accepted job with this chat room
  const acceptedJob = await AcceptedJob.findOne({ chatRoomId })
    .populate({
      path: 'jobId',
      select: 'title description payment locationText',
    })
    .populate('workerId', 'name phone profileImage')
    .populate('employerId', 'name phone profileImage');

  if (!acceptedJob) {
    throw new ApiError(404, 'Chat room not found', 'CHAT_NOT_FOUND');
  }

  // Verify user is part of this chat
  const isWorker = acceptedJob.workerId._id.toString() === req.user._id.toString();
  const isEmployer = acceptedJob.employerId._id.toString() === req.user._id.toString();

  if (!isWorker && !isEmployer) {
    throw new ApiError(403, 'Not authorized to access this chat', 'NOT_AUTHORIZED');
  }

  res.status(200).json({
    success: true,
    data: {
      chatRoomId,
      job: acceptedJob.jobId,
      worker: acceptedJob.workerId,
      employer: acceptedJob.employerId,
      status: acceptedJob.status,
      acceptedAt: acceptedJob.acceptedAt,
    },
  });
});

/**
 * @desc    Send a message in chat room
 * @route   POST /api/v1/chat/:chatRoomId/message
 * @access  Private
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    throw new ApiError(400, 'Message is required', 'MESSAGE_REQUIRED');
  }

  // Find accepted job with this chat room
  const acceptedJob = await AcceptedJob.findOne({ chatRoomId })
    .populate('workerId', 'name fcmToken')
    .populate('employerId', 'name fcmToken')
    .populate('jobId', 'title');

  if (!acceptedJob) {
    throw new ApiError(404, 'Chat room not found', 'CHAT_NOT_FOUND');
  }

  // Verify user is part of this chat
  const isWorker = acceptedJob.workerId._id.toString() === req.user._id.toString();
  const isEmployer = acceptedJob.employerId._id.toString() === req.user._id.toString();

  if (!isWorker && !isEmployer) {
    throw new ApiError(403, 'Not authorized to send messages here', 'NOT_AUTHORIZED');
  }

  // Store message in Firestore
  const db = getFirestore();
  const messageData = {
    senderId: req.user._id.toString(),
    senderName: req.user.name || 'User',
    message: message.trim(),
    timestamp: new Date().toISOString(),
    read: false,
  };

  await db.collection('chats').doc(chatRoomId).collection('messages').add(messageData);

  // Update chat room last message
  await db.collection('chats').doc(chatRoomId).set({
    lastMessage: message.trim(),
    lastMessageAt: new Date().toISOString(),
    lastSenderId: req.user._id.toString(),
    jobId: acceptedJob.jobId._id.toString(),
    jobTitle: acceptedJob.jobId.title,
    workerId: acceptedJob.workerId._id.toString(),
    employerId: acceptedJob.employerId._id.toString(),
  }, { merge: true });

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: { messageData },
  });
});

/**
 * @desc    Get chat messages
 * @route   GET /api/v1/chat/:chatRoomId/messages
 * @access  Private
 */
const getMessages = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { limit = 50, before } = req.query;

  // Find accepted job with this chat room
  const acceptedJob = await AcceptedJob.findOne({ chatRoomId });

  if (!acceptedJob) {
    throw new ApiError(404, 'Chat room not found', 'CHAT_NOT_FOUND');
  }

  // Verify user is part of this chat
  const isWorker = acceptedJob.workerId.toString() === req.user._id.toString();
  const isEmployer = acceptedJob.employerId.toString() === req.user._id.toString();

  if (!isWorker && !isEmployer) {
    throw new ApiError(403, 'Not authorized to view messages', 'NOT_AUTHORIZED');
  }

  // Get messages from Firestore
  const db = getFirestore();
  let query = db
    .collection('chats')
    .doc(chatRoomId)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(parseInt(limit));

  if (before) {
    query = query.where('timestamp', '<', before);
  }

  const snapshot = await query.get();

  const messages = [];
  snapshot.forEach((doc) => {
    messages.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  // Mark messages as read
  const unreadMessages = snapshot.docs.filter(
    (doc) => !doc.data().read && doc.data().senderId !== req.user._id.toString()
  );

  for (const doc of unreadMessages) {
    await doc.ref.update({ read: true });
  }

  res.status(200).json({
    success: true,
    count: messages.length,
    data: { messages: messages.reverse() },
  });
});

/**
 * @desc    Get user's chat rooms
 * @route   GET /api/v1/chat
 * @access  Private
 */
const getChatRooms = asyncHandler(async (req, res) => {
  // Get all accepted jobs where user is involved
  const acceptedJobs = await AcceptedJob.find({
    $or: [
      { workerId: req.user._id },
      { employerId: req.user._id },
    ],
    status: { $in: ['Active', 'Completed'] },
  })
    .populate('jobId', 'title')
    .populate('workerId', 'name profileImage')
    .populate('employerId', 'name profileImage')
    .sort({ acceptedAt: -1 });

  const chatRooms = acceptedJobs.map((aj) => ({
    chatRoomId: aj.chatRoomId,
    job: aj.jobId,
    worker: aj.workerId,
    employer: aj.employerId,
    status: aj.status,
    isUserWorker: aj.workerId._id.toString() === req.user._id.toString(),
    acceptedAt: aj.acceptedAt,
  }));

  res.status(200).json({
    success: true,
    count: chatRooms.length,
    data: { chatRooms },
  });
});

module.exports = {
  getChatRoom,
  sendMessage,
  getMessages,
  getChatRooms,
};
