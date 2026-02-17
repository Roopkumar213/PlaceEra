const mongoose = require('mongoose');

const weeklyProgressSnapshotSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    weekStartDate: {
        type: Date,
        required: true
    },
    averageScore: {
        type: Number,
        default: 0
    },
    readinessScore: {
        type: Number,
        default: 0
    },
    quizzesCompleted: {
        type: Number,
        default: 0
    },
    streak: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Ensure unique snapshot per week per user
weeklyProgressSnapshotSchema.index({ userId: 1, weekStartDate: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyProgressSnapshot', weeklyProgressSnapshotSchema);
