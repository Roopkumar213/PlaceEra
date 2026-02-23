/**
 * User Analytics Route
 * GET /api/user/analytics
 *
 * Returns personal analytics dashboard for the authenticated user:
 * - totalQuizzes, totalMocks
 * - avgImprovementRate (avg positive mastery delta across QUIZ_SUBMIT events)
 * - strongestSubject, weakestSubject
 * - subjectBreakdown (all subjects with mastery + trend)
 * - recentVelocity (last 7 days avg delta per day)
 *
 * Reads from: LearningEventLog, SubjectMastery, TopicMastery
 * Does NOT mutate any state.
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const LearningEventLog = require('../models/LearningEventLog');
const SubjectMastery = require('../models/SubjectMastery');
const TopicMastery = require('../models/TopicMastery');
const MockSession = require('../models/MockSession');

// ─── GET /api/user/analytics ──────────────────────────────────────────────────
router.get('/analytics', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const [
            quizEvents,
            mockCount,
            subjectMasteries,
            topicMasteries
        ] = await Promise.all([
            LearningEventLog.find({ userId, eventType: 'QUIZ_SUBMIT' })
                .select('delta timestamp subject')
                .sort({ timestamp: -1 })
                .limit(200)
                .lean(),
            MockSession.countDocuments({ userId, status: 'COMPLETED' }),
            SubjectMastery.find({ userId }).lean(),
            TopicMastery.find({ userId }).sort({ mastery: -1 }).lean()
        ]);

        // Totals
        const totalQuizzes = quizEvents.length;
        const totalMocks = mockCount;

        // Avg improvement rate: mean of positive deltas
        const positiveDeltas = quizEvents.map(e => e.delta ?? 0).filter(d => d > 0);
        const avgImprovementRate = positiveDeltas.length > 0
            ? parseFloat((positiveDeltas.reduce((a, b) => a + b, 0) / positiveDeltas.length).toFixed(2))
            : 0;

        // Strongest / Weakest subject
        const sortedSubjects = [...subjectMasteries].sort((a, b) => b.averageMastery - a.averageMastery);
        const strongestSubject = sortedSubjects[0]
            ? { subject: sortedSubjects[0].subject, mastery: Math.round(sortedSubjects[0].averageMastery) }
            : null;
        const weakestSubject = sortedSubjects[sortedSubjects.length - 1]
            ? { subject: sortedSubjects[sortedSubjects.length - 1].subject, mastery: Math.round(sortedSubjects[sortedSubjects.length - 1].averageMastery) }
            : null;

        // All subjects with detail
        const subjectBreakdown = subjectMasteries.map(s => ({
            subject: s.subject,
            mastery: Math.round(s.averageMastery ?? 0),
            totalTopics: s.totalTopics ?? 0,
            masteredTopics: s.masteredTopics ?? 0,
            totalAttempts: s.totalAttempts ?? 0
        }));

        // Recent velocity: per-day avg |delta| over the last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const recentEvents = quizEvents.filter(e => new Date(e.timestamp) >= sevenDaysAgo);
        const byDay = {};
        recentEvents.forEach(e => {
            const d = new Date(e.timestamp).toISOString().split('T')[0];
            if (!byDay[d]) byDay[d] = [];
            byDay[d].push(Math.abs(e.delta ?? 0));
        });
        const recentVelocity = Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, deltas]) => ({
                date,
                avgDelta: parseFloat((deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(2)),
                sessions: deltas.length
            }));

        // Top 5 mastered topics
        const topTopics = topicMasteries
            .filter(t => t.mastery > 50)
            .slice(0, 5)
            .map(t => ({ topic: t.topic, subject: t.subject, mastery: Math.round(t.mastery) }));

        res.json({
            totalQuizzes,
            totalMocks,
            avgImprovementRate,
            strongestSubject,
            weakestSubject,
            subjectBreakdown,
            recentVelocity,
            topTopics
        });

    } catch (err) {
        console.error('[UserAnalytics] Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// ─── GET /api/user/export/csv ────────────────────────────────────────────────
/**
 * Exports the user's mock session history as a CSV file.
 */
router.get('/export/csv', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const sessions = await MockSession.find({ userId, status: 'COMPLETED' })
            .sort({ completedAt: 1 })
            .select('completedAt score performanceDelta durationMinutes questionCount subjectBreakdown difficultyBreakdown weakestTopic percentile adaptiveConfig')
            .lean();

        const rows = [];
        rows.push([
            'Date', 'Score(%)', 'PerformanceDelta', 'Duration(min)', 'Questions',
            'WeakestTopic', 'Percentile', 'DifficultyProfile'
        ].join(','));

        sessions.forEach(s => {
            const date = s.completedAt ? new Date(s.completedAt).toISOString().split('T')[0] : '';
            const score = Math.round(s.score ?? 0);
            const delta = (s.performanceDelta ?? 0).toFixed(2);
            const dur = s.durationMinutes ?? '';
            const qCount = s.questionCount ?? '';
            const wTopic = s.weakestTopic?.topic ? `"${s.weakestTopic.topic}"` : '';
            const pct = s.percentile ?? '';
            const prof = s.adaptiveConfig?.difficultyProfile ?? '';
            rows.push([date, score, delta, dur, qCount, wTopic, pct, prof].join(','));
        });

        const csv = rows.join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="mock_history.csv"');
        res.send(csv);

    } catch (err) {
        console.error('[UserExport CSV] Error:', err);
        res.status(500).json({ message: 'Export failed' });
    }
});

// ─── GET /api/user/export/mastery ────────────────────────────────────────────
/**
 * Exports the user's full mastery snapshot as a JSON file.
 */
router.get('/export/mastery', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const [subjectMasteries, topicMasteries] = await Promise.all([
            SubjectMastery.find({ userId }).lean(),
            TopicMastery.find({ userId }).lean()
        ]);

        const snapshot = {
            exportedAt: new Date().toISOString(),
            userId,
            subjects: subjectMasteries.map(s => ({
                subject: s.subject,
                mastery: Math.round(s.averageMastery ?? 0),
                masteredTopics: s.masteredTopics,
                totalTopics: s.totalTopics,
                totalAttempts: s.totalAttempts
            })),
            topics: topicMasteries.map(t => ({
                topic: t.topic,
                subject: t.subject,
                mastery: Math.round(t.mastery),
                unlocked: t.unlocked,
                trendDirection: t.trendDirection,
                totalAttempts: t.totalAttempts,
                lastAttemptAt: t.lastAttemptAt
            }))
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="mastery_snapshot.json"');
        res.send(JSON.stringify(snapshot, null, 2));

    } catch (err) {
        console.error('[UserExport Mastery] Error:', err);
        res.status(500).json({ message: 'Export failed' });
    }
});

module.exports = router;
