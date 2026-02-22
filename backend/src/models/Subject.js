const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    orderIndex: {
        type: Number,
        required: true,
        index: true
    },
    /**
     * Track this subject belongs to.
     * Defaults to 'DSA' so all existing subjects remain unaffected.
     */
    track: {
        type: String,
        enum: ['DSA', 'APTITUDE', 'DEV', 'DEVOPS'],
        default: 'DSA',
        index: true
    },
    /**
     * Cluster grouping within a track (e.g. "Number Theory", "Cloud Providers").
     * Optional — purely for UI grouping and recommendation context.
     */
    cluster: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Subject', subjectSchema);
