const mongoose = require('mongoose');

const DailyConceptSchema = new mongoose.Schema({
    topic: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        required: true
    },
    summary: {
        type: String,
        required: true,
        minlength: 50
    },
    explanation: {
        type: String,
        required: true,
        minlength: 200
    },
    codeExample: {
        language: {
            type: String,
            required: true
        },
        code: {
            type: String,
            required: true
        }
    },
    quiz: [{
        question: {
            type: String,
            required: true
        },
        options: {
            type: [String],
            required: true,
            validate: [arrayLimit, '{PATH} must have exactly 4 options']
        },
        correctAnswer: {
            type: String,
            required: true
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

function arrayLimit(val) {
    return val.length === 4;
}

module.exports = mongoose.model('DailyConcept', DailyConceptSchema);
