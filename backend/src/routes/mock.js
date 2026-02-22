const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const MockSession = require('../models/MockSession');
const SubjectMastery = require('../models/SubjectMastery');
const TopicMastery = require('../models/TopicMastery');
const DailyConcept = require('../models/DailyConcept');
const { withTransaction } = require('../utils/dbUtils');
const { evaluateAndUpdateUnlocks } = require('../services/masteryService');
const LearningEventLog = require('../models/LearningEventLog');
const mongoose = require('mongoose');

const { submissionLimiter, mockStartLimiter } = require('../middleware/rateLimiter');
const { validateBody } = require('../middleware/validateRequest');

const mockSubmitSchema = {
    type: 'object',
    properties: {
        sessionId: { type: 'string' },
        answers: {
            type: 'object',
            additionalProperties: { type: 'string' }
        }
    },
    required: ['sessionId', 'answers'],
    additionalProperties: false
};

// ─── Difficulty Tier Mapping ─────────────────────────────────────────────────
// DailyConcept.difficulty uses title-cased values: 'Easy', 'Medium', 'Hard'
const DIFFICULTY_TIERS = {
    EASY_HEAVY: { Easy: 0.6, Medium: 0.3, Hard: 0.1 },   // subject readiness < 40
    MIXED: { Easy: 0.3, Medium: 0.5, Hard: 0.2 },   // 40–69
    HARD_HEAVY: { Easy: 0.1, Medium: 0.3, Hard: 0.6 }    // >= 70
};

/**
 * Determine difficulty profile and adaptive time limit based on subject readiness.
 */
function getAdaptiveProfileForSubject(averageMastery) {
    if (averageMastery < 40) return { profile: 'EASY_HEAVY', timeFactor: 1.0 };  // More time — harder for them per question
    if (averageMastery < 70) return { profile: 'MIXED', timeFactor: 0.85 };
    return { profile: 'HARD_HEAVY', timeFactor: 0.7 };   // Less time — harder questions, pressure scaling
}

/**
 * Pull questions from a subject's DailyConcepts respecting difficulty ratios.
 * @param {string} subjectName
 * @param {number} totalCount
 * @param {object} ratios  e.g. { Easy: 0.6, Medium: 0.3, Hard: 0.1 }
 * @returns {Array}
 */
async function getQuestionsForSubjectWithDifficulty(subjectName, totalCount, ratios) {
    const selected = [];

    for (const [diff, ratio] of Object.entries(ratios)) {
        const targetCount = Math.round(totalCount * ratio);
        if (targetCount <= 0) continue;

        // Find DailyConcepts matching this subject+difficulty
        const concepts = await DailyConcept.find({ subject: subjectName, difficulty: diff }).lean();
        let pool = [];
        concepts.forEach(c => {
            c.quiz.forEach((q, idx) => {
                pool.push({
                    conceptId: c._id,
                    topic: c.topic,
                    subject: c.subject,
                    questionIndex: idx,
                    questionText: q.question,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    difficulty: diff
                });
            });
        });

        pool.sort(() => 0.5 - Math.random());
        selected.push(...pool.slice(0, targetCount));
    }

    // If difficulty-filtered pool is too small, backfill with any difficulty
    if (selected.length < totalCount) {
        const needed = totalCount - selected.length;
        const usedIds = new Set(selected.map(q => `${q.conceptId}-${q.questionIndex}`));
        const fallback = await DailyConcept.find({ subject: subjectName }).lean();
        let pool = [];
        fallback.forEach(c => {
            c.quiz.forEach((q, idx) => {
                const key = `${c._id}-${idx}`;
                if (!usedIds.has(key)) {
                    pool.push({
                        conceptId: c._id,
                        topic: c.topic, subject: c.subject,
                        questionIndex: idx,
                        questionText: q.question,
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                        difficulty: c.difficulty || 'Medium'
                    });
                }
            });
        });
        pool.sort(() => 0.5 - Math.random());
        selected.push(...pool.slice(0, needed));
    }

    return selected;
}

/**
 * POST /api/mock/start  — Adaptive Simulation V2
 * Initializes a difficulty-weighted, time-pressure-scaled mock test.
 */
router.post('/start', auth, mockStartLimiter, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Concurrency Guard
        const active = await MockSession.findOne({ userId, status: 'IN_PROGRESS' });
        if (active) {
            return res.status(400).json({
                message: 'A mock session is already in progress.',
                sessionId: active._id
            });
        }

        // 2. Fetch subject readiness (sorted weakest → strongest)
        const masteries = await SubjectMastery.find({ userId }).sort({ averageMastery: 1 });
        if (masteries.length === 0) {
            return res.status(400).json({
                message: 'No performance history found. Complete initial quizzes to enable Mock Mode.'
            });
        }

        // 3. Subject segmentation with V2 weighting
        const weakest = masteries[0];
        const secondWeakest = masteries.length > 1 ? masteries[1] : masteries[0];
        const others = masteries.slice(2);

        // Question distribution: 50% weakest, 30% 2nd, 20% rest
        const TOTAL_QUESTIONS = 30;
        const countMap = {};
        countMap[weakest.subject] = 15;
        if (secondWeakest.subject !== weakest.subject) {
            countMap[secondWeakest.subject] = 9;
        } else {
            countMap[weakest.subject] += 9;
        }
        if (others.length > 0) {
            const perOther = Math.floor(6 / others.length);
            others.forEach(s => { countMap[s.subject] = perOther; });
            const totalAssigned = Object.values(countMap).reduce((a, b) => a + b, 0);
            if (totalAssigned < TOTAL_QUESTIONS) countMap[weakest.subject] += (TOTAL_QUESTIONS - totalAssigned);
        } else {
            countMap[weakest.subject] += 6;
        }

        // 4. Build adaptive configs per subject
        const masteryMap = {};
        masteries.forEach(m => { masteryMap[m.subject] = m.averageMastery; });

        const subjectProfiles = {};
        let totalTimeLimitMinutes = 0;
        let dominantProfile = 'MIXED';   // for the weakest subject

        for (const [sub, count] of Object.entries(countMap)) {
            if (count <= 0) continue;
            const readiness = masteryMap[sub] ?? 50;
            const { profile, timeFactor } = getAdaptiveProfileForSubject(readiness);
            subjectProfiles[sub] = {
                count,
                profile,
                ratios: DIFFICULTY_TIERS[profile],
                // Adaptive time: weakest subject (most EASY) gets ~90s per q, HARD_HEAVY gets ~60s
                minutesForSubject: parseFloat(((count * (timeFactor * 1.5))).toFixed(1))
            };
            totalTimeLimitMinutes += subjectProfiles[sub].minutesForSubject;
            if (sub === weakest.subject) dominantProfile = profile;
        }

        totalTimeLimitMinutes = Math.max(20, Math.round(totalTimeLimitMinutes));

        // 5. Sample questions with difficulty ratios
        const allSelected = [];
        for (const [sub, cfg] of Object.entries(subjectProfiles)) {
            if (cfg.count <= 0) continue;
            const qs = await getQuestionsForSubjectWithDifficulty(sub, cfg.count, cfg.ratios);
            allSelected.push(...qs);
        }

        // Final shuffle so questions don't cluster by subject
        allSelected.sort(() => 0.5 - Math.random());

        if (allSelected.length < 5) {
            return res.status(400).json({
                message: 'Insufficient curriculum data to generate a valid mock test.'
            });
        }

        // 6. Persist session with adaptive config
        const session = new MockSession({
            userId,
            questionCount: allSelected.length,
            selectedQuestions: allSelected,
            adaptiveConfig: {
                difficultyProfile: dominantProfile,
                timeLimitMinutes: totalTimeLimitMinutes,
                subjectWeights: countMap
            }
        });
        await session.save();

        // 7. Strip correct answers for client; include difficulty for UI hints
        const questionsForClient = allSelected.map(q => ({
            id: `${q.conceptId}-${q.questionIndex}`,
            questionText: q.questionText,
            options: q.options,
            topic: q.topic,
            subject: q.subject,
            difficulty: q.difficulty
        }));

        // Build per-subject adaptive time hints
        const subjectTimeSuggestions = {};
        for (const [sub, cfg] of Object.entries(subjectProfiles)) {
            subjectTimeSuggestions[sub] = {
                minutes: cfg.minutesForSubject,
                difficultyBias: cfg.profile
            };
        }

        res.json({
            sessionId: session._id,
            questions: questionsForClient,
            startedAt: session.startedAt,
            config: {
                totalQuestions: session.questionCount,
                timeLimitMinutes: totalTimeLimitMinutes,
                difficultyProfile: dominantProfile,
                subjectTimeSuggestions
            }
        });

    } catch (err) {
        console.error('[MockEngine] Start Failed:', err);
        res.status(500).json({ message: 'Engine Error: Mock generation failed.' });
    }
});

// ─── POST /api/mock/submit ────────────────────────────────────────────────────
router.post('/submit', auth, submissionLimiter, validateBody(mockSubmitSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId, answers } = req.body;

        // 1. Atomic status guard — prevent duplicate submissions
        const session = await MockSession.findOneAndUpdate(
            { _id: sessionId, userId, status: 'IN_PROGRESS' },
            { $set: { status: 'COMPLETED' } },
            { returnDocument: 'after' }
        );
        if (!session) {
            return res.status(404).json({ message: 'Active mock session not found or already submitted.' });
        }

        // 2. Question Integrity Validation
        const sessionQuestionIds = new Set(
            session.selectedQuestions.map(q => `${q.conceptId}-${q.questionIndex}`)
        );
        const hasTamperedIds = Object.keys(answers).some(id => !sessionQuestionIds.has(id));
        if (hasTamperedIds) {
            return res.status(400).json({ message: 'Tampered answer set detected.' });
        }

        // 3. Grading — subject, topic AND difficulty breakdown
        let correctCount = 0;
        const breakdown = {};  // subject → { correct, total }
        const topicPerformance = {};  // topic   → { correct, total, subject }
        const diffPerformance = {};  // EASY/MEDIUM/HARD → { correct, total }

        session.selectedQuestions.forEach(q => {
            const key = `${q.conceptId}-${q.questionIndex}`;
            const answered = answers[key];
            const correct = answered !== undefined && answered === q.correctAnswer;
            if (correct) correctCount++;

            // Subject breakdown
            if (!breakdown[q.subject]) breakdown[q.subject] = { correct: 0, total: 0 };
            breakdown[q.subject].total++;
            if (correct) breakdown[q.subject].correct++;

            // Topic breakdown
            if (!topicPerformance[q.topic]) topicPerformance[q.topic] = { correct: 0, total: 0, subject: q.subject };
            topicPerformance[q.topic].total++;
            if (correct) topicPerformance[q.topic].correct++;

            // Difficulty breakdown
            const diff = q.difficulty || 'Medium';
            if (!diffPerformance[diff]) diffPerformance[diff] = { correct: 0, total: 0 };
            diffPerformance[diff].total++;
            if (correct) diffPerformance[diff].correct++;
        });

        const totalScorePercent = (correctCount / session.questionCount) * 100;

        // Build final Maps
        const finalBreakdown = new Map();
        for (const [sub, d] of Object.entries(breakdown)) {
            finalBreakdown.set(sub, {
                correct: d.correct, total: d.total,
                score: (d.correct / d.total) * 100
            });
        }

        const finalDiffBreakdown = new Map();
        for (const [diff, d] of Object.entries(diffPerformance)) {
            finalDiffBreakdown.set(diff, {
                correct: d.correct, total: d.total,
                score: d.total > 0 ? (d.correct / d.total) * 100 : 0
            });
        }

        // Weakest topic
        let weakestTopic = null;
        let weakestScore = Infinity;
        for (const [topic, d] of Object.entries(topicPerformance)) {
            const score = d.total > 0 ? (d.correct / d.total) * 100 : 0;
            if (score < weakestScore) {
                weakestScore = score;
                weakestTopic = { topic, subject: d.subject, score };
            }
        }

        // Percentile vs this user's own history (rank current vs past 10)
        let percentile = null;
        const prevSessions = await MockSession.find({ userId, status: 'COMPLETED', score: { $ne: null } })
            .select('score').sort({ completedAt: -1 }).limit(10).lean();
        if (prevSessions.length >= 1) {
            const scoresBetter = prevSessions.filter(s => totalScorePercent >= s.score).length;
            percentile = Math.round((scoresBetter / prevSessions.length) * 100);
        }

        let totalPerformanceDelta = 0;

        // 4. Atomic transaction for mastery + unlocks + finalization
        await withTransaction(async (dbSession) => {
            for (const [topicName, data] of Object.entries(topicPerformance)) {
                const topicScore = (data.correct / data.total) * 100;
                let topicMastery = await TopicMastery.findOne({ userId, topic: topicName }).session(dbSession);

                if (!topicMastery) {
                    topicMastery = await TopicMastery.findOneAndUpdate(
                        { userId, topic: topicName },
                        { $setOnInsert: { subject: data.subject, mastery: 0, unlocked: true } },
                        { upsert: true, returnDocument: 'after', session: dbSession }
                    );
                }

                const currentProf = topicMastery.mastery;
                const delta = (topicScore - currentProf) * 0.25;
                const newMastery = Math.max(0, Math.min(100, currentProf + delta));
                totalPerformanceDelta += (newMastery - currentProf);

                await TopicMastery.updateOne(
                    { _id: topicMastery._id },
                    {
                        $set: { mastery: newMastery, lastAttemptAt: new Date() },
                        $inc: { totalAttempts: data.total, correctAttempts: data.correct }
                    }
                ).session(dbSession);
            }

            // Sync SubjectMastery
            const affectedSubjects = Object.keys(breakdown);
            for (const subName of affectedSubjects) {
                const allSubTopics = await TopicMastery.find({ userId, subject: subName }).session(dbSession);
                const sumM = allSubTopics.reduce((acc, t) => acc + t.mastery, 0);
                const avgM = allSubTopics.length > 0 ? sumM / allSubTopics.length : 0;
                const masteredCount = allSubTopics.filter(t => t.mastery > 90).length;
                const attemptedCount = allSubTopics.reduce((a, t) => a + (t.totalAttempts > 0 ? 1 : 0), 0);

                await SubjectMastery.findOneAndUpdate(
                    { userId, subject: subName },
                    {
                        $set: { averageMastery: avgM, totalTopics: attemptedCount, masteredTopics: masteredCount, lastUpdated: Date.now() },
                        $inc: { totalAttempts: 1 }
                    },
                    { upsert: true, session: dbSession }
                );
            }

            // Unlock re-evaluation (preserves monotonicity)
            await evaluateAndUpdateUnlocks(userId, dbSession);

            // Audit log
            await LearningEventLog.create([{
                userId,
                topicId: 'MOCK_TEST',
                subject: 'MULTI',
                eventType: 'MOCK_COMPLETED',
                previousMastery: 0,
                newMastery: totalScorePercent,
                delta: totalPerformanceDelta,
                meta: {
                    sessionId,
                    score: totalScorePercent,
                    breakdown: Object.fromEntries(finalBreakdown),
                    difficultyBreakdown: Object.fromEntries(finalDiffBreakdown),
                    weakestTopic,
                    percentile
                }
            }], { session: dbSession });

            // Finalize session
            const completedAt = new Date();
            await MockSession.updateOne(
                { _id: session._id },
                {
                    $set: {
                        completedAt,
                        score: totalScorePercent,
                        subjectBreakdown: finalBreakdown,
                        difficultyBreakdown: finalDiffBreakdown,
                        performanceDelta: totalPerformanceDelta,
                        weakestTopic,
                        percentile,
                        durationMinutes: Math.max(1, Math.round((completedAt - session.startedAt) / 60000))
                    }
                },
                { session: dbSession }
            );
        });

        // Behavioral update (non-blocking)
        const { updateStreakAndBehavior } = require('../services/behaviorService');
        updateStreakAndBehavior(userId).catch(err =>
            console.error('[BehaviorService] Non-blocking update failed:', err.message)
        );

        res.json({
            message: 'Mock test processed successfully.',
            summary: {
                totalScore: Math.round(totalScorePercent),
                correct: correctCount,
                total: session.questionCount,
                performanceDelta: Number(totalPerformanceDelta.toFixed(2)),
                timeSpentMinutes: Math.max(1, Math.round((new Date() - session.startedAt) / 60000)),
                subjectBreakdown: Object.fromEntries(finalBreakdown),
                difficultyBreakdown: Object.fromEntries(finalDiffBreakdown),
                weakestTopic,
                percentile,
                adaptiveConfig: session.adaptiveConfig
            }
        });

    } catch (err) {
        console.error('[MockEngine] Submission Failed:', err);
        res.status(500).json({ message: 'Engine Error: Submission processing failed.' });
    }
});

// ─── GET /api/mock/history ────────────────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
    try {
        const history = await MockSession.find({ userId: req.user.id, status: 'COMPLETED' })
            .sort({ completedAt: -1 })
            .select('-selectedQuestions')
            .lean();
        res.json(history);
    } catch (err) {
        console.error('[MockEngine] History Fetch Failed:', err);
        res.status(500).json({ message: 'Engine Error: Could not retrieve history.' });
    }
});

// ─── GET /api/mock/analytics ──────────────────────────────────────────────────
/**
 * Returns aggregate analytics across all completed mock sessions for a user.
 * Response:
 *   - averageScore
 *   - bestScore
 *   - latestScore
 *   - totalSessions
 *   - improvementTrend  (array of { date, score } last 10)
 *   - weakestRecurringTopic  ({ topic, subject, avgScore, occurrences })
 *   - difficultyAccuracy  (avg per EASY/MEDIUM/HARD across all sessions)
 *   - percentileHistory  (per session)
 */
router.get('/analytics', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const sessions = await MockSession.find({ userId, status: 'COMPLETED' })
            .sort({ completedAt: 1 })
            .select('score completedAt difficultyBreakdown weakestTopic percentile performanceDelta subjectBreakdown adaptiveConfig')
            .lean();

        if (sessions.length === 0) {
            return res.json({
                totalSessions: 0,
                averageScore: 0,
                bestScore: 0,
                latestScore: 0,
                improvementTrend: [],
                weakestRecurringTopic: null,
                difficultyAccuracy: {},
                percentileHistory: []
            });
        }

        const scores = sessions.map(s => s.score ?? 0);
        const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const bestScore = Math.max(...scores);
        const latestScore = scores[scores.length - 1];

        // Improvement trend (last 10)
        const improvementTrend = sessions.slice(-10).map(s => ({
            date: s.completedAt,
            score: Math.round(s.score ?? 0),
            performanceDelta: Number((s.performanceDelta ?? 0).toFixed(2))
        }));

        // Weakest recurring topic
        const topicStats = {};
        sessions.forEach(s => {
            if (s.weakestTopic?.topic) {
                const t = s.weakestTopic.topic;
                if (!topicStats[t]) topicStats[t] = { subject: s.weakestTopic.subject, totalScore: 0, count: 0 };
                topicStats[t].totalScore += s.weakestTopic.score ?? 0;
                topicStats[t].count++;
            }
        });

        let weakestRecurringTopic = null;
        let mostRecurrences = 0;
        for (const [topic, data] of Object.entries(topicStats)) {
            if (data.count > mostRecurrences) {
                mostRecurrences = data.count;
                weakestRecurringTopic = {
                    topic,
                    subject: data.subject,
                    avgScore: parseFloat((data.totalScore / data.count).toFixed(1)),
                    occurrences: data.count
                };
            }
        }

        // Aggregate difficulty accuracy across sessions
        const diffAgg = {};
        sessions.forEach(s => {
            if (!s.difficultyBreakdown) return;
            const map = s.difficultyBreakdown instanceof Map
                ? Object.fromEntries(s.difficultyBreakdown)
                : s.difficultyBreakdown;
            for (const [diff, data] of Object.entries(map)) {
                if (!diffAgg[diff]) diffAgg[diff] = { totalScore: 0, count: 0 };
                diffAgg[diff].totalScore += data.score ?? 0;
                diffAgg[diff].count++;
            }
        });
        const difficultyAccuracy = {};
        for (const [diff, agg] of Object.entries(diffAgg)) {
            difficultyAccuracy[diff] = {
                avgScore: parseFloat((agg.totalScore / agg.count).toFixed(1)),
                sessions: agg.count
            };
        }

        // Percentile history
        const percentileHistory = sessions.map(s => ({
            date: s.completedAt,
            percentile: s.percentile ?? null,
            score: Math.round(s.score ?? 0)
        }));

        res.json({
            totalSessions: sessions.length,
            averageScore: parseFloat(averageScore.toFixed(1)),
            bestScore: Math.round(bestScore),
            latestScore: Math.round(latestScore),
            improvementTrend,
            weakestRecurringTopic,
            difficultyAccuracy,
            percentileHistory
        });

    } catch (err) {
        console.error('[MockEngine] Analytics Failed:', err);
        res.status(500).json({ message: 'Engine Error: Could not compute analytics.' });
    }
});

module.exports = router;
