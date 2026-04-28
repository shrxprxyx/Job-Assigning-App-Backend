/**
 * User Model
 */

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // Phone number — primary identity
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },

  name: {
    type: String,
    trim: true,
    maxlength: 100,
  },

  age: {
    type: Number,
    min: 13,
    max: 120,
  },

  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: null,
  },

  profileImage: {
    type: String,
    default: null,
  },

  skills: [{
    type: String,
    trim: true,
  }],

  currentMode: {
    type: String,
    enum: ['employer', 'worker'],
    default: 'worker',
  },

  availability: {
    isAvailable: {
      type: Boolean,
      default: true,
    },
    schedule: {
      type: String,
      default: 'Anytime',
    },
  },

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

  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    count: {
      type: Number,
      default: 0,
    },
  },

  isProfileComplete: {
    type: Boolean,
    default: false,
  },

  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.index({ location: '2dsphere' });
UserSchema.index({ skills: 1, 'availability.isAvailable': 1 });

UserSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  this.isProfileComplete = !!(
    this.name &&
    this.gender &&
    this.skills &&
    this.skills.length > 0
  );

  next();
});

UserSchema.virtual('displayName').get(function () {
  return this.name || `User ${this.phone.slice(-4)}`;
});

UserSchema.methods.updateRating = async function (newRating) {
  const total = this.rating.count * this.rating.average;
  this.rating.count += 1;
  this.rating.average = (total + newRating) / this.rating.count;
  await this.save();
};

UserSchema.methods.toggleAvailability = async function () {
  this.availability.isAvailable = !this.availability.isAvailable;
  await this.save();
  return this.availability.isAvailable;
};

UserSchema.statics.findNearbyWorkers = async function (
  coordinates,
  maxDistance = 5000,
  skills = []
) {
  const query = {
    currentMode: 'worker',
    'availability.isAvailable': true,
    status: 'active',
  };

  if (coordinates && coordinates.length === 2) {
    query.location = {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: maxDistance,
      },
    };
  }

  if (skills.length > 0) {
    query.skills = { $in: skills };
  }

  return this.find(query).limit(50);
};

UserSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);