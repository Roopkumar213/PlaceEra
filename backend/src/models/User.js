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
  lastActiveDate: { type: Date, default: null },
  behavioralState: {
    type: String,
    enum: ['OPTIMAL', 'PLATEAU', 'OVERLOAD', 'COLD_START'],
    default: 'OPTIMAL'
  },
  behavioralMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
  onboardingComplete: { type: Boolean, default: false },
  lastNotificationDate: { type: Date },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, { timestamps: true });

// Email index is automatically created by unique: true

module.exports = mongoose.model('User', UserSchema);
