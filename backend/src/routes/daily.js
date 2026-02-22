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

const ROADMAP_TOPICS = [
    { topic: 'Variables', subject: 'Programming Basics', difficulty: 'Easy' },
    { topic: 'Loops', subject: 'Programming Basics', difficulty: 'Easy' },
    { topic: 'Functions', subject: 'Programming Basics', difficulty: 'Medium' },
    { topic: 'Arrays', subject: 'Data Structures', difficulty: 'Medium' },
    { topic: 'Objects', subject: 'Data Structures', difficulty: 'Medium' },
    { topic: 'Recursion', subject: 'Algorithms', difficulty: 'Hard' },
    { topic: 'Sorting', subject: 'Algorithms', difficulty: 'Medium' },
    { topic: 'Big O', subject: 'Foundations', difficulty: 'Medium' }
];

/**
 * GET /daily/session
 * Replaces /daily/topic and /daily/questions
 */
router.get('/daily/session', authMiddleware, async (req, res) => {
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

        // --- SELECTION ENGINE ---
        let targetTopicData = null;
        let selectionReason = 'adaptive_rotation';

        // A. Revision Queue
        const revisionItem = await RevisionQueue.findOne({
            userId,
            resolved: false,
            scheduledFor: { $lte: new Date() }
        }).sort({ priorityScore: -1 });

        if (revisionItem) {
            targetTopicData = { topic: revisionItem.topic, subject: revisionItem.subject, difficulty: 'Medium' };
            selectionReason = 'revision_queue';
        }

        // B. Forced Resurfacing
        if (!targetTopicData) {
            const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
            const staleMaster = await TopicMastery.findOne({
                userId,
                mastery: { $gt: 90 },
                lastAttemptAt: { $lt: fourteenDaysAgo }
            });

            if (staleMaster) {
                targetTopicData = { topic: staleMaster.topic, subject: staleMaster.subject, difficulty: 'Hard' };
                selectionReason = 'forced_resurfacing';
            }
        }

        // C. Weighted Buckets
        if (!targetTopicData) {
            const Track = require('../models/Track');
            const Subject = require('../models/Subject');

            const dsaSubjects = await Subject.find({ track: { $in: ['DSA', null, ''] } }).lean();
            const dsaSubjectNames = dsaSubjects.map(s => s.name);

            const getTopicFromPool = async (subjectNames, fallbackList) => {
                if (subjectNames.length === 0) return fallbackList[0];

                const bucketCounts = await TopicMastery.aggregate([
                    { $match: { userId: new mongoose.Types.ObjectId(userId), subject: { $in: subjectNames } } },
                    {
                        $project: {
                            bucket: {
                                $switch: {
                                    branches: [
                                        { case: { $lt: ['$mastery', 40] }, then: 'critical' },
                                        { case: { $lt: ['$mastery', 60] }, then: 'weak' },
                                        { case: { $lt: ['$mastery', 80] }, then: 'moderate' },
                                        { case: { $lt: ['$mastery', 95] }, then: 'strong' }
                                    ], default: 'mastered'
                                }
                            }
                        }
                    },
                    { $group: { _id: '$bucket', count: { $sum: 1 } } }
                ]);

                const map = { critical: 0, weak: 0, moderate: 0, strong: 0, mastered: 0 };
                bucketCounts.forEach(b => map[b._id] = b.count);

                const rand = Math.random() * 100;
                let targetBucket = 'critical';

                if (rand < 35 && map.critical) targetBucket = 'critical';
                else if (rand < 65 && map.weak) targetBucket = 'weak';
                else if (rand < 85 && map.moderate) targetBucket = 'moderate';
                else if (rand < 95 && map.strong) targetBucket = 'strong';
                else if (map.mastered) targetBucket = 'mastered';
                else targetBucket = Object.keys(map).find(k => map[k] > 0) || 'critical';

                let rangeBefore = 0, rangeAfter = 0;
                switch (targetBucket) {
                    case 'critical': rangeBefore = 0; rangeAfter = 40; break;
                    case 'weak': rangeBefore = 40; rangeAfter = 60; break;
                    case 'moderate': rangeBefore = 60; rangeAfter = 80; break;
                    case 'strong': rangeBefore = 80; rangeAfter = 95; break;
                    case 'mastered': rangeBefore = 95; rangeAfter = 101; break;
                }

                if (map[targetBucket] > 0) {
                    const samples = await TopicMastery.aggregate([
                        { $match: { userId: new mongoose.Types.ObjectId(userId), subject: { $in: subjectNames }, mastery: { $gte: rangeBefore, $lt: rangeAfter } } },
                        { $sample: { size: 1 } },
                        { $project: { topic: 1, subject: 1 } }
                    ]);
                    if (samples.length > 0) return { ...samples[0], difficulty: 'Medium', bucket: targetBucket };
                }
                return fallbackList[0];
            };

            targetTopicData = await getTopicFromPool(dsaSubjectNames, ROADMAP_TOPICS);
            selectionReason = `weighted_bucket_primary_${targetTopicData.bucket || 'fallback'}`;
        }

        const cluster = targetTopicData.subject;
        const topic = targetTopicData.topic;

        // FETCH QUESTIONS
        let lessonData;
        try {
            lessonData = await generateLesson(topic, cluster, targetTopicData.difficulty);
        } catch (err) {
            console.error("Failed to generate session content:", err);
            return res.status(500).json({ error: "Failed to generate session content." });
        }

        let questions = lessonData.questions || [];
        let codingQuestions = lessonData.codingQuestions || [];

        // Fallback backward compatibility with old quiz structure from mock tests
        if (questions.length === 0 && lessonData.quiz) {
            questions = lessonData.quiz.map((q, i) => ({
                id: `q${i}`,
                question: q.question,
                options: q.options,
                correctAnswer: q.correctAnswer
            }));
        }

        const behavior = await computeBehavioralState(userId);

        const expiresAt = new Date();
        expiresAt.setUTCHours(23, 59, 59, 999);

        session = new DailySession({
            userId,
            dateString: todayStr,
            cluster: cluster,
            topic: topic,
            reason: selectionReason,
            streakMeta: { streakDays: user?.streak || 0 },
            behavioralState: behavior.state,
            expiresAt,
            questions,
            codingQuestions
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
