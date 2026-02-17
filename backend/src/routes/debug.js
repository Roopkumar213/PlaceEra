const express = require('express');
const router = express.Router();
const UserProgress = require('../models/UserProgress');
const TopicMastery = require('../models/TopicMastery');
const SubjectMastery = require('../models/SubjectMastery');
const WeeklyProgressSnapshot = require('../models/WeeklyProgressSnapshot');
const { calculateGlobalReadiness } = require('../services/globalReadinessEngine');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/debug/user-flow
router.get('/user-flow', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const [
            topicMasteryCount,
            subjectMasteryCount,
            latestQuiz,
            readinessData,
            weeklySnapshotExists,
            revisionQueueCount // Assuming logic for revision queue exists or is just a query
        ] = await Promise.all([
            TopicMastery.countDocuments({ userId }),
            SubjectMastery.countDocuments({ userId }),
            UserProgress.findOne({ userId }).sort({ completedAt: -1 }),
            calculateGlobalReadiness(userId),
            WeeklyProgressSnapshot.exists({ userId }),
            // Placeholder for revision queue: counting topic masteries < 70?
            TopicMastery.countDocuments({ userId, proficiency: { $lt: 70 } })
        ]);

        res.json({
            topicMasteryCount,
            subjectMasteryCount,
            latestQuiz: latestQuiz || null,
            readinessScore: readinessData.readinessScore,
            classification: readinessData.classification,
            weeklySnapshotExists: !!weeklySnapshotExists,
            revisionQueueCount
        });

    } catch (err) {
        console.error('Debug Flow Error:', err);
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
});

module.exports = router;
