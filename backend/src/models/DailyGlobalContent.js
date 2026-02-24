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

const dailyGlobalContentSchema = new mongoose.Schema({
    dateKey: { type: String, required: true, unique: true }, // e.g., '2023-10-25' in UTC
    clusterId: { type: String, required: true },
    topicId: { type: String, required: true },
    questions: [mcqSchema],
    codingQuestions: [codingQuestionSchema],
    generatedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('DailyGlobalContent', dailyGlobalContentSchema);
