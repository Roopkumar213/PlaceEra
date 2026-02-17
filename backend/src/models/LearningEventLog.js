const mongoose = require('mongoose');

const learningEventLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    topicId: {
        type: String, // Storing as String to match TopicMastery usage, or could be ObjectId if we had a Topic model
        required: true,
        index: true
    },
    subject: {
        type: String,
        required: true
    },
    eventType: {
        type: String,
        enum: ['QUIZ_SUBMIT', 'DECAY_APPLIED', 'REVISION_TRIGGERED', 'ROTATION_SELECTED'],
        required: true
    },
    previousMastery: {
        type: Number,
        required: true
    },
    newMastery: {
        type: Number,
        required: true
    },
    delta: {
        type: Number,
        required: true
    },
    trendDirection: {
        type: String,
        default: 'unknown'
    },
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Composite index for time-series queries per user
learningEventLogSchema.index({ userId: 1, timestamp: -1 });
// TTL Index: Expire logs after 90 days (7776000 seconds)
learningEventLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('LearningEventLog', learningEventLogSchema);
