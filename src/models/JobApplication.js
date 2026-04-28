/**
 * JobApplication Model
 * Stores job applications from workers
 */

const mongoose = require('mongoose');

const JobApplicationSchema = new mongoose.Schema({
  // Reference to the job being applied for
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job reference is required'],
    index: true,
  },

  // Reference to the worker applying
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Applicant reference is required'],
    index: true,
  },

  // Application status
  status: {
    type: String,
    enum: ['Applied', 'Accepted', 'Rejected', 'Withdrawn'],
    default: 'Applied',
    index: true,
  },

  // Optional cover message from applicant
  message: {
    type: String,
    maxlength: 500,
    trim: true,
  },

  // When the application was submitted
  appliedAt: {
    type: Date,
    default: Date.now,
  },

  // When the status was last updated
  updatedAt: {
    type: Date,
    default: Date.now,
  },

  // When the application was accepted (if applicable)
  acceptedAt: {
    type: Date,
    default: null,
  },

  // When the application was rejected 
  rejectedAt: {
    type: Date,
    default: null,
  },
});

// Compound unique index to prevent duplicate applications
JobApplicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });

// Update timestamp on status change
JobApplicationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  if (this.isModified('status')) {
    if (this.status === 'Accepted') {
      this.acceptedAt = new Date();
    } else if (this.status === 'Rejected') {
      this.rejectedAt = new Date();
    }
  }
  
  next();
});

// Static method to get applications for a job
JobApplicationSchema.statics.getJobApplications = async function(jobId) {
  return this.find({ jobId })
    .populate('applicantId', 'name phone skills rating profileImage')
    .sort({ appliedAt: -1 });
};

// Static method to get user's applications
JobApplicationSchema.statics.getUserApplications = async function(userId) {
  return this.find({ applicantId: userId })
    .populate('jobId')
    .sort({ appliedAt: -1 });
};

// Static method to check if user has already applied
JobApplicationSchema.statics.hasApplied = async function(jobId, applicantId) {
  const application = await this.findOne({ jobId, applicantId });
  return !!application;
};

// Transform output
JobApplicationSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('JobApplication', JobApplicationSchema);
