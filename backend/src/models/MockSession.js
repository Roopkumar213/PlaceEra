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
        questionIndex: Number, // Index within DailyConcept.quiz
        questionText: String,
        options: [String],
        correctAnswer: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('MockSession', MockSessionSchema);
