const mongoose = require('mongoose');

const topicMasterySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    topic: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    mastery: { // Renamed from proficiency for Phase 3
        type: Number, // 0 to 100
        default: 0,
        min: 0,
        max: 100
    },
    totalAttempts: {
        type: Number,
        default: 0
    },
    correctAttempts: {
        type: Number,
        default: 0
    },
    lastAttemptAt: { // Formerly lastPracticedAt
        type: Date
    },
    // Phase 3 New Fields
    averageScore: {
        type: Number,
        default: 0
    },
    lastScores: {
        type: [Number], // Store last 5 scores for trend analysis
        default: []
    },
    trendDirection: {
        type: String,
        enum: ['improving', 'declining', 'stable', 'volatile', 'unknown'],
        default: 'unknown'
    },
    failureCount: {
        type: Number,
        default: 0
    },
    successStreak: {
        type: Number,
        default: 0
    },
    confidenceScore: {
        type: Number, // 0 to 1. 1 means high confidence in the mastery score.
        default: 0
    },
    // Day 1 Experience Intelligence Fields
    unlocked: {
        type: Boolean,
        default: false
    },
    recommended: {
        type: Boolean,
        default: false
    },
    decayLocked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound index for quick lookup
topicMasterySchema.index({ userId: 1, topic: 1 }, { unique: true });
topicMasterySchema.index({ userId: 1, subject: 1 });
topicMasterySchema.index({ userId: 1, recommended: 1 }); // For Home page card
topicMasterySchema.index({ userId: 1, unlocked: 1 });
// Performance indexes for Decay Job and Analytics
topicMasterySchema.index({ mastery: 1 });
topicMasterySchema.index({ lastAttemptAt: 1 }); // Needed for Decay Job
topicMasterySchema.index({ userId: 1, mastery: 1 }); // Useful for Daily Rotation Analysis

module.exports = mongoose.model('TopicMastery', topicMasterySchema);
