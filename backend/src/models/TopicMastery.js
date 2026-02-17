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
        type: Date,
        default: Date.now
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
    }
}, {
    timestamps: true
});

// Compound index for quick lookup
topicMasterySchema.index({ userId: 1, topic: 1 }, { unique: true });
topicMasterySchema.index({ userId: 1, subject: 1 }); // For subject aggregation

module.exports = mongoose.model('TopicMastery', topicMasterySchema);
