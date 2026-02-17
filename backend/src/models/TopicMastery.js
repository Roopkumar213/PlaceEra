const mongoose = require('mongoose');

const topicMasterySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    topic: {
        type: String, // e.g., "Dynamic Programming", "Graph Theory"
        required: true
    },
    subTopic: {
        type: String // Optional refinement
    },
    proficiency: {
        type: Number, // 0 to 100
        default: 0
    },
    totalAttempts: {
        type: Number,
        default: 0
    },
    correctAttempts: {
        type: Number,
        default: 0
    },
    lastAttemptAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for quick lookup of specific topic for a user
topicMasterySchema.index({ userId: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('TopicMastery', topicMasterySchema);
