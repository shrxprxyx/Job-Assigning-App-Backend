/**
 * Chat Controller
 * Handles chat functionality using Firebase Firestore
 */

const AcceptedJob = require('../models/AcceptedJob');
const SkillRequest = require('../models/SkillRequest');
const SkillPost = require('../models/SkillPost');
const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getFirestore } = require('../config/firebase');

/**
 * Helper — find who owns a chat room (job-based or skill-based)
 */
const resolveChatRoom = async (chatRoomId, userId) => {
  // 1. Try job-based chat first
  const acceptedJob = await AcceptedJob.findOne({ chatRoomId })
    .populate('jobId', 'title description payment locationText')
    .populate('workerId', 'name phone profileImage')
    .populate('employerId', 'name phone profileImage');

  if (acceptedJob) {
    const isWorker = acceptedJob.workerId._id.toString() === userId.toString();
    const isEmployer = acceptedJob.employerId._id.toString() === userId.toString();
    if (!isWorker && !isEmployer) return null;
    return { type: 'job', acceptedJob, isWorker, isEmployer };
  }

  // 2. Try skill-based chat
  const skillRequest = await SkillRequest.findOne({ chatRoomId })
    .populate('fromUserId', 'name phone profileImage')
    .populate({
      path: 'skillPostId',
      populate: { path: 'userId', select: 'name phone profileImage' },
    });

  if (skillRequest) {
    const requesterId = skillRequest.fromUserId._id.toString();
    const postOwnerId = skillRequest.skillPostId.userId._id.toString();
    const isRequester = requesterId === userId.toString();
    const isOwner = postOwnerId === userId.toString();
    if (!isRequester && !isOwner) return null;
    return { type: 'skill', skillRequest, isRequester, isOwner };
  }

  return null;
};

const getChatRoom = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;

  const resolved = await resolveChatRoom(chatRoomId, req.user._id);

  if (!resolved) {
    throw new ApiError(404, 'Chat room not found or not authorized', 'CHAT_NOT_FOUND');
  }

  if (resolved.type === 'job') {
    const { acceptedJob } = resolved;
    return res.status(200).json({
      success: true,
      data: {
        chatRoomId,
        type: 'job',
        job: acceptedJob.jobId,
        worker: acceptedJob.workerId,
        employer: acceptedJob.employerId,
        status: acceptedJob.status,
        acceptedAt: acceptedJob.acceptedAt,
      },
    });
  }

  const { skillRequest } = resolved;
  return res.status(200).json({
    success: true,
    data: {
      chatRoomId,
      type: 'skill',
      skill: skillRequest.skillPostId.skill,
      worker: skillRequest.skillPostId.userId,
      employer: skillRequest.fromUserId,
      status: skillRequest.status,
    },
  });
});

const sendMessage = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    throw new ApiError(400, 'Message is required', 'MESSAGE_REQUIRED');
  }

  const resolved = await resolveChatRoom(chatRoomId, req.user._id);

  if (!resolved) {
    throw new ApiError(404, 'Chat room not found or not authorized', 'CHAT_NOT_FOUND');
  }

  const db = getFirestore();
  const messageData = {
    senderId: req.user._id.toString(),
    senderName: req.user.name || 'User',
    message: message.trim(),
    timestamp: new Date().toISOString(),
    read: false,
  };

  await db.collection('chats').doc(chatRoomId).collection('messages').add(messageData);

  await db.collection('chats').doc(chatRoomId).set({
    lastMessage: message.trim(),
    lastMessageAt: new Date().toISOString(),
    lastSenderId: req.user._id.toString(),
  }, { merge: true });

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: { messageData },
  });
});

const getMessages = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { limit = 50, before } = req.query;

  const resolved = await resolveChatRoom(chatRoomId, req.user._id);

  if (!resolved) {
    throw new ApiError(404, 'Chat room not found or not authorized', 'CHAT_NOT_FOUND');
  }

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
    messages.push({ id: doc.id, ...doc.data() });
  });

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

const getChatRooms = asyncHandler(async (req, res) => {
  // ── Job-based chat rooms ──
  const acceptedJobs = await AcceptedJob.find({
    $or: [{ workerId: req.user._id }, { employerId: req.user._id }],
    status: { $in: ['Active', 'Completed'] },
  })
    .populate('jobId', 'title')
    .populate('workerId', 'name profileImage')
    .populate('employerId', 'name profileImage')
    .sort({ acceptedAt: -1 });

  const jobChatRooms = acceptedJobs.map((aj) => ({
    chatRoomId: aj.chatRoomId,
    type: 'job',
    job: aj.jobId,
    worker: aj.workerId,
    employer: aj.employerId,
    status: aj.status,
    isUserWorker: aj.workerId._id.toString() === req.user._id.toString(),
    acceptedAt: aj.acceptedAt,
  }));

  // ── Skill-based chat rooms (as requester / employer side) ──
  const asRequester = await SkillRequest.find({
    fromUserId: req.user._id,
    status: 'accepted',
    chatRoomId: { $exists: true, $ne: null },
  })
    .populate('fromUserId', 'name profileImage')
    .populate({
      path: 'skillPostId',
      populate: { path: 'userId', select: 'name profileImage' },
    });

  // ── Skill-based chat rooms (as post owner / worker side) ──
  const myPosts = await SkillPost.find({ userId: req.user._id }).select('_id');
  const myPostIds = myPosts.map((p) => p._id);

  const asOwner = myPostIds.length > 0
    ? await SkillRequest.find({
        skillPostId: { $in: myPostIds },
        status: 'accepted',
        chatRoomId: { $exists: true, $ne: null },
      })
        .populate('fromUserId', 'name profileImage')
        .populate({
          path: 'skillPostId',
          populate: { path: 'userId', select: 'name profileImage' },
        })
    : [];

  // Merge and deduplicate by chatRoomId
  const seen = new Set();
  const allSkillRequests = [...asRequester, ...asOwner].filter((sr) => {
    if (seen.has(sr.chatRoomId)) return false;
    seen.add(sr.chatRoomId);
    return true;
  });

  const skillChatRooms = allSkillRequests.map((sr) => ({
    chatRoomId: sr.chatRoomId,
    type: 'skill',
    job: { title: sr.skillPostId?.skill ?? 'Skill Chat' },
    worker: sr.skillPostId?.userId,
    employer: sr.fromUserId,
    status: 'Active',
    isUserWorker: sr.skillPostId?.userId?._id?.toString() === req.user._id.toString(),
  }));

  res.status(200).json({
    success: true,
    count: jobChatRooms.length + skillChatRooms.length,
    data: { chatRooms: [...jobChatRooms, ...skillChatRooms] },
  });
});

module.exports = {
  getChatRoom,
  sendMessage,
  getMessages,
  getChatRooms,
};