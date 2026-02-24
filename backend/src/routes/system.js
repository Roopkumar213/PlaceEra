const express = require('express');
const router = express.Router();
const TopicMastery = require('../models/TopicMastery');
const LearningEventLog = require('../models/LearningEventLog');
const RevisionQueue = require('../models/RevisionQueue');
const SubjectMastery = require('../models/SubjectMastery');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limit: Rebuild is expensive — max 3 per hour per user
const rebuildLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 3,
    message: { message: 'Too many rebuild requests. Max 3 per hour.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: req => req.user ? `rebuild:${req.user.id}` : `ip:${req.socket.remoteAddress}`
});

// GET /api/system/metrics
router.get('/metrics', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const masteryStats = await TopicMastery.aggregate([
            {
                $group: {
                    _id: null,
                    avgMastery: { $avg: '$mastery' },
                    totalTopicsTracked: { $sum: 1 },
                    weakTopics: { $sum: { $cond: [{ $lt: ['$mastery', 50] }, 1, 0] } }
                }
            }
        ]);

        const avgMastery = masteryStats[0]?.avgMastery || 0;
        const totalTopics = masteryStats[0]?.totalTopicsTracked || 0;
        const weakCount = masteryStats[0]?.weakTopics || 0;
        const weakPercentage = totalTopics > 0 ? (weakCount / totalTopics) * 100 : 0;

        const yesterday = new Date(Date.now() - 86400000);
        const eventStats = await LearningEventLog.aggregate([
            { $match: { timestamp: { $gte: yesterday } } },
            { $group: { _id: '$eventType', count: { $sum: 1 }, avgDelta: { $avg: { $abs: '$delta' } } } }
        ]);

        const events = {};
        eventStats.forEach(e => { events[e._id] = { count: e.count, avgDelta: e.avgDelta }; });

        const queueSize = await RevisionQueue.countDocuments({ resolved: false });

        const decayStats = await LearningEventLog.aggregate([
            { $match: { eventType: 'DECAY_APPLIED', timestamp: { $gte: yesterday } } },
            { $group: { _id: null, totalDecay: { $sum: '$delta' } } }
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
                queue: { pendingRevisions: queueSize },
                activity24h: { events, netDecayPoints: Math.round(totalDecay24h * 100) / 100 }
            }
        });

    } catch (err) {
        console.error('Metrics Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// ─── POST /api/system/rebuild ─────────────────────────────────────────────────
/**
 * Personal data integrity rebuild.
 * Recalculates:  SubjectMastery aggregates from TopicMastery rows
 *                Unlock state via evaluateAndUpdateUnlocks
 *                Readiness per subject
 * Idempotent — safe to call multiple times.
 * Does NOT alter mastery scores or quiz logic.
 */
router.post('/rebuild', authMiddleware, rebuildLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        const { evaluateAndUpdateUnlocks } = require('../services/masteryService');
        const { withTransaction } = require('../utils/dbUtils');

        const rebuiltSubjects = [];
        let unlocksEvaluated = false;

        await withTransaction(async (session) => {
            // Fetch subject definitions to inherit track/cluster metadata
            const Subject = require('../models/Subject');
            const subjectsInfo = await Subject.find().session(session).lean();
            const subjectMetaMap = {};
            subjectsInfo.forEach(s => {
                subjectMetaMap[s.name] = { track: s.track || 'DSA', cluster: s.cluster || '' };
            });

            // 1. Re-aggregate SubjectMastery from live TopicMastery rows
            const topics = await TopicMastery.find({ userId }).session(session).lean();

            // Group by subject
            const bySubject = {};
            topics.forEach(t => {
                if (!bySubject[t.subject]) bySubject[t.subject] = [];
                bySubject[t.subject].push(t);
            });

            for (const [subjectName, subTopics] of Object.entries(bySubject)) {
                const avgMastery = subTopics.reduce((a, t) => a + (t.mastery ?? 0), 0) / subTopics.length;
                const masteredCount = subTopics.filter(t => t.mastery > 90).length;
                const attemptedCount = subTopics.filter(t => (t.totalAttempts ?? 0) > 0).length;

                const meta = subjectMetaMap[subjectName] || { track: 'DSA', cluster: '' };

                await SubjectMastery.findOneAndUpdate(
                    { userId, subject: subjectName },
                    {
                        $set: {
                            averageMastery: parseFloat(avgMastery.toFixed(2)),
                            totalTopics: attemptedCount,
                            masteredTopics: masteredCount,
                            track: meta.track,
                            cluster: meta.cluster,
                            lastUpdated: new Date()
                        }
                    },
                    { upsert: true, session }
                );
                rebuiltSubjects.push(subjectName);
            }

            // 2. Re-evaluate unlock state
            await evaluateAndUpdateUnlocks(userId, session);
            unlocksEvaluated = true;
        });

        res.json({
            message: 'Data integrity rebuild complete.',
            rebuiltSubjects,
            unlocksEvaluated,
            rebuiltAt: new Date().toISOString()
        });

    } catch (err) {
        console.error('[SystemRebuild] Error:', err);
        res.status(500).json({ message: 'Rebuild failed: ' + err.message });
    }
});

module.exports = router;
