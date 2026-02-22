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

/**
 * Helper to fetch questions for specified subjects based on weighted counts.
 */
async function getQuestionsForSubjects(userId, countMap) {
    const selected = [];
    for (const [subjectName, count] of Object.entries(countMap)) {
        if (count <= 0) continue;
        const concepts = await DailyConcept.find({ subject: subjectName });
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
                    correctAnswer: q.correctAnswer
                });
            });
        });

        // Shuffle pool
        pool.sort(() => 0.5 - Math.random());
        selected.push(...pool.slice(0, count));
    }
    return selected;
}

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

/**
 * POST /api/mock/start
 * Initializes a weighted, timed mock test.
 */
router.post('/start', auth, mockStartLimiter, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Concurrency Guard: Ensure no duplicate mock sessions
        const active = await MockSession.findOne({ userId, status: 'IN_PROGRESS' });
        if (active) {
            return res.status(400).json({
                message: 'A mock session is already in progress.',
                sessionId: active._id
            });
        }

        // 2. Weight Computation Strategy (Weakest Domain Bias)
        const masteries = await SubjectMastery.find({ userId }).sort({ averageMastery: 1 });
        if (masteries.length === 0) {
            return res.status(400).json({
                message: 'No performance history found. Complete initial quizzes to enable Mock Mode.'
            });
        }

        // Subject Segmentation
        const weakest = masteries[0].subject;
        const secondWeakest = masteries.length > 1 ? masteries[1].subject : weakest;
        const others = masteries.slice(2).map(m => m.subject);

        // Target Distribution: 50% weakest, 30% second poorest, 20% others
        const countMap = {};
        countMap[weakest] = 15;
        if (secondWeakest !== weakest) {
            countMap[secondWeakest] = 9;
        } else {
            countMap[weakest] += 9;
        }

        if (others.length > 0) {
            const perOther = Math.floor(6 / others.length);
            others.forEach(s => countMap[s] = perOther);
            // Residual distribution to weakest
            const totalAssigned = Object.values(countMap).reduce((a, b) => a + b, 0);
            if (totalAssigned < 30) countMap[weakest] += (30 - totalAssigned);
        } else {
            countMap[weakest] += 6;
        }

        const selectedQuestions = await getQuestionsForSubjects(userId, countMap);

        if (selectedQuestions.length < 5) {
            return res.status(400).json({
                message: 'Insufficient curriculum data to generate a valid mock test.'
            });
        }

        const session = new MockSession({
            userId,
            questionCount: selectedQuestions.length,
            selectedQuestions
        });

        await session.save();

        // Data Sanitization: Strip correct answers for the client
        const questionsForClient = selectedQuestions.map(q => ({
            id: `${q.conceptId}-${q.questionIndex}`,
            questionText: q.questionText,
            options: q.options,
            topic: q.topic,
            subject: q.subject
        }));

        res.json({
            sessionId: session._id,
            questions: questionsForClient,
            startedAt: session.startedAt,
            config: {
                totalQuestions: session.questionCount,
                timeLimitMinutes: 45 // V1 Default
            }
        });

    } catch (err) {
        console.error('[MockEngine] Start Failed:', err);
        res.status(500).json({ message: 'Engine Error: Mock generation failed.' });
    }
});

// POST /api/mock/submit
router.post('/submit', auth, submissionLimiter, validateBody(mockSubmitSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId, answers } = req.body;

        // 1. Atomic Status Guard: Prevent duplicate submissions and race conditions
        const session = await MockSession.findOneAndUpdate(
            { _id: sessionId, userId, status: 'IN_PROGRESS' },
            { $set: { status: 'COMPLETED' } }, // Lock the session immediately
            { returnDocument: 'after' }
        );

        if (!session) {
            return res.status(404).json({ message: 'Active mock session not found or already submitted.' });
        }

        // 2. Question Integrity Validation
        const sessionQuestionIds = new Set(session.selectedQuestions.map(q => `${q.conceptId}-${q.questionIndex}`));
        const submittedQuestionIds = Object.keys(answers);

        // Security Check: Ensure none of the submitted answers are for unrelated questions
        const hasTamperedIds = submittedQuestionIds.some(id => !sessionQuestionIds.has(id));
        if (hasTamperedIds) {
            return res.status(400).json({ message: 'Tampered answer set detected.' });
        }

        // 1. Grading & Analytics Logic
        let correctCount = 0;
        const breakdown = {}; // subject -> { correct, total }
        const topicPerformance = {}; // topic -> { correct, total, subject }

        session.selectedQuestions.forEach(q => {
            const answerKey = `${q.conceptId}-${q.questionIndex}`;
            const userAnswer = answers[answerKey];
            const isCorrect = (userAnswer !== undefined && userAnswer === q.correctAnswer);

            if (isCorrect) correctCount++;

            if (!breakdown[q.subject]) breakdown[q.subject] = { correct: 0, total: 0 };
            breakdown[q.subject].total++;
            if (isCorrect) breakdown[q.subject].correct++;

            if (!topicPerformance[q.topic]) topicPerformance[q.topic] = { correct: 0, total: 0, subject: q.subject };
            topicPerformance[q.topic].total++;
            if (isCorrect) topicPerformance[q.topic].correct++;
        });

        const totalScorePercent = (correctCount / session.questionCount) * 100;
        const finalBreakdown = new Map();
        for (const [sub, data] of Object.entries(breakdown)) {
            finalBreakdown.set(sub, {
                correct: data.correct,
                total: data.total,
                score: (data.correct / data.total) * 100
            });
        }

        let totalPerformanceDelta = 0;

        // 3. ATOMIC MULTI-UPDATE TRANSACTION
        await withTransaction(async (dbSession) => {
            // Update TopicMastery for each affected topic
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
                // Weighted Delta Logic: Mock has lower impact per question than daily quiz
                const delta = (topicScore - currentProf) * 0.25;
                const newMastery = Math.max(0, Math.min(100, currentProf + delta));

                totalPerformanceDelta += (newMastery - currentProf);

                await TopicMastery.updateOne(
                    { _id: topicMastery._id },
                    {
                        $set: {
                            mastery: newMastery,
                            lastAttemptAt: new Date()
                        },
                        $inc: {
                            totalAttempts: data.total,
                            correctAttempts: data.correct
                        }
                    }
                ).session(dbSession);
            }

            // Sync SubjectMastery (Readiness Aggregation)
            const affectedSubjects = Object.keys(breakdown);
            for (const subName of affectedSubjects) {
                const allSubTopics = await TopicMastery.find({ userId, subject: subName }).session(dbSession);

                const sumMastery = allSubTopics.reduce((acc, t) => acc + t.mastery, 0);
                const avgMastery = allSubTopics.length > 0 ? sumMastery / allSubTopics.length : 0;
                const masteredCount = allSubTopics.filter(t => t.mastery > 90).length;
                const attemptedCount = allSubTopics.reduce((acc, t) => acc + (t.totalAttempts > 0 ? 1 : 0), 0);

                await SubjectMastery.findOneAndUpdate(
                    { userId, subject: subName },
                    {
                        $set: {
                            averageMastery: avgMastery,
                            totalTopics: attemptedCount,
                            masteredTopics: masteredCount,
                            lastUpdated: Date.now()
                        },
                        $inc: { totalAttempts: 1 } // One mock session counts as 1 subject attempt
                    },
                    { upsert: true, session: dbSession }
                );
            }

            // Global Unlock Re-Evaluation (Ensures linear progression remains intact)
            await evaluateAndUpdateUnlocks(userId, dbSession);

            // Audit Trail
            await LearningEventLog.create([{
                userId,
                topicId: 'MOCK_TEST',
                subject: 'MULTI',
                eventType: 'MOCK_COMPLETED',
                previousMastery: 0,
                newMastery: totalScorePercent,
                delta: totalPerformanceDelta,
                meta: { sessionId, score: totalScorePercent, breakdown: Object.fromEntries(finalBreakdown) }
            }], { session: dbSession });

            // Finalize Session Fields inside transaction (status was already set to COMPLETED atomically)
            const completedAt = new Date();
            await MockSession.updateOne(
                { _id: session._id },
                {
                    $set: {
                        completedAt,
                        score: totalScorePercent,
                        subjectBreakdown: finalBreakdown,
                        performanceDelta: totalPerformanceDelta,
                        durationMinutes: Math.max(1, Math.round((completedAt - session.startedAt) / 60000))
                    }
                },
                { session: dbSession }
            );
        });

        // 🔥 Behavioral Intelligence: update streak + state (non-blocking)
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
                timeSpentMinutes: session.durationMinutes,
                subjectBreakdown: Object.fromEntries(finalBreakdown)
            }
        });

    } catch (err) {
        console.error('[MockEngine] Submission Failed:', err);
        res.status(500).json({ message: 'Engine Error: Submission processing failed.' });
    }
});

/**
 * GET /api/mock/history
 */
router.get('/history', auth, async (req, res) => {
    try {
        const history = await MockSession.find({ userId: req.user.id, status: 'COMPLETED' })
            .sort({ completedAt: -1 })
            .select('-selectedQuestions');
        res.json(history);
    } catch (err) {
        console.error('[MockEngine] History Fetch Failed:', err);
        res.status(500).json({ message: 'Engine Error: Could not retrieve history.' });
    }
});

module.exports = router;
