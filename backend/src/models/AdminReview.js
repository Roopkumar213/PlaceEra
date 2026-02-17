const mongoose = require('mongoose');

const AdminReviewSchema = new mongoose.Schema({
    topic: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    rawOutput: {
        type: String,
        required: true
    },
    errorMessage: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('AdminReview', AdminReviewSchema);
