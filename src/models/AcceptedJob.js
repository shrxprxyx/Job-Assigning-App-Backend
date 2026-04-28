/**
 * AcceptedJob Model
 * Stores jobs that have been accepted and are in progress
 */

const mongoose = require('mongoose');

const AcceptedJobSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job reference is required'],
    unique: true, // Each job can only be accepted once
    index: true,
  },

  // Reference to the accepted worker
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Worker reference is required'],
    index: true,
  },

  // Reference to the employer
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employer reference is required'],
    index: true,
  },

  // When the job was accepted
  acceptedAt: {
    type: Date,
    default: Date.now,
  },

  // Job progress status
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Cancelled', 'Disputed'],
    default: 'Active',
    index: true,
  },

  // When the job was completed (if applicable)
  completedAt: {
    type: Date,
    default: null,
  },

  // When the job was cancelled (if applicable)
  cancelledAt: {
    type: Date,
    default: null,
  },

  // Cancellation reason (if cancelled)
  cancellationReason: {
    type: String,
    maxlength: 500,
  },

  // Who cancelled (employer/worker)
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  // Chat room ID for real-time communication
  chatRoomId: {
    type: String,
    default: function() {
      return `chat_${this.jobId}_${Date.now()}`;
    },
  },

  // Rating given by employer to worker
  employerRating: {
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, maxlength: 500 },
    ratedAt: { type: Date },
  },

  // Rating given by worker to employer
  workerRating: {
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, maxlength: 500 },
    ratedAt: { type: Date },
  },

  // Timestamps
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
AcceptedJobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  if (this.isModified('status')) {
    if (this.status === 'Completed') {
      this.completedAt = new Date();
    } else if (this.status === 'Cancelled') {
      this.cancelledAt = new Date();
    }
  }
  
  next();
});

// Static method to get worker's active jobs
AcceptedJobSchema.statics.getWorkerActiveJobs = async function(workerId) {
  return this.find({ 
    workerId, 
    status: { $in: ['Active'] } 
  })
    .populate('jobId')
    .populate('employerId', 'name phone rating')
    .sort({ acceptedAt: -1 });
};

// Static method to get employer's active jobs
AcceptedJobSchema.statics.getEmployerActiveJobs = async function(employerId) {
  return this.find({ 
    employerId, 
    status: { $in: ['Active'] } 
  })
    .populate('jobId')
    .populate('workerId', 'name phone rating skills profileImage')
    .sort({ acceptedAt: -1 });
};

// Static method to get job history
AcceptedJobSchema.statics.getJobHistory = async function(userId) {
  return this.find({
    $or: [{ workerId: userId }, { employerId: userId }],
    status: { $in: ['Completed', 'Cancelled'] },
  })
    .populate('jobId')
    .populate('workerId', 'name rating')
    .populate('employerId', 'name rating')
    .sort({ completedAt: -1, cancelledAt: -1 })
    .limit(50);
};

// Transform output
AcceptedJobSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('AcceptedJob', AcceptedJobSchema);
