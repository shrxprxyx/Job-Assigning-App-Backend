/**
 * Application Controller
 * Handles job applications, acceptance, and rejection
 */

const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const AcceptedJob = require('../models/AcceptedJob');
const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @desc    Apply for a job
 * @route   POST /api/v1/applications/apply
 * @access  Private (Worker)
 */
const applyForJob = asyncHandler(async (req, res) => {
  const { jobId, message } = req.body;

  const job = await Job.findById(jobId);

  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }

  if (job.status !== 'Open') {
    throw new ApiError(400, 'This job is no longer accepting applications', 'JOB_CLOSED');
  }

  if (job.createdBy.toString() === req.user._id.toString()) {
    throw new ApiError(400, 'Cannot apply to your own job', 'OWN_JOB');
  }

  const existingApplication = await JobApplication.findOne({
    jobId,
    applicantId: req.user._id,
  });

  if (existingApplication) {
    throw new ApiError(400, 'You have already applied for this job', 'ALREADY_APPLIED');
  }

  const application = await JobApplication.create({
    jobId,
    applicantId: req.user._id,
    message: message || '',
  });

  await Job.findByIdAndUpdate(jobId, { $inc: { applicantCount: 1 } });

  await application.populate('applicantId', 'name phone skills rating profileImage');

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully',
    data: { application },
  });
});

/**
 * @desc    Get my applications (as worker)
 * @route   GET /api/v1/applications/my-applications
 * @access  Private
 */
const getMyApplications = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = { applicantId: req.user._id };

  if (status) {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const applications = await JobApplication.find(query)
    .populate({
      path: 'jobId',
      populate: {
        path: 'createdBy',
        select: 'name phone rating',
      },
    })
    .sort({ appliedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await JobApplication.countDocuments(query);

  res.status(200).json({
    success: true,
    count: applications.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: { applications },
  });
});

/**
 * @desc    Accept or reject an application (as employer)
 * @route   PUT /api/v1/applications/:applicationId
 * @access  Private (Employer)
 */
const handleApplication = asyncHandler(async (req, res) => {
  const { applicationId } = req.params;
  const { action } = req.body; // 'accept' or 'reject'

  if (!['accept', 'reject'].includes(action)) {
    throw new ApiError(400, 'Action must be accept or reject', 'INVALID_ACTION');
  }

  const application = await JobApplication.findById(applicationId)
    .populate('jobId')
    .populate('applicantId', 'name phone skills rating');

  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }

  const job = application.jobId;

  if (job.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to handle this application', 'NOT_AUTHORIZED');
  }

  if (application.status !== 'Applied') {
    throw new ApiError(400, `Application has already been ${application.status.toLowerCase()}`, 'ALREADY_PROCESSED');
  }

  if (action === 'accept') {
    const existingAccepted = await AcceptedJob.findOne({ jobId: job._id });
    if (existingAccepted) {
      throw new ApiError(400, 'This job already has an accepted worker', 'WORKER_EXISTS');
    }

    application.status = 'Accepted';
    await application.save();

    const acceptedJob = await AcceptedJob.create({
      jobId: job._id,
      workerId: application.applicantId._id,
      employerId: req.user._id,
    });

    job.status = 'InProgress';
    await job.save();

    await JobApplication.updateMany(
      { jobId: job._id, status: 'Applied', _id: { $ne: applicationId } },
      { $set: { status: 'Rejected' } }
    );

    res.status(200).json({
      success: true,
      message: 'Application accepted successfully',
      data: {
        application,
        acceptedJob,
        chatRoomId: acceptedJob.chatRoomId,
      },
    });
  } else {
    application.status = 'Rejected';
    await application.save();

    res.status(200).json({
      success: true,
      message: 'Application rejected',
      data: { application },
    });
  }
});

/**
 * @desc    Withdraw application
 * @route   DELETE /api/v1/applications/:applicationId
 * @access  Private
 */
const withdrawApplication = asyncHandler(async (req, res) => {
  const { applicationId } = req.params;

  const application = await JobApplication.findById(applicationId);

  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }

  if (application.applicantId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to withdraw this application', 'NOT_AUTHORIZED');
  }

  if (application.status !== 'Applied') {
    throw new ApiError(400, 'Can only withdraw pending applications', 'CANNOT_WITHDRAW');
  }

  application.status = 'Withdrawn';
  await application.save();

  await Job.findByIdAndUpdate(application.jobId, { $inc: { applicantCount: -1 } });

  res.status(200).json({
    success: true,
    message: 'Application withdrawn successfully',
  });
});

/**
 * @desc    Get accepted jobs (as worker)
 * @route   GET /api/v1/applications/accepted-jobs
 * @access  Private
 */
const getAcceptedJobs = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const query = {
    $or: [
      { workerId: req.user._id },
      { employerId: req.user._id },
    ],
  };

  if (status) {
    query.status = status;
  }

  const acceptedJobs = await AcceptedJob.find(query)
    .populate({
      path: 'jobId',
      populate: {
        path: 'createdBy',
        select: 'name phone rating',
      },
    })
    .populate('employerId', 'name phone rating')
    .populate('workerId', 'name phone rating skills profileImage') 
    .sort({ acceptedAt: -1 });

  res.status(200).json({
    success: true,
    count: acceptedJobs.length,
    data: { acceptedJobs },
  });
});

/**
 * @desc    Get incoming job requests (as worker)
 * @route   GET /api/v1/applications/incoming-requests
 * @access  Private
 */
const getIncomingRequests = asyncHandler(async (req, res) => {
  const applications = await JobApplication.find({
    applicantId: req.user._id,
    status: 'Applied',
  })
    .populate({
      path: 'jobId',
      populate: {
        path: 'createdBy',
        select: 'name phone rating profileImage',
      },
    })
    .sort({ appliedAt: -1 });

  res.status(200).json({
    success: true,
    count: applications.length,
    data: { applications },
  });
});

/**
 * @desc    Complete a job
 * @route   PUT /api/v1/applications/accepted/:acceptedJobId/complete
 * @access  Private (Employer)
 */
const completeJob = asyncHandler(async (req, res) => {
  const { acceptedJobId } = req.params;

  const acceptedJob = await AcceptedJob.findById(acceptedJobId)
    .populate('jobId')
    .populate('workerId', 'name');

  if (!acceptedJob) {
    throw new ApiError(404, 'Accepted job not found', 'NOT_FOUND');
  }

  if (acceptedJob.employerId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized', 'NOT_AUTHORIZED');
  }

  if (acceptedJob.status !== 'Active') {
    throw new ApiError(400, 'Job is not active', 'JOB_NOT_ACTIVE');
  }

  acceptedJob.status = 'Completed';
  await acceptedJob.save();

  await Job.findByIdAndUpdate(acceptedJob.jobId._id, { status: 'Completed' });

  res.status(200).json({
    success: true,
    message: 'Job marked as completed',
    data: { acceptedJob },
  });
});

/**
 * @desc    Rate a completed job
 * @route   POST /api/v1/applications/accepted/:acceptedJobId/rate
 * @access  Private
 */
const rateJob = asyncHandler(async (req, res) => {
  const { acceptedJobId } = req.params;
  const { rating, review } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5', 'INVALID_RATING');
  }

  const acceptedJob = await AcceptedJob.findById(acceptedJobId)
    .populate('workerId')
    .populate('employerId');

  if (!acceptedJob) {
    throw new ApiError(404, 'Accepted job not found', 'NOT_FOUND');
  }

  if (acceptedJob.status !== 'Completed') {
    throw new ApiError(400, 'Can only rate completed jobs', 'JOB_NOT_COMPLETED');
  }

  const isEmployer = acceptedJob.employerId._id.toString() === req.user._id.toString();
  const isWorker = acceptedJob.workerId._id.toString() === req.user._id.toString();

  if (!isEmployer && !isWorker) {
    throw new ApiError(403, 'Not authorized to rate this job', 'NOT_AUTHORIZED');
  }

  if (isEmployer) {
    if (acceptedJob.employerRating?.rating) {
      throw new ApiError(400, 'You have already rated this job', 'ALREADY_RATED');
    }
    acceptedJob.employerRating = { rating, review: review || '', ratedAt: new Date() };
    await acceptedJob.workerId.updateRating(rating);
  } else {
    if (acceptedJob.workerRating?.rating) {
      throw new ApiError(400, 'You have already rated this job', 'ALREADY_RATED');
    }
    acceptedJob.workerRating = { rating, review: review || '', ratedAt: new Date() };
    await acceptedJob.employerId.updateRating(rating);
  }

  await acceptedJob.save();

  res.status(200).json({
    success: true,
    message: 'Rating submitted successfully',
    data: { acceptedJob },
  });
});

module.exports = {
  applyForJob,
  getMyApplications,
  handleApplication,
  withdrawApplication,
  getAcceptedJobs,
  getIncomingRequests,
  completeJob,
  rateJob,
};