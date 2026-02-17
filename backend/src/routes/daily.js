const express = require('express');
const router = express.Router();
const DailyConcept = require('../models/DailyConcept');
const AdminReview = require('../models/AdminReview');
const TopicMastery = require('../models/TopicMastery');
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

        // C. Weighted Buckets (Priority 3)
        if (!targetTopicData) {
            const masteryRecords = await TopicMastery.find({ userId });

            // Map records to check against ROADMAP
            const masteryMap = {};
            masteryRecords.forEach(r => masteryMap[r.topic] = r.mastery);

            // Classify Roadmap Topics
            const buckets = {
                critical: [], // < 40
                weak: [],     // 40-60
                moderate: [], // 60-75
                strong: [],   // 75-90
                mastered: [], // > 90
                new: []       // No record
            };

            ROADMAP_TOPICS.forEach(item => {
                const m = masteryMap[item.topic];
                if (m === undefined) buckets.new.push(item);
                else if (m < 40) buckets.critical.push(item);
                else if (m < 60) buckets.weak.push(item);
                else if (m < 75) buckets.moderate.push(item);
                else if (m < 90) buckets.strong.push(item);
                else buckets.mastered.push(item);
            });

            // If we have "New" topics and user hasn't started, prioritize them?
            // Or mix them into "Critical" (since 0 mastery). 
            // Let's treat "New" as "Critical" for now to get them started.
            buckets.critical.push(...buckets.new);

            // Weighted Selection
            // Probabilities: Critical 35%, Weak 30%, Moderate 20%, Strong 10%, Mastered 5%
            const rand = Math.random() * 100;
            let selectedBucket = null;

            if (rand < 35 && buckets.critical.length) selectedBucket = buckets.critical;
            else if (rand < 65 && buckets.weak.length) selectedBucket = buckets.weak; // 35+30
            else if (rand < 85 && buckets.moderate.length) selectedBucket = buckets.moderate; // 65+20
            else if (rand < 95 && buckets.strong.length) selectedBucket = buckets.strong; // 85+10
            else if (buckets.mastered.length) selectedBucket = buckets.mastered; // 95+5

            // Fallbacks if bucket empty
            if (!selectedBucket || selectedBucket.length === 0) {
                // Pick any from Critical -> Weak -> New -> Moderate
                if (buckets.critical.length) selectedBucket = buckets.critical;
                else if (buckets.weak.length) selectedBucket = buckets.weak;
                else if (buckets.moderate.length) selectedBucket = buckets.moderate;
                else if (buckets.strong.length) selectedBucket = buckets.strong;
                else selectedBucket = buckets.mastered;
            }

            if (selectedBucket && selectedBucket.length > 0) {
                const idx = Math.floor(Math.random() * selectedBucket.length);
                targetTopicData = selectedBucket[idx];
                selectionReason = 'weighted_bucket';
                console.log(`Adaptive: Selected ${targetTopicData.topic} via Weighted Bucket.`);
            } else {
                // Worst case fallback
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
