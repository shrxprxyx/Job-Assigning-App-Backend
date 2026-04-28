/**
 * Job Routes
 * Handles job creation and management endpoints
 */

const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');
const { authenticate, requireCompleteProfile } = require('../middleware/auth');
const { validateCreateJob, validateUpdateJob, validateJobId, validatePagination } = require('../middleware/validation');

/**
 * @route   POST /api/v1/jobs
 * @desc    Create a new job
 * @access  Private
 */
router.post('/', authenticate, validateCreateJob, jobController.createJob);

/**
 * @route   GET /api/v1/jobs/my-jobs
 * @desc    Get jobs created by current user
 * @access  Private
 */
router.get('/my-jobs', authenticate, validatePagination, jobController.getMyJobs);

/**
 * @route   GET /api/v1/jobs/available
 * @desc    Get available jobs for workers
 * @access  Private
 */
router.get('/available', authenticate, validatePagination, jobController.getAvailableJobs);

/**
 * @route   GET /api/v1/jobs/:jobId
 * @desc    Get job by ID
 * @access  Private
 */
router.get('/:jobId', authenticate, validateJobId, jobController.getJobById);

/**
 * @route   PUT /api/v1/jobs/:jobId
 * @desc    Update job
 * @access  Private (Owner only)
 */
router.put('/:jobId', authenticate, validateUpdateJob, jobController.updateJob);

/**
 * @route   PUT /api/v1/jobs/:jobId/cancel
 * @desc    Cancel job
 * @access  Private (Owner only)
 */
router.put('/:jobId/cancel', authenticate, validateJobId, jobController.cancelJob);

/**
 * @route   PUT /api/v1/jobs/:jobId/close
 * @desc    Close job
 * @access  Private (Owner only)
 */
router.put('/:jobId/close', authenticate, validateJobId, jobController.closeJob);

/**
 * @route   GET /api/v1/jobs/:jobId/applicants
 * @desc    Get job applicants
 * @access  Private (Owner only)
 */
router.get('/:jobId/applicants', authenticate, validateJobId, jobController.getJobApplicants);

module.exports = router;
