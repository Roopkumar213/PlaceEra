const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    subject: {
        type: String, // Matching the String structure in TopicMastery
        required: true,
        index: true
    },
    orderIndex: {
        type: Number,
        required: true,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Topic', topicSchema);
