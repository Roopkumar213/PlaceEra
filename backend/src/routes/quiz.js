const express = require('express');
const router = express.Router();
const DailyConcept = require('../models/DailyConcept');
const UserProgress = require('../models/UserProgress');
const TopicMastery = require('../models/TopicMastery');
const authMiddleware = require('../middleware/authMiddleware');

const RevisionQueue = require('../models/RevisionQueue');
const SubjectMastery = require('../models/SubjectMastery');

// POST /api/quiz/submit
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        const { quizId, score, answers } = req.body;
        const userId = req.user.id; // From authMiddleware

        if (!quizId || score === undefined) {
            return res.status(400).json({ message: 'Missing quizId or score' });
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
        // Always create a new progress record for history tracking (Part of "Trend Awareness" - raw data)
        // Or update generic stats? Plan said "Update UserProgress".
        // Let's upsert for the day to avoid duplicate daily records, but maybe we want every attempt?
        // For simplicity and "Trend Awareness", let's keep one record per lesson per day, but update stats.

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

        // 3. Intelligent Mastery Update
        let topicMastery = await TopicMastery.findOne({ userId, topic: lesson.topic });

        if (!topicMastery) {
            topicMastery = new TopicMastery({
                userId,
                topic: lesson.topic,
                subject: lesson.subject,
                mastery: 0
            });
        }

        // --- CALCULATION ENGINE ---
        const currentMastery = topicMastery.mastery;
        let change = 0;

        // A. Base Weighting
        if (percentage >= 80) {
            // (100 - mastery) * 0.25 ==> If mastery is 0, gain 25. If 90, gain 2.5
            change = (100 - currentMastery) * 0.25;
        } else if (percentage >= 60) {
            // (100 - mastery) * 0.15
            change = (100 - currentMastery) * 0.15;
        } else if (percentage >= 40) {
            // No change (Stagnation)
            change = 0;
        } else {
            // Decay: mastery * 0.10
            change = -(currentMastery * 0.10);
        }

        // B. Diminishing Returns (Anti-Gaming)
        // If mastery > 85, reduce positive gain by 50%
        if (currentMastery > 85 && change > 0) {
            change = change * 0.5;
        }

        // C. Recency Penalty
        // If practiced within last 3 days, reduce positive gain by 30%
        const lastPracticed = topicMastery.lastAttemptAt ? new Date(topicMastery.lastAttemptAt) : new Date(0);
        const hoursSince = (Date.now() - lastPracticed.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 72 && change > 0) {
            change = change * 0.7;
        }

        // Apply Change
        let newMastery = currentMastery + change;
        // Clamp
        if (newMastery > 100) newMastery = 100;
        if (newMastery < 0) newMastery = 0;

        // --- TREND ANALYSIS ---
        // Push new score (percentage) to lastScores
        topicMastery.lastScores.push(percentage);
        if (topicMastery.lastScores.length > 5) {
            topicMastery.lastScores.shift(); // Keep last 5
        }

        // Calculate Average Score
        // Re-calculate average score based on stored weighted avg or just simple approximation?
        // Simple approx: ((oldAvg * count) + newScore) / (count + 1)
        const totalAttempts = topicMastery.totalAttempts || 0;
        const oldAvg = topicMastery.averageScore || 0;
        const newAvg = ((oldAvg * totalAttempts) + percentage) / (totalAttempts + 1);
        topicMastery.averageScore = newAvg;

        // Determine Trend Logic (Simple Slope or Comparison)
        if (topicMastery.lastScores.length >= 2) {
            const recent = topicMastery.lastScores[topicMastery.lastScores.length - 1];
            const previous = topicMastery.lastScores[topicMastery.lastScores.length - 2];
            if (recent > previous + 5) topicMastery.trendDirection = 'improving';
            else if (recent < previous - 5) topicMastery.trendDirection = 'declining';
            else topicMastery.trendDirection = 'stable';
        }

        // Update Stats
        topicMastery.mastery = newMastery;
        topicMastery.lastAttemptAt = Date.now();
        topicMastery.totalAttempts += 1;
        if (percentage >= 70) {
            topicMastery.correctAttempts += 1;
            topicMastery.successStreak += 1;
            topicMastery.failureCount = 0;
        } else {
            topicMastery.successStreak = 0;
            topicMastery.failureCount += 1;
        }

        await topicMastery.save();

        // 4. Update Subject Mastery (Aggregation)
        // We recalculate this subject's avg mastery
        // This could be heavy if many topics. For MVP, we do it.
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
        // If score < 60, push to revision queue
        if (percentage < 60) {
            const priorityScore = (100 - newMastery) + (topicMastery.failureCount * 5);

            // Scheduling: 
            // If failureCount = 1 -> Tomorrow
            // If failureCount = 2 -> +2 Days
            // ...
            const daysToAdd = Math.min(topicMastery.failureCount, 3);
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
            // If score >= 60, mark resolved if exists
            await RevisionQueue.findOneAndUpdate(
                { userId, topic: lesson.topic, resolved: false },
                { resolved: true }
            );
        }

        res.json({
            message: 'Quiz submitted successfully',
            progress,
            masteryUpdate: {
                previous: currentMastery,
                current: newMastery,
                change: change,
                trend: topicMastery.trendDirection
            }
        });

    } catch (err) {
        console.error('Quiz Submission Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
