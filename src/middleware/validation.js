/**
 * Validation Middleware
 */

const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errorMessages,
    });
  }

  next();
};

// Auth
const validatePhoneLogin = [
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage('Invalid phone number format'),
  validate,
];

// User profile
const validateUserProfile = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('age')
    .optional()
    .isInt({ min: 13, max: 120 })
    .withMessage('Age must be between 13 and 120'),
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  body('skills.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Each skill must be between 2 and 100 characters'),
  validate,
];

const validateCompleteProfile = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('gender')
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('age')
    .optional()
    .isInt({ min: 13, max: 120 })
    .withMessage('Age must be between 13 and 120'),
  body('currentMode')
    .optional()
    .isIn(['employer', 'worker'])
    .withMessage('currentMode must be employer or worker'),
  // Skills are only required when the user is signing up as a worker
  body('skills').custom((skills, { req }) => {
    const mode = req.body.currentMode;
    if (mode === 'employer') return true;          // employers skip skills
    if (!skills || skills.length === 0) {
      throw new Error('At least one skill is required for workers');
    }
    return true;
  }),
  body('skills.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Each skill must be between 2 and 100 characters'),
  validate,
];

const validateLocation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('locationText')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Location text cannot exceed 500 characters'),
  validate,
];

// Jobs
const validateCreateJob = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Job title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Job description is required')
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('payment')
    .trim()
    .notEmpty()
    .withMessage('Payment information is required'),
  body('locationText')
    .trim()
    .notEmpty()
    .withMessage('Location is required'),
  body('startTime').optional().trim(),
  body('totalTime').optional().trim(),
  body('locationGeo').optional().isObject(),
  body('locationGeo.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('locationGeo.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  validate,
];

const validateUpdateJob = [
  param('jobId').isMongoId().withMessage('Invalid job ID'),
  body('title').optional().trim().isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('status')
    .optional()
    .isIn(['Open', 'Closed', 'Cancelled'])
    .withMessage('Invalid status'),
  validate,
];

const validateJobId = [
  param('jobId').isMongoId().withMessage('Invalid job ID'),
  validate,
];

// Applications
const validateApplyJob = [
  body('jobId').isMongoId().withMessage('Invalid job ID'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters'),
  validate,
];

const validateApplicationAction = [
  param('applicationId').isMongoId().withMessage('Invalid application ID'),
  body('action')
    .isIn(['accept', 'reject'])
    .withMessage('Action must be accept or reject'),
  validate,
];

// Skill posts
const validateSkillPost = [
  body('skill')
    .trim()
    .notEmpty()
    .withMessage('Skill name is required')
    .isLength({ max: 100 }),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 }),
  body('photo').optional().trim(),
  validate,
];

// Chat
const validateSendMessage = [
  body('chatRoomId').trim().notEmpty().withMessage('Chat room ID is required'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 2000 }),
  validate,
];

// Rating
const validateRating = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('review').optional().trim().isLength({ max: 500 }),
  validate,
];

// Pagination
const validatePagination = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
];

module.exports = {
  validate,
  validatePhoneLogin,
  validateUserProfile,
  validateCompleteProfile,
  validateLocation,
  validateCreateJob,
  validateUpdateJob,
  validateJobId,
  validateApplyJob,
  validateApplicationAction,
  validateSkillPost,
  validateSendMessage,
  validateRating,
  validatePagination,
};