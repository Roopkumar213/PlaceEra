const express = require('express');
const router = express.Router();
const DailyConcept = require('../models/DailyConcept');
const UserProgress = require('../models/UserProgress');
const TopicMastery = require('../models/TopicMastery');
const authMiddleware = require('../middleware/authMiddleware');

const RevisionQueue = require('../models/RevisionQueue');
const SubjectMastery = require('../models/SubjectMastery');
const { quizSubmissionSchema } = require('../utils/validationSchemas');

// POST /api/quiz/submit
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        // Validate input
        const validation = quizSubmissionSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: validation.error.errors.map(e => ({ field: e.path[0], message: e.message }))
            });
        }

        const { quizId, score, answers, submissionId } = validation.data;
        const userId = req.user.id; // From authMiddleware

        // --- IDEMPOTENCY CHECK ---
        const QuizSubmissionLog = require('../models/QuizSubmissionLog');
        if (submissionId) {
            const existingLog = await QuizSubmissionLog.findOne({ userId, submissionId });
            if (existingLog) {
                console.log(`🔁 Replaying idempotent submission: ${submissionId}`);
                return res.json(existingLog.resultSnapshot);
            }
        }

        // 1. Fetch Lesson Data
        const lesson = await DailyConcept.findById(quizId);
        if (!lesson) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        const todayDate = new Date().toISOString().split('T')[0];
        const quizTotal = lesson.quiz ? lesson.quiz.length : 0;
        const percentage = quizTotal > 0 ? (score / quizTotal) * 100 : 0;

        // 2. Update UserProgress (Log the attempt)
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

        // 3. ATOMIC INTELLIGENT MASTERY UPDATE (OCC)
        let retryCount = 0;
        let updateSuccess = false;

        // Variables for final response
        let currentMastery = 0;
        let newMastery = 0;
        let actualDelta = 0;
        let change = 0;
        let newTrend = 'unknown';

        const MAX_RETRIES = 3;

        while (!updateSuccess && retryCount < MAX_RETRIES) {
            try {
                // Fetch current state
                let topicMastery = await TopicMastery.findOne({ userId, topic: lesson.topic });

                // Init if missing
                if (!topicMastery) {
                    try {
                        topicMastery = new TopicMastery({
                            userId,
                            topic: lesson.topic,
                            subject: lesson.subject,
                            mastery: 0
                        });
                        await topicMastery.save();
                    } catch (e) {
                        // Race condition on insert? Fetch again.
                        topicMastery = await TopicMastery.findOne({ userId, topic: lesson.topic });
                    }
                }

                // --- CALCULATION ENGINE ---
                currentMastery = topicMastery.mastery;
                change = 0;

                // A. Base Weighting
                if (percentage >= 80) {
                    change = (100 - currentMastery) * 0.25;
                } else if (percentage >= 60) {
                    change = (100 - currentMastery) * 0.15;
                } else if (percentage >= 40) {
                    change = 0;
                } else {
                    change = -(currentMastery * 0.10);
                }

                // B. Diminishing Returns
                if (currentMastery > 85 && change > 0) change = change * 0.5;

                // C. Recency Penalty
                const lastPracticed = topicMastery.lastAttemptAt ? new Date(topicMastery.lastAttemptAt) : new Date(0);
                const hoursSince = (Date.now() - lastPracticed.getTime()) / (1000 * 60 * 60);
                if (hoursSince < 72 && change > 0) change = change * 0.7;

                // Guards
                let finalChange = change;
                if (Math.abs(finalChange) > 40) finalChange = Math.round(finalChange * 0.7);

                newMastery = currentMastery + finalChange;
                const MIN_MASTERY_FLOOR = (topicMastery.failureCount || 0) > 3 ? 0 : 5;
                newMastery = Math.max(MIN_MASTERY_FLOOR, Math.min(100, newMastery));
                actualDelta = newMastery - currentMastery;

                // Trend & Stats Ops
                let incCorrect = (percentage >= 70) ? 1 : 0;
                let incFailure = (percentage < 70) ? 1 : 0;
                let resetStreak = (percentage < 70);
                let resetFailure = (percentage >= 70);

                // Determine Trend
                newTrend = 'stable';
                const scores = [...topicMastery.lastScores, percentage].slice(-5);
                if (scores.length >= 2) {
                    const recent = scores[scores.length - 1];
                    const previous = scores[scores.length - 2];
                    if (recent > previous + 5) newTrend = 'improving';
                    else if (recent < previous - 5) newTrend = 'declining';
                }

                // Prepare Update Query
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

                // Conditional Resets - We use $set if resetting, else $inc
                if (resetStreak) updateQuery.$set.successStreak = 0;
                else updateQuery.$inc = { ...updateQuery.$inc, successStreak: 1 };

                if (resetFailure) updateQuery.$set.failureCount = 0;
                else updateQuery.$inc = { ...updateQuery.$inc, failureCount: 1 };


                // EXECUTE UPDATE with Version Check
                const result = await TopicMastery.findOneAndUpdate(
                    { _id: topicMastery._id, __v: topicMastery.__v },
                    updateQuery,
                    { new: true }
                );

                if (result) {
                    updateSuccess = true;
                    // Async Log will happen after this block

                    // 4. Update Subject Mastery (Aggregation-like)
                    const subjectTopics = await TopicMastery.find({ userId, subject: lesson.subject });
                    const totalTopics = subjectTopics.length;
                    const sumMastery = subjectTopics.reduce((acc, t) => acc + t.mastery, 0);
                    const avgMastery = totalTopics > 0 ? sumMastery / totalTopics : 0;
                    const masteredCount = subjectTopics.filter(t => t.mastery > 90).length;

                    await SubjectMastery.findOneAndUpdate(
                        { userId, subject: lesson.subject },
                        {
                            averageMastery: avgMastery,
                            totalTopics: totalTopics,
                            masteredTopics: masteredCount,
                            lastUpdated: Date.now()
                        },
                        { upsert: true }
                    );

                    // 5. Revision Queue Logic
                    if (percentage < 60) {
                        const priorityScore = (100 - newMastery) + (result.failureCount * 5);
                        const daysToAdd = Math.min(result.failureCount, 3);
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
                            { upsert: true }
                        );
                    } else {
                        await RevisionQueue.findOneAndUpdate(
                            { userId, topic: lesson.topic, resolved: false },
                            { resolved: true }
                        );
                    }

                    // LOG OBSERVABILITY EVENT (Async, non-blocking)
                    const LearningEventLog = require('../models/LearningEventLog');
                    LearningEventLog.create({
                        userId,
                        topicId: lesson.topic,
                        subject: lesson.subject,
                        eventType: 'QUIZ_SUBMIT',
                        previousMastery: currentMastery,
                        newMastery: newMastery,
                        delta: actualDelta,
                        trendDirection: newTrend,
                        meta: { quizId, score: percentage, submissionId }
                    }).catch(err => console.error('Observability Log Failed:', err.message));

                } else {
                    retryCount++;
                    await new Promise(res => setTimeout(res, 50 * retryCount));
                }

            } catch (err) {
                console.error('Update Error:', err);
                break;
            }
        }

        if (!updateSuccess) {
            return res.status(409).json({ message: 'Conflict: Please retry submission.' });
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
