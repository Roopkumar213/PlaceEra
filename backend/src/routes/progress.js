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

        // Parallel fetch for perf
        const [streak, weakTopics, totalLessons, recentActivity] = await Promise.all([
            calculateStreak(userId),
            TopicMastery.find({ userId }).sort({ proficiency: 1 }).limit(3),
            UserProgress.countDocuments({ userId }),
            UserProgress.find({ userId })
                .sort({ completedAt: -1 })
                .limit(5)
                .populate('lessonId', 'topic subject')
        ]);

        res.json({
            streak,
            totalLessons,
            weakTopics,
            recentActivity
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

module.exports = router;
