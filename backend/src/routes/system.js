const express = require('express');
const router = express.Router();
const TopicMastery = require('../models/TopicMastery');
const LearningEventLog = require('../models/LearningEventLog');
const RevisionQueue = require('../models/RevisionQueue');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/system/metrics
// Admin-only (or dev) endpoint to view system health
// For now, we'll allow authenticated users to see it for the demo.
router.get('/metrics', authMiddleware, async (req, res) => {
    try {
        // 1. Mastery Stats
        const masteryStats = await TopicMastery.aggregate([
            {
                $group: {
                    _id: null,
                    avgMastery: { $avg: '$mastery' },
                    totalTopicsTracked: { $sum: 1 },
                    weakTopics: {
                        $sum: { $cond: [{ $lt: ['$mastery', 50] }, 1, 0] }
                    }
                }
            }
        ]);

        const avgMastery = masteryStats[0]?.avgMastery || 0;
        const totalTopics = masteryStats[0]?.totalTopicsTracked || 0;
        const weakCount = masteryStats[0]?.weakTopics || 0;
        const weakPercentage = totalTopics > 0 ? (weakCount / totalTopics) * 100 : 0;

        // 2. Event Log Stats (Last 24h)
        const yesterday = new Date(Date.now() - 86400000);
        const eventStats = await LearningEventLog.aggregate([
            { $match: { timestamp: { $gte: yesterday } } },
            {
                $group: {
                    _id: '$eventType',
                    count: { $sum: 1 },
                    avgDelta: { $avg: { $abs: '$delta' } }
                }
            }
        ]);

        const events = {};
        eventStats.forEach(e => {
            events[e._id] = { count: e.count, avgDelta: e.avgDelta };
        });

        // 3. Revision Queue Size
        const queueSize = await RevisionQueue.countDocuments({ resolved: false });

        // 4. Decay Impact (Specific query)
        const decayStats = await LearningEventLog.aggregate([
            { $match: { eventType: 'DECAY_APPLIED', timestamp: { $gte: yesterday } } },
            {
                $group: {
                    _id: null,
                    totalDecay: { $sum: '$delta' } // delta is negative for decay
                }
            }
        ]);
        const totalDecay24h = decayStats[0]?.totalDecay || 0;

        res.json({
            health: 'stable',
            timestamp: new Date(),
            metrics: {
                mastery: {
                    average: Math.round(avgMastery * 100) / 100,
                    weakPercentage: Math.round(weakPercentage),
                    totalTopics
                },
                queue: {
                    pendingRevisions: queueSize
                },
                activity24h: {
                    events,
                    netDecayPoints: Math.round(totalDecay24h * 100) / 100
                }
            }
        });

    } catch (err) {
        console.error('Metrics Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
