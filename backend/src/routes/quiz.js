const express = require('express');
const router = express.Router();
const DailyConcept = require('../models/DailyConcept');
const UserProgress = require('../models/UserProgress');
const TopicMastery = require('../models/TopicMastery');
const authMiddleware = require('../middleware/authMiddleware');

const RevisionQueue = require('../models/RevisionQueue');
const SubjectMastery = require('../models/SubjectMastery');

const { submissionLimiter } = require('../middleware/rateLimiter');
const { validateBody } = require('../middleware/validateRequest');

const quizSubmissionSchema = {
    type: 'object',
    properties: {
        quizId: { type: 'string' },
        submissionId: { type: 'string' },
        answers: {
            type: 'object',
            additionalProperties: { type: 'string' }
        }
    },
    required: ['quizId', 'answers'],
    additionalProperties: false
};

// POST /api/quiz/submit
router.post('/submit', authMiddleware, submissionLimiter, validateBody(quizSubmissionSchema), async (req, res) => {
    try {
        const { quizId, answers, submissionId } = req.body;
        const userId = req.user.id;

        // --- IDEMPOTENCY CHECK ---
        const QuizSubmissionLog = require('../models/QuizSubmissionLog');
        if (submissionId) {
            const existingLog = await QuizSubmissionLog.findOne({ userId, submissionId });
            if (existingLog) {
                return res.json(existingLog.resultSnapshot);
            }
        }

        // 1. Fetch Lesson Data
        const lesson = await DailyConcept.findById(quizId);
        if (!lesson) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        // --- SERVER-SIDE SCORE CALCULATION ---
        let score = 0;
        const quizItems = lesson.quiz || [];
        quizItems.forEach((q, index) => {
            if (answers[index] === q.correctAnswer) {
                score++;
            }
        });

        const quizTotal = quizItems.length;
        const percentage = quizTotal > 0 ? (score / quizTotal) * 100 : 0;

        // 2. Update UserProgress (Log the attempt)
        const todayDate = new Date().toISOString().split('T')[0];
        let progress = await UserProgress.findOne({ userId, lessonId: quizId });
        if (progress) {
            if (score > progress.quizScore) progress.quizScore = score;
            progress.completedAt = Date.now();
            await progress.save();
        } else {
            progress = new UserProgress({
                userId,
                lessonId: quizId,
                quizScore: score,
                quizTotal,
                completedDate: todayDate
            });
            await progress.save();
        }

        // 3. ATOMIC INTELLIGENT MASTERY UPDATE (TRANSACTIONAL)
        const { withTransaction } = require('../utils/dbUtils');
        const { evaluateAndUpdateUnlocks } = require('../services/masteryService');

        let currentMastery = 0;
        let newMastery = 0;
        let actualDelta = 0;
        let change = 0;
        let newTrend = 'unknown';

        try {
            await withTransaction(async (session) => {
                // Fetch current state
                let topicMastery = await TopicMastery.findOne({ userId, topic: lesson.topic }).session(session);

                // Init if missing (Race condition safe with unique index + upsert)
                if (!topicMastery) {
                    topicMastery = await TopicMastery.findOneAndUpdate(
                        { userId, topic: lesson.topic },
                        {
                            $setOnInsert: {
                                subject: lesson.subject,
                                mastery: 0,
                                unlocked: true
                            }
                        },
                        { upsert: true, returnDocument: 'after', session }
                    );
                }

                // --- CALCULATION ENGINE ---
                currentMastery = topicMastery.mastery;
                change = 0;

                if (percentage >= 80) {
                    change = (100 - currentMastery) * 0.25;
                } else if (percentage >= 60) {
                    change = (100 - currentMastery) * 0.15;
                } else if (percentage >= 40) {
                    change = 0;
                } else {
                    change = -(currentMastery * 0.10);
                }

                if (currentMastery > 85 && change > 0) change = change * 0.5;

                const lastPracticed = topicMastery.lastAttemptAt ? new Date(topicMastery.lastAttemptAt) : new Date(0);
                const hoursSince = (Date.now() - lastPracticed.getTime()) / (1000 * 60 * 60);
                if (hoursSince < 72 && change > 0) change = change * 0.7;

                let finalChange = change;
                if (Math.abs(finalChange) > 40) finalChange = Math.round(finalChange * 0.7);

                newMastery = currentMastery + finalChange;
                const MIN_MASTERY_FLOOR = (topicMastery.failureCount || 0) > 3 ? 0 : 5;
                newMastery = Math.max(MIN_MASTERY_FLOOR, Math.min(100, newMastery));
                actualDelta = newMastery - currentMastery;

                let incCorrect = (percentage >= 70) ? 1 : 0;
                let incFailure = (percentage < 70) ? 1 : 0;
                let resetStreak = (percentage < 70);
                let resetFailure = (percentage >= 70);

                newTrend = 'stable';
                const scores = [...topicMastery.lastScores, percentage].slice(-5);
                if (scores.length >= 2) {
                    const recent = scores[scores.length - 1];
                    const previous = scores[scores.length - 2];
                    if (recent > previous + 5) newTrend = 'improving';
                    else if (recent < previous - 5) newTrend = 'declining';
                }

                const updateQuery = {
                    $set: {
                        mastery: newMastery,
                        lastAttemptAt: Date.now(),
                        averageScore: ((topicMastery.averageScore || 0) * topicMastery.totalAttempts + percentage) / (topicMastery.totalAttempts + 1),
                        trendDirection: newTrend
                    },
                    $inc: {
                        totalAttempts: 1,
                        correctAttempts: incCorrect
                    },
                    $push: {
                        lastScores: {
                            $each: [percentage],
                            $slice: -5
                        }
                    }
                };

                if (resetStreak) updateQuery.$set.successStreak = 0;
                else updateQuery.$inc.successStreak = 1;

                if (resetFailure) updateQuery.$set.failureCount = 0;
                else updateQuery.$inc.failureCount = 1;

                const updatedMastery = await TopicMastery.findByIdAndUpdate(
                    topicMastery._id,
                    updateQuery,
                    { returnDocument: 'after', session }
                );

                // 4. Update Subject Mastery
                const subjectTopics = await TopicMastery.find({
                    userId,
                    subject: lesson.subject,
                    lastAttemptAt: { $ne: null }
                }).session(session);

                const totalAttempted = subjectTopics.length;
                const sumMastery = subjectTopics.reduce((acc, t) => acc + t.mastery, 0);
                const avgMastery = totalAttempted > 0 ? sumMastery / totalAttempted : 0;
                const masteredCount = subjectTopics.filter(t => t.mastery > 90).length;

                await SubjectMastery.findOneAndUpdate(
                    { userId, subject: lesson.subject },
                    {
                        $set: {
                            averageMastery: avgMastery,
                            totalTopics: totalAttempted,
                            masteredTopics: masteredCount,
                            lastUpdated: Date.now()
                        },
                        $inc: { totalAttempts: 1 }
                    },
                    { upsert: true, session }
                );

                // 5. Revision Queue Logic
                if (percentage < 60) {
                    const priorityScore = (100 - newMastery) + (updatedMastery.failureCount * 5);
                    const daysToAdd = Math.min(updatedMastery.failureCount, 3);
                    const scheduledDate = new Date();
                    scheduledDate.setDate(scheduledDate.getDate() + daysToAdd);

                    await RevisionQueue.findOneAndUpdate(
                        { userId, topic: lesson.topic },
                        {
                            subject: lesson.subject,
                            priorityScore,
                            scheduledFor: scheduledDate,
                            resolved: false,
                            reason: 'failure_recovery'
                        },
                        { upsert: true, session }
                    );
                } else {
                    await RevisionQueue.findOneAndUpdate(
                        { userId, topic: lesson.topic, resolved: false },
                        { resolved: true },
                        { session }
                    );
                }

                const crossedThreshold = (currentMastery < 70 && newMastery >= 70);
                const significantDegrade = (currentMastery >= 70 && newMastery < 70);

                if (crossedThreshold || significantDegrade) {
                    await evaluateAndUpdateUnlocks(userId, session);
                }

                // LOG OBSERVABILITY EVENT
                const LearningEventLog = require('../models/LearningEventLog');
                await LearningEventLog.create([{
                    userId,
                    topicId: lesson.topic,
                    subject: lesson.subject,
                    eventType: 'QUIZ_SUBMIT',
                    previousMastery: currentMastery,
                    newMastery: newMastery,
                    delta: actualDelta,
                    trendDirection: newTrend,
                    meta: { quizId, score: percentage, submissionId }
                }], session ? { session } : {});

            });
        } catch (err) {
            console.error('Quiz Submission Failed:', err);
            return res.status(500).json({ message: 'Operation Failed: ' + err.message });
        }
        // Result Construction
        const finalResult = {
            message: 'Quiz submitted successfully',
            progress,
            masteryUpdate: {
                previous: currentMastery,
                current: newMastery,
                change: actualDelta,
                trend: newTrend
            }
        };

        // Save Idempotency Log
        if (submissionId) {
            const QuizSubmissionLog = require('../models/QuizSubmissionLog');
            await QuizSubmissionLog.create({
                userId,
                submissionId,
                topicId: lesson.topic,
                resultSnapshot: finalResult
            });
        }

        res.json(finalResult);

    } catch (err) {
        console.error('Quiz Submission Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
