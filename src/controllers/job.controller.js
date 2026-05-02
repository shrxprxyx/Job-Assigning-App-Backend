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
    locationGeo,       // { lat, lng } from frontend
    totalTime,
    requiredSkills,
    maxWorkers,
  } = req.body;

  // Build GeoJSON location so $near queries work
  let location = undefined;
  if (locationGeo?.lat != null && locationGeo?.lng != null) {
    location = {
      type: 'Point',
      coordinates: [parseFloat(locationGeo.lng), parseFloat(locationGeo.lat)],
    };
  }

  const job = await Job.create({
    title,
    description,
    startTime,
    payment,
    locationText,
    locationGeo: locationGeo || { lat: null, lng: null },
    location,          // GeoJSON field for geospatial queries
    totalTime,
    requiredSkills: requiredSkills || [],
    maxWorkers: maxWorkers || 1,
    createdBy: req.user._id,
  });

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
  if (status) query.status = status;

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
 * @desc    Get available jobs (for workers) — filtered by city/location
 * @route   GET /api/v1/jobs/available
 * @access  Private
 *
 * Query params:
 *   latitude, longitude  — worker's current coordinates (required for geo filter)
 *   maxDistance          — metres, default 20000 (20 km = same city roughly)
 *   sortBy               — 'recent' | 'nearby' | 'payment'  (default: 'nearby' when coords given, else 'recent')
 *   skills               — comma-separated skill filter
 *   page, limit
 */
const getAvailableJobs = asyncHandler(async (req, res) => {
  const {
    latitude,
    longitude,
    maxDistance = 20000,   // 20 km — keeps results within same city
    skills,
    sortBy,
    page = 1,
    limit = 20,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const hasCoords = latitude != null && longitude != null;
  const coords = hasCoords
    ? [parseFloat(longitude), parseFloat(latitude)]
    : null;

  // ── Base filter ──────────────────────────────────────────────
  const query = {
    status: 'Open',
    createdBy: { $ne: req.user._id },
  };

  if (skills) {
    const skillsArray = skills.split(',').map((s) => s.trim());
    query.requiredSkills = { $in: skillsArray };
  }

  // ── Geospatial filter (same city) ────────────────────────────
  // When the worker shares their location we restrict results to
  // jobs within maxDistance metres. This naturally limits to the
  // same city without needing to parse city names.
  if (coords) {
    query.location = {
      $near: {
        $geometry: { type: 'Point', coordinates: coords },
        $maxDistance: parseInt(maxDistance),
      },
    };
  }

  // ── Sorting ───────────────────────────────────────────────────
  // $near already returns results sorted nearest-first, so when
  // sortBy is 'nearby' (or defaulted) we skip the extra .sort().
  // For 'payment' we do an in-memory sort after fetch because
  // payment is a freetext field (e.g. "₹500/hr") — could be
  // converted to numeric if schema changes.
  const effectiveSort = sortBy || (coords ? 'nearby' : 'recent');

  let jobsQuery = Job.find(query)
    .populate('createdBy', 'name phone rating profileImage');

  if (effectiveSort === 'recent') {
    jobsQuery = jobsQuery.sort({ createdAt: -1 });
  }
  // 'nearby' — $near already sorted; don't add another .sort()
  // 'payment' — handled below after fetch

  jobsQuery = jobsQuery.skip(skip).limit(parseInt(limit));

  let jobs = await jobsQuery;

  // Payment sort: parse leading digits from the payment string
  if (effectiveSort === 'payment') {
    jobs = jobs.sort((a, b) => {
      const parse = (str) => parseInt((str || '0').replace(/\D/g, '')) || 0;
      return parse(b.payment) - parse(a.payment);   // highest pay first
    });
  }

  // ── Apply-status enrichment ───────────────────────────────────
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
 * @desc    Get job applicants with optional sorting
 * @route   GET /api/v1/jobs/:jobId/applicants
 * @access  Private (Owner only)
 *
 * Query params:
 *   sortBy  — 'recent' | 'nearby' | 'rating'
 *   latitude, longitude  — employer's coords (needed for 'nearby' sort)
 */
const getJobApplicants = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { sortBy = 'recent', latitude, longitude } = req.query;

  const job = await Job.findById(jobId);
  if (!job) throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');

  if (job.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to view applicants', 'NOT_AUTHORIZED');
  }

  const applications = await JobApplication.find({ jobId })
    .populate('applicantId', 'name phone skills rating profileImage availability location')
    .sort({ appliedAt: -1 });

  let sorted = [...applications];

  if (sortBy === 'nearby' && latitude && longitude) {
    const workerLat = parseFloat(latitude);
    const workerLng = parseFloat(longitude);

    // Haversine distance in km
    const dist = (lat1, lng1, lat2, lng2) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    sorted = sorted.sort((a, b) => {
      const aC = a.applicantId?.location?.coordinates;  // [lng, lat]
      const bC = b.applicantId?.location?.coordinates;
      if (!aC || !bC) return 0;
      const dA = dist(workerLat, workerLng, aC[1], aC[0]);
      const dB = dist(workerLat, workerLng, bC[1], bC[0]);
      return dA - dB;
    });
  } else if (sortBy === 'rating') {
    sorted = sorted.sort(
      (a, b) =>
        (b.applicantId?.rating?.average || 0) -
        (a.applicantId?.rating?.average || 0)
    );
  }
  // 'recent' is already the default sort from the query

  res.status(200).json({
    success: true,
    count: sorted.length,
    data: { applications: sorted },
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

  if (!job) throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');

  let applicationStatus = null;
  const application = await JobApplication.findOne({
    jobId,
    applicantId: req.user._id,
  });
  if (application) applicationStatus = application.status;

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
  if (!job) throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');

  if (job.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to update this job', 'NOT_AUTHORIZED');
  }

  if (['Closed', 'Completed'].includes(job.status)) {
    throw new ApiError(400, 'Cannot update closed or completed job', 'JOB_NOT_EDITABLE');
  }

  const allowedUpdates = [
    'title', 'description', 'startTime', 'payment',
    'locationText', 'locationGeo', 'totalTime', 'requiredSkills', 'maxWorkers',
  ];

  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  // Keep GeoJSON location in sync when locationGeo is updated
  if (updates.locationGeo?.lat != null && updates.locationGeo?.lng != null) {
    updates.location = {
      type: 'Point',
      coordinates: [parseFloat(updates.locationGeo.lng), parseFloat(updates.locationGeo.lat)],
    };
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
  if (!job) throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');

  if (job.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to cancel this job', 'NOT_AUTHORIZED');
  }

  if (job.status === 'Cancelled') {
    throw new ApiError(400, 'Job is already cancelled', 'ALREADY_CANCELLED');
  }

  job.status = 'Cancelled';
  job.closedAt = new Date();
  await job.save();

  await JobApplication.updateMany(
    { jobId, status: 'Applied' },
    { $set: { status: 'Rejected' } }
  );

  await AcceptedJob.updateMany(
    { jobId, status: 'Active' },
    {
      $set: {
        status: 'Cancelled',
        cancelledBy: req.user._id,
        cancellationReason: 'Job cancelled by employer',
      },
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
  if (!job) throw new ApiError(404, 'Job not found', 'JOB_NOT_FOUND');

  if (job.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to close this job', 'NOT_AUTHORIZED');
  }

  job.status = 'Closed';
  job.closedAt = new Date();
  await job.save();

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