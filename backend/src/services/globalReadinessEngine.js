const TopicMastery = require('../models/TopicMastery');
const SubjectMastery = require('../models/SubjectMastery');
const UserProgress = require('../models/UserProgress');
const mongoose = require('mongoose');

// ... WEIGHTS and DEFAULT_WEIGHT remain same ...
const WEIGHTS = {
    'DSA': 0.40,
    'Backend': 0.25,
    'Core CS': 0.20,
    'Aptitude': 0.15
};
const DEFAULT_WEIGHT = 0.10;

/**
 * Rebuild Subject Mastery from Topic Masteries
 * @param {string} userId 
 */
const rebuildSubjectMastery = async (userId) => {
    // Aggregation pipeline to group topics by subject
    const aggregation = await TopicMastery.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: "$subject",
                avgProficiency: { $avg: "$proficiency" },
                count: { $sum: 1 }
            }
        }
    ]);

    if (!aggregation.length) return []; // No topics either

    // Upsert SubjectMastery
    const subjectUpdates = aggregation.map(agg => ({
        updateOne: {
            filter: { userId, subject: agg._id },
            update: {
                $set: {
                    averageMastery: agg.avgProficiency,
                    lastUpdated: new Date()
                },
                $setOnInsert: { totalTopics: agg.count } // Approximate
            },
            upsert: true
        }
    }));

    if (subjectUpdates.length > 0) {
        await SubjectMastery.bulkWrite(subjectUpdates);
    }

    // Return the new list
    return SubjectMastery.find({ userId });
};

/**
 * Calculate Global Readiness Score
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const calculateGlobalReadiness = async (userId) => {
    let subjects = await SubjectMastery.find({ userId });

    // Part 2: Auto Subject Sync
    if (!subjects || subjects.length === 0) {
        // Try to rebuild from Topics
        subjects = await rebuildSubjectMastery(userId);
    }

    // Part 3: Readiness Fallback Fix
    if (!subjects || subjects.length === 0) {
        // Log warning only if user has topics but failed to sync (edge case)
        // Check if user truly new?
        const topicCount = await TopicMastery.countDocuments({ userId });
        if (topicCount > 0) {
            console.warn(`Readiness Warning: User ${userId} has topics but no subject mastery even after rebuild.`);
        }

        return {
            readinessScore: 0,
            classification: 'Not Started',
            weakestSubject: 'N/A',
            strongestSubject: 'N/A',
            improvementTrend: 'None',
            breakdown: []
        };
    }

    let totalWeightedScore = 0;
    // ... rest of calculation logic ...
    let totalWeight = 0;
    let breakdown = [];

    subjects.forEach(sub => {
        let weight = WEIGHTS[sub.subject] || DEFAULT_WEIGHT;
        totalWeightedScore += (sub.averageMastery || 0) * weight;
        totalWeight += weight;

        breakdown.push({
            subject: sub.subject,
            mastery: sub.averageMastery || 0,
            weight: weight
        });
    });

    // Normalize
    // If totalWeight is not 1.0 (some subjects missing), should we penalize?
    // User Spec: "Compute weighted average". Assuming distinct subject presence.
    // Let's divide by totalWeight of PRESENT subjects? Or fixed 1.0?
    // If DSA (40%) is missing, score max is 60%. This IS the penalty.
    // So we don't normalize by totalWeight if we want to penalize missing subjects.
    // "Readiness" implies global scope.

    const readinessScore = Math.round(totalWeightedScore * 10) / 10;

    // Classification
    let classification = 'Needs Work';
    if (readinessScore >= 85) classification = 'Placement Ready';
    else if (readinessScore >= 70) classification = 'Strong';
    else if (readinessScore >= 55) classification = 'Improving';
    else if (readinessScore < 10) classification = 'Beginner'; // Refine low end

    // Sort
    breakdown.sort((a, b) => b.mastery - a.mastery);
    const strongestSubject = breakdown.length > 0 ? breakdown[0].subject : null;
    const weakestSubject = breakdown.length > 0 ? breakdown[breakdown.length - 1].subject : null;

    return {
        readinessScore,
        classification,
        strongestSubject,
        weakestSubject,
        breakdown
    };
};

const calculateLearningState = async (userId) => {
    // 1. Fetch recent quizzes for velocity
    // We need at least 10 quizzes to compare 5 vs 5
    const recentQuizzes = await UserProgress.find({ userId })
        .sort({ completedAt: -1 })
        .limit(15) // Fetch a few more for burnout check
        .select('quizScore quizTotal completedAt');

    let velocity = 0;
    let state = 'Stable';
    let action = 'Maintain consistency';

    // Velocity Calculation (Part 1)
    if (recentQuizzes.length >= 10) {
        const last5 = recentQuizzes.slice(0, 5);
        const prev5 = recentQuizzes.slice(5, 10);

        const avgLast5 = last5.reduce((sum, q) => sum + (q.quizScore / q.quizTotal * 100), 0) / 5;
        const avgPrev5 = prev5.reduce((sum, q) => sum + (q.quizScore / q.quizTotal * 100), 0) / 5;

        velocity = avgLast5 - avgPrev5;

        if (velocity > 5) { state = 'Improving Fast'; action = 'Increase difficulty'; }
        else if (velocity >= 1) { state = 'Improving'; action = 'Maintain momentum'; }
        else if (velocity <= -5) { state = 'Declining'; action = 'Reduce difficulty'; }
        else if (velocity <= -1) { state = 'Slight Plateau'; action = 'Focus on weak spots'; }
    }

    // Plateau Detection (Part 3)
    // If last 8 quizzes within +/- 3% band
    if (recentQuizzes.length >= 8) {
        const last8 = recentQuizzes.slice(0, 8).map(q => (q.quizScore / q.quizTotal * 100));
        const minScore = Math.min(...last8);
        const maxScore = Math.max(...last8);

        if ((maxScore - minScore) <= 6) { // +/- 3% means range of 6%
            state = 'Plateau';
            action = 'Try new topics or challenge mode';
        }
    }

    // Burnout Detection (Part 4)
    // High streak (>14) AND declining velocity AND increasing failure
    // Check streak first (assuming simple calc here or passed in, let's fetch roughly)
    // For MVP, we check just velocity and failures
    if (velocity < -2 && recentQuizzes.length >= 5) {
        // Check recent failures (score < 50%)
        const recentFailures = recentQuizzes.slice(0, 5).filter(q => (q.quizScore / q.quizTotal) < 0.5).length;
        if (recentFailures >= 2) {
            // If we had a streak checker here, we'd add it. 
            // Let's assume high volume means potential burnout
            state = 'Overtraining Risk';
            action = 'Reduce intensity for 3 days';
        }
    }

    return {
        velocity: Math.round(velocity * 10) / 10,
        learningState: state,
        recommendedAction: action
    };
};

module.exports = { calculateGlobalReadiness, calculateLearningState, rebuildSubjectMastery };
