const express = require('express');
const router = express.Router();
const DailyConcept = require('../models/DailyConcept');
const AdminReview = require('../models/AdminReview');
const TopicMastery = require('../models/TopicMastery');
const mongoose = require('mongoose');
const RevisionQueue = require('../models/RevisionQueue');
const authMiddleware = require('../middleware/authMiddleware');
const { generateLesson } = require('../services/llmService');
const { validateLesson } = require('../utils/validateLesson');

// Hardcoded roadmap topics for now since no Roadmap model exists
// In a real system, we'd fetch from a Roadmap collection or similar.
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
 * GET /api/today
 * Retrieves or generates the daily lesson using Adaptive Intelligence.
 */
router.get('/today', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Check if DailyConcept already exists for today (Global or Personal?)
        // The original design seemed global (one lesson for everyone).
        // But "Adaptive" implies personalized. 
        // If we generate a lesson for "Arrays" but the user needs "Variables", we can't share.
        // So we strictly look for a personalized DailyConcept OR we just generate/fetch a concept for the target topic.
        // Let's assume we can reuse concepts if they exist for the topic, regardless of date.

        // Strategy:
        // 1. Determine Target Topic for User.
        // 2. Look for existing DailyConcept for that topic.
        // 3. If none, generate one.

        // --- ADAPTIVE SELECTION ENGINE ---
        let targetTopicData = null;
        let selectionReason = 'adaptive_rotation';

        // A. Revision Queue (Priority 1)
        const revisionItem = await RevisionQueue.findOne({
            userId,
            resolved: false,
            scheduledFor: { $lte: new Date() }
        }).sort({ priorityScore: -1 });

        if (revisionItem) {
            targetTopicData = { topic: revisionItem.topic, subject: revisionItem.subject, difficulty: 'Medium' };
            selectionReason = 'revision_queue';
            console.log(`Adaptive: Selected ${targetTopicData.topic} from Revision Queue.`);
        }

        // B. Forced Resurfacing (Priority 2)
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
                console.log(`Adaptive: Selected ${targetTopicData.topic} for Forced Resurfacing.`);
            }
        }

        // C. Weighted Buckets (Priority 3) — OPTIMIZED AGGREGATION
        // C. Weighted Buckets (Priority 3) — OPTIMIZED AGGREGATION
        if (!targetTopicData) {
            // Aggregation to Select Topic with weighted bias directly.
            // 1. Label Buckets
            // 2. Sample from each bucket? 
            // Better: Get counts, decide bucket validity, then query specific bucket.
            // Querying all topics just to bucket them is still expensive (100k items).

            // We can't do random weighted selection purely in one agg pipeline easily without fetching all.
            // HYBRID APPROACH:
            // 1. Facet to get counts of each bucket (Fast index scan if covered)
            // 2. Roll dice to pick bucket.
            // 3. $sample ONE document from that bucket.

            const bucketCounts = await TopicMastery.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId) } },
                {
                    $project: {
                        bucket: {
                            $switch: {
                                branches: [
                                    { case: { $lt: ['$mastery', 40] }, then: 'critical' },
                                    { case: { $lt: ['$mastery', 60] }, then: 'weak' },
                                    { case: { $lt: ['$mastery', 80] }, then: 'moderate' },
                                    { case: { $lt: ['$mastery', 95] }, then: 'strong' }
                                ],
                                default: 'mastered'
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: '$bucket',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const map = { critical: 0, weak: 0, moderate: 0, strong: 0, mastered: 0 };
            bucketCounts.forEach(b => map[b._id] = b.count);

            // Determine Target Bucket
            const rand = Math.random() * 100;
            let targetBucket = 'critical';

            // Probabilities: Critical 35%, Weak 30%, Moderate 20%, Strong 10%, Mastered 5%
            if (rand < 35 && map.critical) targetBucket = 'critical';
            else if (rand < 65 && map.weak) targetBucket = 'weak';
            else if (rand < 85 && map.moderate) targetBucket = 'moderate';
            else if (rand < 95 && map.strong) targetBucket = 'strong';
            else if (map.mastered) targetBucket = 'mastered';
            else {
                // Fallback to whatever exists
                if (map.critical) targetBucket = 'critical';
                else if (map.weak) targetBucket = 'weak';
                else if (map.moderate) targetBucket = 'moderate';
                else if (map.strong) targetBucket = 'strong';
                else targetBucket = 'mastered';
            }

            // Fetch ONE topic from this bucket using $sample
            let rangeBefore = 0;
            let rangeAfter = 0;

            switch (targetBucket) {
                case 'critical': rangeBefore = 0; rangeAfter = 40; break;
                case 'weak': rangeBefore = 40; rangeAfter = 60; break;
                case 'moderate': rangeBefore = 60; rangeAfter = 80; break;
                case 'strong': rangeBefore = 80; rangeAfter = 95; break;
                case 'mastered': rangeBefore = 95; rangeAfter = 101; break;
            }

            // Optimization: If map[targetBucket] is 0, we might need a backup plan (handled by fallback logic above)
            // But if ALL are 0 (New user?), we default to roadmap.

            if (map[targetBucket] > 0) {
                const samples = await TopicMastery.aggregate([
                    {
                        $match: {
                            userId: new mongoose.Types.ObjectId(userId),
                            mastery: { $gte: rangeBefore, $lt: rangeAfter } // Use range
                        }
                    },
                    { $sample: { size: 1 } },
                    { $project: { topic: 1, subject: 1 } }
                ]);

                if (samples.length > 0) {
                    targetTopicData = samples[0];
                    targetTopicData.difficulty = 'Medium'; // Default
                    selectionReason = `weighted_bucket_${targetBucket}`;
                    console.log(`Adaptive: Selected ${targetTopicData.topic} from ${targetBucket} bucket.`);
                }
            }

            // Fallback for Cold Start or empty DB
            if (!targetTopicData) {
                // Check New Topics? (Not in DB)
                // Just pick from Roadmap
                targetTopicData = ROADMAP_TOPICS[0];
            }
        }

        // --- GENERATION / FETCHING ---
        // Try to find a recent concept for this topic (reuse efficiently)
        // logic: find one created in last 24h? Or just any? 
        // A "Daily Concept" technically refreshes daily. 
        // Let's find *any* existing DailyConcept for this topic to save LLM costs, 
        // OR generate new if we want fresh content every time.
        // For MVP, if one exists for this topic, reuse it.

        let dailyConcept = await DailyConcept.findOne({ topic: targetTopicData.topic }).sort({ createdAt: -1 });

        // If it's too old or doesn't exist, generate.
        // Let's say "too old" is > 30 days? Or just always reuse if found?
        // Let's generate if not found.

        if (!dailyConcept) {
            const startTime = Date.now();
            console.log(`Generating NEW content for ${targetTopicData.topic}...`);

            let lessonData;
            try {
                lessonData = await generateLesson(targetTopicData.topic, targetTopicData.subject, targetTopicData.difficulty);
                const validation = validateLesson(lessonData);

                if (validation.isValid) {
                    dailyConcept = new DailyConcept(lessonData);
                    await dailyConcept.save();
                } else {
                    throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
                }
            } catch (err) {
                console.error("Generation failed:", err);
                // Fallback to error
                return res.status(500).json({ error: "Failed to generate lesson content." });
            }
        }

        // Guard: Duplicate Prevention (Phase 6)
        // Check if we selected this topic yesterday (Rotation Log)
        const LearningEventLog = require('../models/LearningEventLog');
        const yesterday = new Date(Date.now() - 86400000);

        // If not from Revision Queue (which overrides duplicates), check history
        if (selectionReason !== 'revision_queue') {
            const lastRotation = await LearningEventLog.findOne({
                userId,
                eventType: 'ROTATION_SELECTED',
                timestamp: { $gt: yesterday }
            }).sort({ timestamp: -1 });

            if (lastRotation && lastRotation.topicId === targetTopicData.topic) {
                console.log(`⚠️ Prevented duplicate topic: ${targetTopicData.topic}. Reselecting...`);
                // Simple fallback: pick random from roadmap that isn't this one
                const candidates = ROADMAP_TOPICS.filter(t => t.topic !== targetTopicData.topic);
                if (candidates.length > 0) {
                    const fallback = candidates[Math.floor(Math.random() * candidates.length)];
                    targetTopicData = fallback;
                    selectionReason = 'duplicate_prevention_fallback';
                }
            }
        }

        // LOG OBSERVABILITY EVENT
        // We log *before* generating potential errors so we track intent
        LearningEventLog.create({
            userId,
            topicId: targetTopicData.topic,
            subject: targetTopicData.subject,
            eventType: 'ROTATION_SELECTED',
            previousMastery: 0, // Not applicable
            newMastery: 0,
            delta: 0,
            meta: { selectionReason }
        }).catch(err => console.error('Observability Log Failed:', err.message));

        // Return the concept
        res.json({
            ...dailyConcept.toObject(),
            meta: {
                selectionReason,
                topic: targetTopicData.topic
            }
        });

    } catch (err) {
        console.error('Server Error in /today:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
