const express = require('express');
const router = express.Router();
const DailyConcept = require('../models/DailyConcept');
const UserProgress = require('../models/UserProgress');
const TopicMastery = require('../models/TopicMastery');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/quiz/submit
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        const { quizId, score, answers } = req.body; // quizId is the lesson/concept ID
        const userId = req.user.id; // From authMiddleware

        if (!quizId || score === undefined) {
            return res.status(400).json({ message: 'Missing quizId or score' });
        }

        // 1. Fetch Lesson Data to verify and get Topic
        const lesson = await DailyConcept.findById(quizId);
        if (!lesson) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        const todayDate = new Date().toISOString().split('T')[0];

        // 2. Update/Create UserProgress
        // Check if already completed today?
        // Actually, we might allow multiple attempts but track the *best* or *first*?
        // Let's just create a new record for every attempt or update "best score"?
        // For streak, we just need *one* entry per day.

        // Let's upsert UserProgress for this lesson for this user.
        // If it exists, update score if better? Or just log a new attempt?

        // Decision: Upsert. One progress record per lesson per user.
        let progress = await UserProgress.findOne({ userId, lessonId: quizId });

        const quizTotal = lesson.quiz ? lesson.quiz.length : 0;

        if (progress) {
            // Update if score is better
            if (score > progress.quizScore) {
                progress.quizScore = score;
            }
            progress.completedAt = Date.now(); // Update timestamp
            progress.completedDate = todayDate; // Should match
            await progress.save();
        } else {
            progress = new UserProgress({
                userId,
                lessonId: quizId,
                quizScore: score,
                quizTotal,
                completedDate: todayDate,
                timeSpent: 0 // Frontend could send this
            });
            await progress.save();
        }

        // 3. Update TopicMastery
        // We need to calculate *change* in proficiency.
        // Simple logic:
        // +10 proficiency if 100% score
        // +5 if > 70%
        // -2 if < 40% (Maybe not punish too hard yet)

        const percentage = quizTotal > 0 ? (score / quizTotal) * 100 : 0;
        let proficiencyChange = 0;
        if (percentage === 100) proficiencyChange = 5;
        else if (percentage >= 70) proficiencyChange = 2;
        else if (percentage < 40) proficiencyChange = -1;

        await TopicMastery.findOneAndUpdate(
            { userId, topic: lesson.topic }, // Looking for main topic
            {
                $inc: {
                    proficiency: proficiencyChange,
                    totalAttempts: 1,
                    correctAttempts: percentage >= 70 ? 1 : 0
                },
                $set: { lastAttemptAt: Date.now(), subTopic: lesson.subject } // subTopic fallback
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Clamp proficiency between 0 and 100
        // Mongoose doesn't support $min/$max in $inc easily depending on version, 
        // so might need a second pass or aggregation pipeline update.
        // For MVP, we'll leave it or fetch-and-save.

        // Robust way: fetch and save
        const mastery = await TopicMastery.findOne({ userId, topic: lesson.topic });
        if (mastery.proficiency > 100) mastery.proficiency = 100;
        if (mastery.proficiency < 0) mastery.proficiency = 0;
        await mastery.save();

        res.json({
            message: 'Quiz submitted successfully',
            progress,
            proficiencyUpdate: proficiencyChange
        });

    } catch (err) {
        console.error('Quiz Submission Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
