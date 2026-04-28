/**
 * Job Controller
 * Handles job creation, listing, and management
 */

const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const AcceptedJob = require('../models/AcceptedJob');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @desc    Create a new job
 * @route   POST /api/v1/jobs
 * @access  Private (Employer)
 */
const createJob = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    startTime,
    payment,
    locationText,
    locationGeo,
    totalTime,
    requiredSkills,
    maxWorkers,
  } = req.body;

  const job = await Job.create({
    title,
    description,
    startTime,
    payment,
    locationText,
    locationGeo: locationGeo || { lat: null, lng: null },
    totalTime,
    requiredSkills: requiredSkills || [],
    maxWorkers: maxWorkers || 1,
    createdBy: req.user._id,
  });

  // Populate creator info
  await job.populate('createdBy', 'name phone rating');

  res.status(201).json({
    success: true,
    message: 'Job created successfully',
    data: { job },
  });
});

/**
 * @desc    Get all jobs created by current user (employer)
 * @route   GET /api/v1/jobs/my-jobs
 * @access  Private
 */
const getMyJobs = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = { createdBy: req.user._id };

  if (status) {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const jobs = await Job.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Job.countDocuments(query);

  res.status(200).json({
    success: true,
    count: jobs.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: { jobs },
  });
});

/**
 * @desc    Get available jobs (for workers)
 * @route   GET /api/v1/jobs/available
 * @access  Private
 */
const getAvailableJobs = asyncHandler(async (req, res) => {
  const { latitude, longitude, maxDistance, skills, page = 1, limit = 20 } = req.query;

  let coordinates = null;
  if (latitude && longitude) {
    coordinates = [parseFloat(longitude), parseFloat(latitude)];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let query = {
    status: 'Open',
    createdBy: { $ne: req.user._id }, // Don't show own jobs
  };

  // Filter by skills if provided
  if (skills) {
    const skillsArray = skills.split(',').map((s) => s.trim());
    query.requiredSkills = { $in: skillsArray };
  }

  let jobsQuery = Job.find(query)
    .populate('createdBy', 'name phone rating profileImage')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Add geospatial filtering if coordinates provided
  if (coordinates) {
    const distance = parseInt(maxDistance) || 10000;
    query.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates,
        },
        $maxDistance: distance,
      },
    };
    jobsQuery = Job.find(query)
      .populate('createdBy', 'name phone rating profileImage')
      .limit(parseInt(limit));
  }

  const jobs = await jobsQuery;

  // Check if current user has applied to each job
  const jobIds = jobs.map((j) => j._id);
  const applications = await JobApplication.find({
    jobId: { $in: jobIds },
    applicantId: req.user._id,
  });
  
  const appliedJobIds = new Set(applications.map((a) => a.jobId.toString()));

  const jobsWithApplyStatus = jobs.map((job) => ({
    ...job.toJSON(),
    hasApplied: appliedJobIds.has(job._id.toString()),
    applicationStatus: applications.find(
      (a) => a.jobId.toString() === job._id.toString()
    )?.status,
  }));

  res.status(200).json({
    success: true,
    count: jobs.length,
    data: { jobs: jobsWithApplyStatus },
  });
});

/**
 * @desc    Get job by ID
 * @route   GET /api/v1/jobs/:jobId
 * @access  Private
 */
const getJobById = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const job = await Job.findById(jobId)
    .populate('createdBy', 'name phone rating profileImage');

  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }

  // Check if current user has applied
  let applicationStatus = null;
  if (req.user) {
    const application = await JobApplication.findOne({
      jobId,
      applicantId: req.user._id,
    });
    if (application) {
      applicationStatus = application.status;
    }
  }

  // Check if job is accepted
  const acceptedJob = await AcceptedJob.findOne({ jobId })
    .populate('workerId', 'name phone rating');

  res.status(200).json({
    success: true,
    data: {
      job: {
        ...job.toJSON(),
        applicationStatus,
        acceptedWorker: acceptedJob?.workerId || null,
        isAccepted: !!acceptedJob,
      },
    },
  });
});

/**
 * @desc    Update job
 * @route   PUT /api/v1/jobs/:jobId
 * @access  Private (Owner only)
 */
const updateJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  let job = await Job.findById(jobId);

  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }

  if (job.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to update this job', 'NOT_AUTHORIZED');
  }

  // Check if job can be updated
  if (job.status === 'Closed' || job.status === 'Completed') {
    throw new ApiError(400, 'Cannot update closed or completed job', 'JOB_NOT_EDITABLE');
  }

  const allowedUpdates = [
    'title',
    'description',
    'startTime',
    'payment',
    'locationText',
    'locationGeo',
    'totalTime',
    'requiredSkills',
    'maxWorkers',
  ];

  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  job = await Job.findByIdAndUpdate(
    jobId,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('createdBy', 'name phone rating');

  res.status(200).json({
    success: true,
    message: 'Job updated successfully',
    data: { job },
  });
});

/**
 * @desc    Cancel job
 * @route   PUT /api/v1/jobs/:jobId/cancel
 * @access  Private (Owner only)
 */
const cancelJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  let job = await Job.findById(jobId);

  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }

  // Check ownership
  if (job.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to cancel this job', 'NOT_AUTHORIZED');
  }

  if (job.status === 'Cancelled') {
    throw new ApiError(400, 'Job is already cancelled', 'ALREADY_CANCELLED');
  }

  job.status = 'Cancelled';
  job.closedAt = new Date();
  await job.save();

  // Reject all pending applications
  await JobApplication.updateMany(
    { jobId, status: 'Applied' },
    { $set: { status: 'Rejected' } }
  );

  // Cancel accepted job if exists
  await AcceptedJob.updateMany(
    { jobId, status: 'Active' },
    { 
      $set: { 
        status: 'Cancelled',
        cancelledBy: req.user._id,
        cancellationReason: 'Job cancelled by employer',
      } 
    }
  );

  res.status(200).json({
    success: true,
    message: 'Job cancelled successfully',
    data: { job },
  });
});

/**
 * @desc    Close job
 * @route   PUT /api/v1/jobs/:jobId/close
 * @access  Private (Owner only)
 */
const closeJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  let job = await Job.findById(jobId);

  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }

  if (job.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to close this job', 'NOT_AUTHORIZED');
  }

  job.status = 'Closed';
  job.closedAt = new Date();
  await job.save();

  // Reject all pending applications
  await JobApplication.updateMany(
    { jobId, status: 'Applied' },
    { $set: { status: 'Rejected' } }
  );

  res.status(200).json({
    success: true,
    message: 'Job closed successfully',
    data: { job },
  });
});

/**
 * @desc    Get job applicants
 * @route   GET /api/v1/jobs/:jobId/applicants
 * @access  Private (Owner only)
 */
const getJobApplicants = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const job = await Job.findById(jobId);

  if (!job) {
    throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');
  }

  if (job.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to view applicants', 'NOT_AUTHORIZED');
  }

  const applications = await JobApplication.find({ jobId })
    .populate('applicantId', 'name phone skills rating profileImage availability')
    .sort({ appliedAt: -1 });

  res.status(200).json({
    success: true,
    count: applications.length,
    data: { applications },
  });
});

module.exports = {
  createJob,
  getMyJobs,
  getAvailableJobs,
  getJobById,
  updateJob,
  cancelJob,
  closeJob,
  getJobApplicants,
};
