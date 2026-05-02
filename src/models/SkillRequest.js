/**
 * SkillRequest Model
 * Stores requests made on skill posts
 */

const mongoose = require('mongoose');

const SkillRequestSchema = new mongoose.Schema({
  skillPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SkillPost',
    required: true,
    index: true,
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    default: '',
    maxlength: 500,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  chatRoomId: {
  type: String,
  default: null,
 },
});

SkillRequestSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('SkillRequest', SkillRequestSchema);