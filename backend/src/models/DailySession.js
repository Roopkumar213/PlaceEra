const mongoose = require('mongoose');

const codingQuestionSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    testCases: [{
        input: { type: String },
        output: { type: String }
    }]
});

const mcqSchema = new mongoose.Schema({
    id: { type: String, required: true },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: String, required: true }
});

const dailySessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dateString: { type: String, required: true }, // e.g., '2023-10-25' in user timezone
    cluster: { type: String, required: true },
    topic: { type: String, required: true },
    reason: { type: String, required: true },
    streakMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    behavioralState: { type: String },
    expiresAt: { type: Date, required: true, expires: 0 }, // Document automatically expires when the day completes in UTC or later
    questions: [mcqSchema],
    codingQuestions: [codingQuestionSchema]
}, { timestamps: true });

// Prevent duplicate session generation per user per day string
dailySessionSchema.index({ userId: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model('DailySession', dailySessionSchema);
