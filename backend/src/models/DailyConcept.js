
const mongoose = require('mongoose');

const DailyConceptSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        unique: true,
        index: true // ensure index for faster lookups by date
    },
    subject: {
        type: String, // e.g. "DSA", "Backend", "Aptitude"
        required: true
    },
    topic: {
        type: String, // e.g. "Arrays", "REST API"
        required: true
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
    },
    summary: {
        type: String,
        required: true
    },
    explanation: {
        type: String,
        required: true
    },
    codeExample: {
        language: String, // "javascript", "python"
        code: String
    },
    quiz: [
        {
            question: { type: String, required: true },
            options: [{ type: String, required: true }],
            correctAnswer: { type: String, required: true }
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('DailyConcept', DailyConceptSchema);
