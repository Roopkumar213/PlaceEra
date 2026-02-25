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

        const globalContent = await DailyGlobalContent.findOne({ dateKey }).lean();

        if (!globalContent) {
            return res.status(202).json({
                status: 'NOT_READY',
                message: 'Daily global content for today is still generating via the midnight worker. Check back in a few minutes.'
            });
        }

        const behavior = await computeBehavioralState(userId);

        const expiresAt = new Date();
        expiresAt.setUTCHours(23, 59, 59, 999);

        // ADAPTIVE CALIBRATION LOGIC
        const topicMasteryRec = await TopicMastery.findOne({ userId, topic: globalContent.topicId });
        const masteryScore = topicMasteryRec ? topicMasteryRec.mastery : 0;

        let band = 'BEGINNER';
        if (masteryScore >= 70) band = 'ADVANCED';
        else if (masteryScore >= 40) band = 'INTERMEDIATE';

        let targetDist = { EASY: 7, MEDIUM: 3, HARD: 0 };
        if (band === 'INTERMEDIATE') targetDist = { EASY: 4, MEDIUM: 4, HARD: 2 };
        if (band === 'ADVANCED') targetDist = { EASY: 2, MEDIUM: 4, HARD: 4 };

        const allQuestions = globalContent.questions;
        const pools = {
            EASY: allQuestions.filter(q => q.difficulty?.toUpperCase() === 'EASY'),
            MEDIUM: allQuestions.filter(q => q.difficulty?.toUpperCase() === 'MEDIUM'),
            HARD: allQuestions.filter(q => q.difficulty?.toUpperCase() === 'HARD')
        };
        // Assign any unclassified questions to Medium
        const unclassified = allQuestions.filter(q => !['EASY', 'MEDIUM', 'HARD'].includes(q.difficulty?.toUpperCase()));
        pools.MEDIUM.push(...unclassified);

        // Seed random generator (deterministic per user per day string)
        const seedStr = `${userId}-${dateKey}`;
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
            hash = hash & hash;
        }
        let rngState = Math.abs(hash);
        if (rngState === 0) rngState = 1;

        const random = () => {
            rngState = (1103515245 * rngState + 12345) % 0x80000000;
            return rngState / (0x80000000 - 1);
        };

        const shuffle = (array) => {
            const arr = [...array];
            let m = arr.length, t, i;
            while (m) {
                i = Math.floor(random() * m--);
                t = arr[m];
                arr[m] = arr[i];
                arr[i] = t;
            }
            return arr;
        };

        const takeQuestions = (pool, count) => {
            return shuffle(pool).slice(0, count);
        };

        let selectedQuestions = [];
        let missing = 0;

        for (const diff of ['EASY', 'MEDIUM', 'HARD']) {
            const target = targetDist[diff];
            const taken = takeQuestions(pools[diff], target);
            selectedQuestions.push(...taken);
            if (taken.length < target) {
                missing += (target - taken.length);
            }
        }

        // Fallback for missing questions (if LLM didn't produce enough of a difficulty)
        if (missing > 0 && selectedQuestions.length < allQuestions.length) {
            const unused = allQuestions.filter(q => !selectedQuestions.some(sq => sq.id === q.id));
            const extra = takeQuestions(unused, missing);
            selectedQuestions.push(...extra);
        }

        // Final shuffle so questions aren't strictly grouped by difficulty
        selectedQuestions = shuffle(selectedQuestions);

        // Strip backend ID formatting internally
        const cleanQuestions = selectedQuestions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            difficulty: q.difficulty || 'MEDIUM'
        }));

        // Limit coding questions to 1-2
        const selectedCoding = globalContent.codingQuestions.length > 0
            ? shuffle(globalContent.codingQuestions).slice(0, 2)
            : [];

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
            codingQuestions: selectedCoding
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
