const mongoose = require('mongoose');

const subjectMasterySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    subject: {
        type: String,
        required: true
    },
    averageMastery: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    totalTopics: {
        type: Number,
        default: 0
    },
    masteredTopics: { // Count of topics > 90 mastery
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

subjectMasterySchema.index({ userId: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('SubjectMastery', subjectMasterySchema);
