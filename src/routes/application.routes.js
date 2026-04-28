/**
 * Application Routes
 * Handles job application endpoints
 */

const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');
const { authenticate } = require('../middleware/auth');
const { validateApplyJob, validateApplicationAction, validateRating, validatePagination } = require('../middleware/validation');

/**
 * @route   POST /api/v1/applications/apply
 * @desc    Apply for a job
 * @access  Private
 */
router.post('/apply', authenticate, validateApplyJob, applicationController.applyForJob);

/**
 * @route   GET /api/v1/applications/my-applications
 * @desc    Get my applications (as worker)
 * @access  Private
 */
router.get('/my-applications', authenticate, validatePagination, applicationController.getMyApplications);

/**
 * @route   GET /api/v1/applications/accepted-jobs
 * @desc    Get accepted jobs (as worker)
 * @access  Private
 */
router.get('/accepted-jobs', authenticate, applicationController.getAcceptedJobs);

/**
 * @route   GET /api/v1/applications/incoming-requests
 * @desc    Get incoming job requests
 * @access  Private
 */
router.get('/incoming-requests', authenticate, applicationController.getIncomingRequests);

/**
 * @route   PUT /api/v1/applications/:applicationId
 * @desc    Accept or reject an application (as employer)
 * @access  Private
 */
router.put('/:applicationId', authenticate, validateApplicationAction, applicationController.handleApplication);

/**
 * @route   DELETE /api/v1/applications/:applicationId
 * @desc    Withdraw application
 * @access  Private
 */
router.delete('/:applicationId', authenticate, applicationController.withdrawApplication);

/**
 * @route   PUT /api/v1/applications/accepted/:acceptedJobId/complete
 * @desc    Mark accepted job as completed
 * @access  Private (Employer)
 */
router.put('/accepted/:acceptedJobId/complete', authenticate, applicationController.completeJob);

/**
 * @route   POST /api/v1/applications/accepted/:acceptedJobId/rate
 * @desc    Rate a completed job
 * @access  Private
 */
router.post('/accepted/:acceptedJobId/rate', authenticate, validateRating, applicationController.rateJob);

module.exports = router;
