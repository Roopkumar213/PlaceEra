const express = require('express');
const router = express.Router();
const UserProgress = require('../models/UserProgress');
const TopicMastery = require('../models/TopicMastery');
const WeeklyProgressSnapshot = require('../models/WeeklyProgressSnapshot');
const { calculateGlobalReadiness } = require('../services/globalReadinessEngine');
const authMiddleware = require('../middleware/authMiddleware');

// Helper to calculate streak (Simplified for now)
const calculateStreak = async (userId) => {
    // Logic as before
    const progress = await UserProgress.find({ userId }).sort({ completedDate: -1 }).select('completedDate');
    if (!progress.length) return 0;
    const uniqueDates = [...new Set(progress.map(p => p.completedDate))];
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (!uniqueDates.includes(today) && !uniqueDates.includes(yesterday)) return 0;
    return uniqueDates.length; // Placeholder: real logic needs consecutive check
};

// GET /api/progress/dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Calculate Global Readiness
        const readinessData = await calculateGlobalReadiness(userId);

        // 2. Fetch Weekly Trend (Last 8 snapshots)
        let snapshots = await WeeklyProgressSnapshot.find({ userId })
            .sort({ weekStartDate: 1 })
            .limit(8);

        // Part 4: Weekly Snapshot Fix (Initial creation)
        if (snapshots.length === 0 && readinessData.readinessScore > 0) {
            // User has score but no snapshot. Create one for THIS week (or "Start").
            // Use current time as snapshot time
            const now = new Date();
            // Align to Monday? Or just now. Spec: "weekStartDate". 
            // Let's create one for the current week.
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
            weekStart.setHours(0, 0, 0, 0);

            const initialSnapshot = await WeeklyProgressSnapshot.create({
                userId,
                weekStartDate: weekStart,
                readinessScore: readinessData.readinessScore,
                averageScore: readinessData.readinessScore,
                quizzesCompleted: 0, // Unknown history
                streak: 0
            });
            snapshots = [initialSnapshot];
        }

        const weeklyTrend = snapshots.map(s => ({
            weekStartDate: s.weekStartDate,
            readinessScore: s.readinessScore
        }));

        // 3. Calculate Improvement Trend
        let improvementTrend = 'Stable';
        if (snapshots.length >= 2) {
            const current = snapshots[snapshots.length - 1].readinessScore;
            const previous = snapshots[snapshots.length - 2].readinessScore;
            const delta = current - previous;

            if (delta >= 5) improvementTrend = 'Strong Improvement';
            else if (delta >= 1) improvementTrend = 'Improving';
            else if (delta <= -5) improvementTrend = 'Needs Attention';
            else if (delta <= -1) improvementTrend = 'Slight Decline';
        }

        // 4. Counts
        const streak = await calculateStreak(userId);

        // Count quizzes this week (ISO week logic or simple 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const quizzesThisWeek = await UserProgress.countDocuments({
            userId,
            completedAt: { $gte: sevenDaysAgo }
        });

        // Response conforming to Spec Part 3
        res.json({
            readinessScore: readinessData.readinessScore,
            classification: readinessData.classification,
            weeklyTrend,
            subjectBreakdown: readinessData.breakdown,
            streak,
            quizzesThisWeek,
            improvementTrend, // Part 5 (Added to response for UI)
            weakestSubject: readinessData.weakestSubject,
            strongestSubject: readinessData.strongestSubject
        });

    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Sync endpoint (placeholder)
router.post('/sync', authMiddleware, async (req, res) => {
    res.json({ message: 'Sync not implemented yet' });
});

// Legacy/Direct Readiness Endpoint
router.get('/readiness', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const readiness = await calculateGlobalReadiness(userId);
        res.json(readiness);
    } catch (err) {
        console.error('Readiness Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// GET /api/progress/state
router.get('/state', authMiddleware, async (req, res) => {
    try {
        const { calculateLearningState } = require('../services/globalReadinessEngine');
        const userId = req.user.id;
        const state = await calculateLearningState(userId);
        res.json(state);
    } catch (err) {
        console.error('State Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
