/**
 * Track Model
 *
 * Defines the four preparation tracks:
 *   DSA      — Data Structures & Algorithms (interview core)
 *   APTITUDE — Quantitative, logical, verbal reasoning
 *   DEV      — Backend, frontend, system design, DB
 *   DEVOPS   — Cloud, CI/CD, containers, infra
 *
 * Tracks are purely organizational — they do NOT store mastery.
 * Mastery is always on TopicMastery, unchanged.
 *
 * weight: multiplier applied when scoring cross-track recommendations.
 *   Higher weight = this track's weaknesses are prioritised more.
 */

const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        enum: ['DSA', 'APTITUDE', 'DEV', 'DEVOPS']
    },
    /**
     * Recommendation weight multiplier (1.0 = baseline).
     * DSA is 2.0 because interview success depends on it most.
     */
    weight: {
        type: Number,
        default: 1.0,
        min: 0.1,
        max: 5.0
    },
    orderIndex: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Track', trackSchema);
