const mongoose = require('mongoose');

const MockSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    durationMinutes: {
        type: Number
    },
    questionCount: {
        type: Number,
        required: true
    },
    score: {
        type: Number, // Total score percentage 0-100
        default: 0
    },
    subjectBreakdown: {
        type: Map,
        of: {
            correct: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
            score: { type: Number, default: 0 }
        }
    },
    performanceDelta: {
        type: Number // Overall mastery change
    },
    // V2 Analytics Fields
    difficultyBreakdown: {
        type: Map,
        of: {
            correct: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
            score: { type: Number, default: 0 }
        },
        default: {}
    },
    weakestTopic: {
        topic: { type: String },
        subject: { type: String },
        score: { type: Number }
    },
    percentile: {
        type: Number,   // 0-100, vs user's own history
        default: null
    },
    // Adaptive config recorded so we can explain the session to the user
    adaptiveConfig: {
        difficultyProfile: { type: String },   // e.g. "EASY_HEAVY" | "MIXED" | "HARD_HEAVY"
        timeLimitMinutes: { type: Number },
        subjectWeights: { type: mongoose.Schema.Types.Mixed }
    },
    status: {
        type: String,
        enum: ['IN_PROGRESS', 'COMPLETED'],
        default: 'IN_PROGRESS'
    },
    // Store question metadata to avoid N+1 and handle submission correctly
    selectedQuestions: [{
        conceptId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyConcept' },
        topic: String,
        subject: String,
        questionIndex: Number,
        questionText: String,
        options: [String],
        correctAnswer: String,
        difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' }
    }]
}, { timestamps: true });

module.exports = mongoose.model('MockSession', MockSessionSchema);
