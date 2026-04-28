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
  const allowedFields = [
    'name',
    'age',
    'skills',
    'profileImage',
    'availability',
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  // Handle nested availability object
  if (req.body.availability) {
    if (typeof req.body.availability === 'object') {
      updates.availability = {
        ...req.user.availability,
        ...req.body.availability,
      };
    }
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
 */
const completeProfile = asyncHandler(async (req, res) => {
  const { name, age, gender, skills } = req.body;

  if (!name || !gender || !skills || skills.length === 0) {
    throw new ApiError(
      400,
      'Name, gender, and at least one skill are required',
      'INCOMPLETE_DATA'
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        name,
        age: age || null,
        gender,
        skills,
        isProfileComplete: true,
      },
    },
    { new: true, runValidators: true }
  ).select('-fcmToken');

  res.status(200).json({
    success: true,
    message: 'Profile completed successfully',
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
  updateLocation,
  switchMode,
  toggleAvailability,
  getUserById,
};
