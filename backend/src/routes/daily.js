const express = require('express');
const router = express.Router();
const DailySession = require('../models/DailySession');
const DailyConcept = require('../models/DailyConcept');
const AdminReview = require('../models/AdminReview');
const TopicMastery = require('../models/TopicMastery');
const Topic = require('../models/Topic');
const mongoose = require('mongoose');
const RevisionQueue = require('../models/RevisionQueue');
const authMiddleware = require('../middleware/authMiddleware');
const { generateLesson } = require('../services/llmService');
const { computeBehavioralState } = require('../services/behaviorService');
const User = require('../models/User');

const DailyGlobalContent = require('../models/DailyGlobalContent');

const { dailySessionLimiter } = require('../middleware/rateLimiter');

/**
 * GET /daily/session
 * Replaces /daily/topic and /daily/questions
 */
router.get('/daily/session', authMiddleware, dailySessionLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        const timezone = user?.timezone || 'UTC';

        // Timezone aware date string
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

        let session = await DailySession.findOne({ userId, dateString: todayStr });
        if (session) {
            return res.json(session);
        }

        // Fetch today's global content
        const nowUTC = new Date();
        const dateKey = `${nowUTC.getUTCFullYear()}-${String(nowUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(nowUTC.getUTCDate()).padStart(2, '0')}`;

        const globalContent = await DailyGlobalContent.findOne({ dateKey });

        if (!globalContent) {
            return res.status(202).json({
                status: 'NOT_READY',
                message: 'Daily global content for today is still generating via the midnight worker. Check back in a few minutes.'
            });
        }

        const behavior = await computeBehavioralState(userId);

        const expiresAt = new Date();
        expiresAt.setUTCHours(23, 59, 59, 999);

        // Strip backend ID formatting internally
        const cleanQuestions = globalContent.questions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer
        }));

        session = new DailySession({
            userId,
            dateString: todayStr,
            cluster: globalContent.clusterId,
            topic: globalContent.topicId,
            reason: 'global_daily_curriculum',
            streakMeta: { streakDays: user?.streak || 0 },
            behavioralState: behavior.state,
            expiresAt,
            questions: cleanQuestions,
            codingQuestions: globalContent.codingQuestions
        });

        await session.save();

        res.json(session);

    } catch (err) {
        if (err.code === 11000) {
            const user = await User.findById(req.user.id);
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: user?.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
            const session = await DailySession.findOne({ userId: req.user.id, dateString: todayStr });
            if (session) return res.json(session);
        }
        console.error('Server Error in /daily/session:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
