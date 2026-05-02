/**
 * User Controller
 * Handles user profile and related operations
 */

const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-aadhaarImage -fcmToken');

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'age', 'skills', 'profileImage', 'availability'];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (req.body.availability && typeof req.body.availability === 'object') {
    updates.availability = {
      ...req.user.availability,
      ...req.body.availability,
    };
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-aadhaarImage -fcmToken');

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user },
  });
});

/**
 * @desc    Complete user profile after signup
 * @route   POST /api/v1/users/complete-profile
 * @access  Private
 *
 * Body:
 *   name     {string}   required
 *   age      {number}   optional
 *   gender   {string}   required
 *   currentMode {string} 'employer' | 'worker'  — defaults to 'worker'
 *   skills   {string[]} required for workers, optional for employers
 */
const completeProfile = asyncHandler(async (req, res) => {
  const { name, age, gender, skills, currentMode } = req.body;

  const mode = currentMode === 'employer' ? 'employer' : 'worker';

  // Name and gender are always required
  if (!name || !gender) {
    throw new ApiError(400, 'Name and gender are required', 'INCOMPLETE_DATA');
  }

  // Workers must provide at least one skill
  if (mode === 'worker' && (!skills || skills.length === 0)) {
    throw new ApiError(
      400,
      'At least one skill is required for workers',
      'SKILLS_REQUIRED'
    );
  }

  const updateData = {
    name,
    age: age || null,
    gender,
    currentMode: mode,
    // For employers, keep existing skills (or empty); for workers, save provided skills
    ...(skills && skills.length > 0 ? { skills } : {}),
  };

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('-fcmToken');

  res.status(200).json({
    success: true,
    message: 'Profile completed successfully',
    data: { user },
  });
});

/**
 * @desc    Add skills (used when an employer switches to worker for the first time)
 * @route   POST /api/v1/users/add-skills
 * @access  Private
 */
const addSkills = asyncHandler(async (req, res) => {
  const { skills } = req.body;

  if (!skills || skills.length === 0) {
    throw new ApiError(400, 'At least one skill is required', 'SKILLS_REQUIRED');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { skills } },
    { new: true, runValidators: true }
  ).select('-fcmToken');

  res.status(200).json({
    success: true,
    message: 'Skills added successfully',
    data: { user },
  });
});

/**
 * @desc    Update user location
 * @route   PUT /api/v1/users/location
 * @access  Private
 */
const updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, locationText } = req.body;

  if (latitude === undefined || longitude === undefined) {
    throw new ApiError(400, 'Latitude and longitude are required', 'INVALID_LOCATION');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
          text: locationText || '',
        },
      },
    },
    { new: true }
  ).select('-aadhaarImage -fcmToken');

  res.status(200).json({
    success: true,
    message: 'Location updated successfully',
    data: { user },
  });
});

/**
 * @desc    Switch user mode (employer/worker)
 * @route   PUT /api/v1/users/switch-mode
 * @access  Private
 */
const switchMode = asyncHandler(async (req, res) => {
  const { mode } = req.body;

  if (!mode || !['employer', 'worker'].includes(mode)) {
    throw new ApiError(400, 'Invalid mode. Must be employer or worker.', 'INVALID_MODE');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { currentMode: mode } },
    { new: true }
  ).select('-aadhaarImage -fcmToken');

  res.status(200).json({
    success: true,
    message: `Switched to ${mode} mode`,
    data: { user },
  });
});

/**
 * @desc    Toggle availability status
 * @route   PUT /api/v1/users/toggle-availability
 * @access  Private
 */
const toggleAvailability = asyncHandler(async (req, res) => {
  const user = req.user;
  const newAvailability = await user.toggleAvailability();

  res.status(200).json({
    success: true,
    message: `You are now ${newAvailability ? 'available' : 'unavailable'}`,
    data: { isAvailable: newAvailability },
  });
});

/**
 * @desc    Get user by ID
 * @route   GET /api/v1/users/:userId
 * @access  Private
 */
const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .select('name skills rating profileImage availability currentMode location');

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});

module.exports = {
  getProfile,
  updateProfile,
  completeProfile,
  addSkills,
  updateLocation,
  switchMode,
  toggleAvailability,
  getUserById,
};