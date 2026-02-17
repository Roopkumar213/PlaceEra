const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DailyConcept',
        required: true
    },
    completedAt: {
        type: Date,
        default: Date.now
    },
    quizScore: {
        type: Number,
        required: true
    },
    quizTotal: {
        type: Number,
        required: true
    },
    timeSpent: {
        type: Number, // in seconds
        default: 0
    },
    completedDate: {
        // Normalized date string (YYYY-MM-DD) for easier streak calculation
        type: String,
        required: true,
        index: true
    }
}, {
    timestamps: true
});

// Compound index just in case we need to query a specific lesson for a user quickly
userProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model('UserProgress', userProgressSchema);
