/**
 * Model Index
 * Central export for all models
 */

const User = require('./User');
const Job = require('./Job');
const JobApplication = require('./JobApplication');
const AcceptedJob = require('./AcceptedJob');
const SkillPost = require('./SkillPost');

module.exports = {
  User,
  Job,
  JobApplication,
  AcceptedJob,
  SkillPost,
};
