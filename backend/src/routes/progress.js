const express = require('express');
const router = express.Router();
const UserProgress = require('../models/UserProgress');
const TopicMastery = require('../models/TopicMastery');
const authMiddleware = require('../middleware/authMiddleware');

// Helper to calculate streak
const calculateStreak = async (userId) => {
    // Get all unique completed dates, sorted descending
    const progress = await UserProgress.find({ userId })
        .sort({ completedDate: -1 })
        .select('completedDate');

    if (!progress.length) return 0;

    const uniqueDates = [...new Set(progress.map(p => p.completedDate))];
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if the most recent activity is today or yesterday
    if (!uniqueDates.includes(today) && !uniqueDates.includes(yesterday)) {
        return 0;
    }

    // Iterate dates to find consecutive days
    // This is a simplified check. For rigorous check we need detailed date math.
    // Assuming uniqueDates are "YYYY-MM-DD"

    let currentDate = new Date();

    // If last completed was yesterday, start counting from yesterday
    if (!uniqueDates.includes(today)) {
        currentDate.setDate(currentDate.getDate() - 1);
    }

    for (const dateStr of uniqueDates) {
        const checkDate = currentDate.toISOString().split('T')[0];
        if (dateStr === checkDate) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
};

// GET /api/progress/dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id; // from authMiddleware

        // 0. Auto-initialize for new users
        const { initializeUserMasteryIfEmpty } = require('../services/masteryService');
        await initializeUserMasteryIfEmpty(userId);

        const { getBehavioralSummary } = require('../services/behaviorService');

        // Parallel fetch for perf
        const [streak, weakTopics, totalLessons, recentActivity, firstRecommendedTopic, hasStartedLearning, behavior] = await Promise.all([
            calculateStreak(userId),
            TopicMastery.find({ userId }).sort({ mastery: 1 }).limit(3),
            UserProgress.countDocuments({ userId }),
            UserProgress.find({ userId })
                .sort({ completedAt: -1 })
                .limit(5)
                .populate('lessonId', 'topic subject'),
            TopicMastery.findOne({ userId, recommended: true }).sort({ mastery: 1 }),
            TopicMastery.exists({
                userId,
                $or: [
                    { lastAttemptAt: { $ne: null } },
                    { mastery: { $gt: 5 } }
                ]
            }),
            getBehavioralSummary(userId)
        ]);

        res.json({
            streak,
            totalLessons,
            weakTopics,
            recentActivity,
            firstRecommendedTopic,
            isFirstSession: !hasStartedLearning,
            behavior: behavior ?? {
                streakDays: streak,
                behavioralState: 'OPTIMAL',
                behavioralMeta: {},
                velocityHistory: []
            }
        });
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// POST /api/progress/sync (Simple version for now)
router.post('/sync', authMiddleware, async (req, res) => {
    // This would handle bulk upload from IndexedDB
    // For now, let's just accept a single result as a "completed lesson" if sent here?
    // Actually, quiz submission in `routes/quiz.js` (if it existed) or `routes/daily.js` likely handles creating UserProgress.
    // Let's assume we need a generic sync endpoint later.
    res.json({ message: 'Sync not implemented yet' });
});

// GET /api/progress/readiness
router.get('/readiness', authMiddleware, async (req, res) => {
    try {
        const { calculateReadiness } = require('../services/readinessEngine');
        const userId = req.user.id;
        const readiness = await calculateReadiness(userId);
        res.json(readiness);
    } catch (err) {
        console.error('Readiness Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// GET /api/progress/consistency
router.get('/consistency', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const LearningEventLog = require('../models/LearningEventLog');
        const mongoose = require('mongoose');

        const events = await LearningEventLog.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    eventType: { $in: ['QUIZ_SUBMIT', 'MOCK_COMPLETED'] },
                    timestamp: { $gte: oneYearAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    count: { $sum: 1 },
                    avgDelta: { $avg: { $abs: "$delta" } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const fullYearStats = events.map(e => ({
            date: e._id,
            count: e.count || 0,
            avgDelta: e.avgDelta || 0
        }));

        res.json({ fullYearStats });
    } catch (err) {
        console.error('Consistency Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
