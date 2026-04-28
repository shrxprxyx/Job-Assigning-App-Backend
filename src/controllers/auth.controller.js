/**
 * Auth Controller
 * Simple phone-based login — no OTP, no Firebase
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
console.log('User model:', typeof User, Object.keys(User));

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

/**
 * @desc    Login or register with phone number
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const loginWithPhone = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ApiError(400, 'Phone number is required', 'PHONE_REQUIRED');
  }

  let user = await User.findOne({ phone: phoneNumber });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({ phone: phoneNumber });
  } else {
    user.lastActiveAt = new Date();
    await user.save();
  }

  const token = signToken(user._id);

  res.status(200).json({
    success: true,
    message: isNewUser ? 'User registered successfully' : 'Login successful',
    token,
    data: {
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        isProfileComplete: user.isProfileComplete,
        currentMode: user.currentMode,
        skills: user.skills,
        rating: user.rating,
      },
      isNewUser,
    },
  });
});

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-fcmToken');

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});

/**
 * @desc    Logout
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @desc    Delete user account
 * @route   DELETE /api/v1/auth/account
 * @access  Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const user = req.user;

  user.status = 'deleted';
  user.phone = `deleted_${user._id}_${user.phone}`;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
  });
});

module.exports = {
  loginWithPhone,
  getMe,
  logout,
  deleteAccount,
};