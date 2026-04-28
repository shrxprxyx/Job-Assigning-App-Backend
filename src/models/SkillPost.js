/**
 * SkillPost Model
 * Stores skill posts where users advertise their skills
 */

const mongoose = require('mongoose');

const SkillPostSchema = new mongoose.Schema({
  // Reference to the user posting their skill
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true,
  },

  // Skill title/name
  skill: {
    type: String,
    required: [true, 'Skill name is required'],
    trim: true,
    maxlength: 100,
  },

  // Detailed description
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: 1000,
  },

  // Photo/image for the skill post
  photo: {
    type: String,
    default: null,
  },

  // Price range or hourly rate
  priceRange: {
    type: String,
    trim: true,
  },

  // Availability
  availability: {
    type: String,
    default: 'Available',
  },

  // Category for filtering
  category: {
    type: String,
    trim: true,
  },

  // Location (for local skill matching)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
    text: {
      type: String,
      default: '',
    },
  },

  // Post status
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Deleted'],
    default: 'Active',
    index: true,
  },

  // View count
  views: {
    type: Number,
    default: 0,
  },

  // Number of job requests received through this post
  requestCount: {
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
});

// Create 2dsphere index for geospatial queries
SkillPostSchema.index({ location: '2dsphere' });

// Full-text search index
SkillPostSchema.index({ skill: 'text', description: 'text' });

// Update timestamp on save
SkillPostSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to search skill posts
SkillPostSchema.statics.searchPosts = async function(query, filters = {}) {
  const searchQuery = {
    status: 'Active',
  };

  if (query) {
    searchQuery.$text = { $search: query };
  }

  if (filters.category) {
    searchQuery.category = filters.category;
  }

  return this.find(searchQuery)
    .populate('userId', 'name phone rating profileImage')
    .sort({ createdAt: -1 })
    .limit(50);
};

// Static method to get user's skill posts
SkillPostSchema.statics.getUserPosts = async function(userId) {
  return this.find({ userId, status: { $ne: 'Deleted' } })
    .sort({ createdAt: -1 });
};

// Method to increment view count
SkillPostSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save();
};

// Transform output
SkillPostSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('SkillPost', SkillPostSchema);
