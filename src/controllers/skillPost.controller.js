/**
 * Skill Post Controller
 */

const SkillPost = require('../models/SkillPost');
const SkillRequest = require('../models/SkillRequest');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @desc    Create a skill post
 * @route   POST /api/v1/skill-posts
 * @access  Private
 */
const createSkillPost = asyncHandler(async (req, res) => {
  const { skill, description, photo, priceRange, category, location } = req.body;

  const skillPost = await SkillPost.create({
    userId: req.user._id,
    skill,
    description,
    photo: photo || null,
    priceRange: priceRange || '',
    category: category || '',
    location: location || req.user.location,
  });

  await skillPost.populate('userId', 'name phone rating profileImage');

  res.status(201).json({
    success: true,
    message: 'Skill post created successfully',
    data: { skillPost },
  });
});

/**
 * @desc    Get all skill posts
 * @route   GET /api/v1/skill-posts
 * @access  Private
 */
const getSkillPosts = asyncHandler(async (req, res) => {
  const { category, search, page = 1, limit = 20 } = req.query;

  const query = { status: 'Active' };
  if (category) query.category = category;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let skillPosts;

  if (search) {
    skillPosts = await SkillPost.find({ ...query, $text: { $search: search } })
      .populate('userId', 'name phone rating profileImage')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(parseInt(limit));
  } else {
    skillPosts = await SkillPost.find(query)
      .populate('userId', 'name phone rating profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
  }

  const total = await SkillPost.countDocuments(query);

  res.status(200).json({
    success: true,
    count: skillPosts.length,
    total,
    data: { skillPosts },
  });
});

/**
 * @desc    Get my skill posts
 * @route   GET /api/v1/skill-posts/my-posts
 * @access  Private
 */
const getMySkillPosts = asyncHandler(async (req, res) => {
  const skillPosts = await SkillPost.find({
    userId: req.user._id,
    status: { $ne: 'Deleted' },
  }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: skillPosts.length,
    data: { skillPosts },
  });
});

/**
 * @desc    Get skill post by ID
 * @route   GET /api/v1/skill-posts/:postId
 * @access  Private
 */
const getSkillPostById = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const skillPost = await SkillPost.findById(postId)
    .populate('userId', 'name phone rating profileImage skills');

  if (!skillPost || skillPost.status === 'Deleted') {
    throw new ApiError(404, 'Skill post not found', 'POST_NOT_FOUND');
  }

  await skillPost.incrementViews();

  res.status(200).json({
    success: true,
    data: { skillPost },
  });
});

/**
 * @desc    Update skill post
 * @route   PUT /api/v1/skill-posts/:postId
 * @access  Private (Owner only)
 */
const updateSkillPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  let skillPost = await SkillPost.findById(postId);

  if (!skillPost || skillPost.status === 'Deleted') {
    throw new ApiError(404, 'Skill post not found', 'POST_NOT_FOUND');
  }

  if (skillPost.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to update this post', 'NOT_AUTHORIZED');
  }

  const allowedUpdates = ['skill', 'description', 'photo', 'priceRange', 'category', 'status', 'availability'];
  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  skillPost = await SkillPost.findByIdAndUpdate(postId, { $set: updates }, {
    new: true,
    runValidators: true,
  }).populate('userId', 'name phone rating profileImage');

  res.status(200).json({
    success: true,
    message: 'Skill post updated successfully',
    data: { skillPost },
  });
});

/**
 * @desc    Delete skill post
 * @route   DELETE /api/v1/skill-posts/:postId
 * @access  Private (Owner only)
 */
const deleteSkillPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const skillPost = await SkillPost.findById(postId);

  if (!skillPost) {
    throw new ApiError(404, 'Skill post not found', 'POST_NOT_FOUND');
  }

  if (skillPost.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to delete this post', 'NOT_AUTHORIZED');
  }

  skillPost.status = 'Deleted';
  await skillPost.save();

  res.status(200).json({
    success: true,
    message: 'Skill post deleted successfully',
  });
});

/**
 * @desc    Request a skill post (employer → worker)
 * @route   POST /api/v1/skill-posts/:postId/request
 * @access  Private
 */
const requestJobFromSkillPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { message } = req.body;

  const skillPost = await SkillPost.findById(postId);

  if (!skillPost || skillPost.status !== 'Active') {
    throw new ApiError(404, 'Skill post not found', 'POST_NOT_FOUND');
  }

  if (skillPost.userId.toString() === req.user._id.toString()) {
    throw new ApiError(400, 'Cannot request from your own post', 'OWN_POST');
  }

  // Prevent duplicate pending requests
  const existing = await SkillRequest.findOne({
    skillPostId: postId,
    fromUserId: req.user._id,
    status: 'pending',
  });

  if (existing) {
    throw new ApiError(400, 'You already sent a request for this post', 'ALREADY_REQUESTED');
  }

  await SkillRequest.create({
    skillPostId: postId,
    fromUserId: req.user._id,
    message: message || '',
  });

  skillPost.requestCount += 1;
  await skillPost.save();

  res.status(200).json({
    success: true,
    message: 'Job request sent successfully',
  });
});

/**
 * @desc    Get all requests for a skill post (owner only)
 * @route   GET /api/v1/skill-posts/:postId/requests
 * @access  Private
 */
const getSkillPostRequests = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const skillPost = await SkillPost.findById(postId);

  if (!skillPost) {
    throw new ApiError(404, 'Skill post not found', 'POST_NOT_FOUND');
  }

  if (skillPost.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized', 'NOT_AUTHORIZED');
  }

  const requests = await SkillRequest.find({
    skillPostId: postId,
    status: 'pending',
  })
    .populate('fromUserId', 'name phone rating profileImage')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: requests.length,
    data: { requests },
  });
});

/**
 * @desc    Accept a skill request
 * @route   PUT /api/v1/skill-posts/:postId/requests/:requestId/accept
 * @access  Private (Owner only)
 */
const acceptSkillRequest = asyncHandler(async (req, res) => {
  const { postId, requestId } = req.params;

  const skillPost = await SkillPost.findById(postId);

  if (!skillPost) {
    throw new ApiError(404, 'Skill post not found', 'POST_NOT_FOUND');
  }

  if (skillPost.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized', 'NOT_AUTHORIZED');
  }

  const request = await SkillRequest.findById(requestId)
    .populate('fromUserId', 'name phone');

  if (!request) {
    throw new ApiError(404, 'Request not found', 'REQUEST_NOT_FOUND');
  }

  request.status = 'accepted';
  await request.save();

  res.status(200).json({
    success: true,
    message: `Accepted request from ${request.fromUserId.name}`,
    data: { request },
  });
});

module.exports = {
  createSkillPost,
  getSkillPosts,
  getMySkillPosts,
  getSkillPostById,
  updateSkillPost,
  deleteSkillPost,
  requestJobFromSkillPost,
  getSkillPostRequests,
  acceptSkillRequest,
};