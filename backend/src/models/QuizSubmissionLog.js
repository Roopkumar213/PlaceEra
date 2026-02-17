const mongoose = require('mongoose');

const quizSubmissionLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    submissionId: {
        type: String,
        required: true
    },
    topicId: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        expires: '30d' // Auto-delete after 30 days, we only need recent history for idempotency mainly
    },
    resultSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: {} // Store the response to replay it
    }
}, {
    timestamps: true
});

// Unique Compound Index for Idempotency
quizSubmissionLogSchema.index({ userId: 1, submissionId: 1 }, { unique: true });

module.exports = mongoose.model('QuizSubmissionLog', quizSubmissionLogSchema);
