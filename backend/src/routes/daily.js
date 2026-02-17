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

        // --- ADAPTIVE STRATEGY ENGINE (Part 2) ---
        // Fetch Learning State
        const { calculateLearningState } = require('../services/globalReadinessEngine');
        const adaptiveState = await calculateLearningState(userId);
        console.log(`Adaptive State for ${userId}: ${adaptiveState.learningState} (Vel: ${adaptiveState.velocity})`);

        // Modify Probabilities based on State
        let probCritical = 35, probWeak = 30, probModerate = 20, probStrong = 10, probMastered = 5;
        let difficultyBias = 'Medium'; // Default

        if (adaptiveState.learningState === 'Improving Fast') {
            // Increase Hard/Strong/Mastered
            probCritical -= 10; probWeak -= 5;
            probStrong += 10; probMastered += 5;
            difficultyBias = 'Hard'; // Prefer Hard
        }
        else if (adaptiveState.learningState === 'Declining' || adaptiveState.learningState === 'Overtraining Risk') {
            // Reduce difficulty
            probCritical += 10; probWeak += 10;
            probModerate += 10; // Reinforce middle
            probStrong -= 15; probMastered -= 15; // Reduce hard
            difficultyBias = 'Easy';
        }
        else if (adaptiveState.learningState === 'Plateau') {
            // Mix Mode: 60% Moderate + 40% Weak
            probCritical = 0; probWeak = 40; probModerate = 60; probStrong = 0; probMastered = 0;
            difficultyBias = 'Medium';
        }

        // Weighted Selection Logic
        if (!targetTopicData) {
            // ... Fetch buckets code ...
            const masteryRecords = await TopicMastery.find({ userId });
            const masteryMap = {};
            masteryRecords.forEach(r => masteryMap[r.topic] = r.mastery);

            const buckets = { critical: [], weak: [], moderate: [], strong: [], mastered: [], new: [] };
            ROADMAP_TOPICS.forEach(item => {
                const m = masteryMap[item.topic];
                if (m === undefined) buckets.new.push(item);
                else if (m < 40) buckets.critical.push(item);
                else if (m < 60) buckets.weak.push(item);
                else if (m < 75) buckets.moderate.push(item);
                else if (m < 90) buckets.strong.push(item);
                else buckets.mastered.push(item);
            });
            buckets.critical.push(...buckets.new);

            // Apply Dynamic Probabilities
            const rand = Math.random() * 100;
            let selectedBucket = null;

            // Cumulative Thresholds
            const t1 = probCritical;
            const t2 = t1 + probWeak;
            const t3 = t2 + probModerate;
            const t4 = t3 + probStrong;

            if (rand < t1 && buckets.critical.length) selectedBucket = buckets.critical;
            else if (rand < t2 && buckets.weak.length) selectedBucket = buckets.weak;
            else if (rand < t3 && buckets.moderate.length) selectedBucket = buckets.moderate;
            else if (rand < t4 && buckets.strong.length) selectedBucket = buckets.strong;
            else if (buckets.mastered.length) selectedBucket = buckets.mastered;

            // Fallbacks... (same as before)
            if (!selectedBucket || selectedBucket.length === 0) {
                if (buckets.critical.length) selectedBucket = buckets.critical;
                else if (buckets.weak.length) selectedBucket = buckets.weak;
                else if (buckets.moderate.length) selectedBucket = buckets.moderate;
                else if (buckets.strong.length) selectedBucket = buckets.strong;
                else selectedBucket = buckets.mastered;
            }

            if (selectedBucket && selectedBucket.length > 0) {
                const idx = Math.floor(Math.random() * selectedBucket.length);
                targetTopicData = selectedBucket[idx];

                // Override difficulty based on bias
                if (difficultyBias === 'Hard') targetTopicData.difficulty = 'Hard';
                // Note: We are mutating local obj copy or ref? ROADMAP_TOPICS objects are ref. 
                // Better to clone.
                targetTopicData = { ...targetTopicData, difficulty: difficultyBias === 'Hard' ? 'Hard' : targetTopicData.difficulty };

                selectionReason = `weighted_bucket_${adaptiveState.learningState}`;
            } else {
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
