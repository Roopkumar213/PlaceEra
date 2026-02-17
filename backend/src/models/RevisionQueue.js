const mongoose = require('mongoose');

const revisionQueueSchema = new mongoose.Schema({
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
    priorityScore: {
        type: Number,
        required: true
    },
    scheduledFor: {
        type: Date, // When this revision becomes active
        required: true,
        index: true
    },
    reason: {
        type: String, // 'failure_recovery', 'mastery_verification', 'forced_resuracing'
        default: 'failure_recovery'
    },
    resolved: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

revisionQueueSchema.index({ userId: 1, resolved: 1, scheduledFor: 1 });

module.exports = mongoose.model('RevisionQueue', revisionQueueSchema);
