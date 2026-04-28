/**
 * Job Model
 * Stores job postings created by employers
 */

const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  // Job title
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },

  // Detailed job description
  description: {
    type: String,
    required: [true, 'Job description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },

  // When the job starts 
  startTime: {
    type: String,
    trim: true,
  },

  // Payment amount 
  payment: {
    type: String,
    required: [true, 'Payment information is required'],
    trim: true,
  },

  // Location as text 
  locationText: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
  },

  // Location as coordinates for geospatial queries
  locationGeo: {
    lat: {
      type: Number,
      default: null,
    },
    lng: {
      type: Number,
      default: null,
    },
  },

  // GeoJSON format for MongoDB geospatial queries
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },

  // Estimated total time for the job
  totalTime: {
    type: String,
    trim: true,
  },

  // Job status
  status: {
    type: String,
    enum: ['Open', 'Closed', 'Cancelled', 'InProgress', 'Completed'],
    default: 'Open',
    index: true,
  },


  // Reference to the employer who created this job
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Job must have a creator'],
    index: true,
  },

  // Number of applicants
  applicantCount: {
    type: Number,
    default: 0,
  },


  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },

  // When the job was closed/completed
  closedAt: {
    type: Date,
    default: null,
  },
});

// Create 2dsphere index for geospatial queries
JobSchema.index({ location: '2dsphere' });

// Compound index for common queries
JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ createdBy: 1, status: 1 });

// Update timestamps and sync locationGeo with location
JobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Sync locationGeo with location coordinates
  if (this.locationGeo && this.locationGeo.lat && this.locationGeo.lng) {
    this.location.coordinates = [this.locationGeo.lng, this.locationGeo.lat];
  }
  
  next();
});

// Static method to find nearby jobs
JobSchema.statics.findNearbyJobs = async function(coordinates, maxDistance = 10000) {
  if (!coordinates || coordinates.length !== 2) {
    return this.find({ status: 'Open' })
      .populate('createdBy', 'name phone rating')
      .sort({ createdAt: -1 })
      .limit(50);
  }

  return this.find({
    status: 'Open',
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates,
        },
        $maxDistance: maxDistance,
      },
    },
  })
    .populate('createdBy', 'name phone rating')
    .limit(50);
};

// Static method to get jobs by employer
JobSchema.statics.getEmployerJobs = async function(employerId) {
  return this.find({ createdBy: employerId })
    .sort({ createdAt: -1 });
};

// Transform output
JobSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Job', JobSchema);
