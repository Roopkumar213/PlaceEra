const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  timezone: { type: String, default: 'UTC' },
  preferredTimes: { type: [String], default: [] },
  onceOrTwice: { type: String, enum: ['once', 'twice'], default: 'once' },
  emailEnabled: { type: Boolean, default: true },
  pushEnabled: { type: Boolean, default: true },
  streak: { type: Number, default: 0 },
  lastNotificationDate: { type: Date },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, { timestamps: true });

UserSchema.index({ email: 1 });

module.exports = mongoose.model('User', UserSchema);
