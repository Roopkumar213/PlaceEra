const SubjectMastery = require('../models/SubjectMastery');
const TopicMastery = require('../models/TopicMastery');
const Topic = require('../models/Topic');
const RevisionQueue = require('../models/RevisionQueue');
const Track = require('../models/Track');
const { sortSubjectsByWeakness } = require('../utils/engineHelpers');

/**
 * Intelligent Recommendation Engine using Weakest Domain Philosophy (Day 3).
 * Identifies the subject where the user is struggling most and picks the optimal topic.
 * Now incorporates Track Weights for Multi-Track Adaptive Routing.
 * @param {string} userId
 */
const getWeakestDomainRecommendation = async (userId) => {
    try {
        // 1. Fetch SubjectMastery records and Track weights
        const [rawSubjectMasteries, tracks] = await Promise.all([
            SubjectMastery.find({ userId }),
            Track.find({})
        ]);

        if (!rawSubjectMasteries || rawSubjectMasteries.length === 0) {
            return null;
        }

        const trackWeights = {};
        tracks.forEach(t => trackWeights[t.name] = t.weight);

        // Use pure helper with track weights for deterministic sorting
        const sortedSubjects = sortSubjectsByWeakness(rawSubjectMasteries, trackWeights);

        // 2. Iterate subjects to find the best recommendation (Handles Case B Fallback)
        for (const weakestSubject of sortedSubjects) {
            const subjectName = weakestSubject.subject;

            // 2. Fetch all data for the weakest subject in parallel to avoid N+1
            const [allTopicsInSubject, topicMasteries, revisionEntries] = await Promise.all([
                Topic.find({ subject: subjectName }).sort({ orderIndex: 1 }),
                TopicMastery.find({ userId, subject: subjectName }),
                RevisionQueue.find({ userId, subject: subjectName, resolved: false }).sort({ priorityScore: -1 })
            ]);

            if (topicMasteries.length === 0) continue;

            const masteryMap = topicMasteries.reduce((acc, m) => {
                acc[m.topic] = m;
                return acc;
            }, {});

            const unlockedMasteries = topicMasteries.filter(m => m.unlocked);
            if (unlockedMasteries.length === 0) continue;

            // 3. Evaluation logic (REFINED PRIORITIES)

            // Priority 1: In-progress topics (5 < mastery < 70)
            const inProgress = unlockedMasteries
                .filter(m => m.mastery > 5 && m.mastery < 70)
                .sort((a, b) => a.mastery - b.mastery);

            if (inProgress.length > 0) {
                return {
                    subjectId: subjectName,
                    topicId: inProgress[0].topic,
                    subjectReadiness: weakestSubject.averageMastery ?? 0,
                    topicMastery: inProgress[0].mastery,
                    status: 'IN_PROGRESS',
                    reason: 'Weakest domain focus: Improving current progress'
                };
            }

            // Priority 2: REVISION (Critical failure recovery)
            // Reordered: Revision now outranks AVAILABLE
            if (revisionEntries.length > 0) {
                const topRevision = revisionEntries[0];
                const m = masteryMap[topRevision.topic];
                if (m && m.unlocked) {
                    return {
                        subjectId: subjectName,
                        topicId: topRevision.topic,
                        subjectReadiness: weakestSubject.averageMastery ?? 0,
                        topicMastery: m.mastery,
                        status: 'REVISION',
                        reason: 'Weakest domain focus: Critical revision needed'
                    };
                }
            }

            // Priority 3: AVAILABLE (New topics, mastery <= 5)
            const newTopics = unlockedMasteries
                .filter(m => m.mastery <= 5)
                .sort((a, b) => {
                    const topicA = allTopicsInSubject.find(t => t.name === a.topic);
                    const topicB = allTopicsInSubject.find(t => t.name === b.topic);
                    return (topicA?.orderIndex || 0) - (topicB?.orderIndex || 0);
                });

            if (newTopics.length > 0) {
                return {
                    subjectId: subjectName,
                    topicId: newTopics[0].topic,
                    subjectReadiness: weakestSubject.averageMastery ?? 0,
                    topicMastery: newTopics[0].mastery,
                    status: 'AVAILABLE',
                    reason: 'Weakest domain focus: Start new topic'
                };
            }

            // Priority 4: First unlocked topic (Fallback)
            const firstUnlocked = unlockedMasteries
                .sort((a, b) => {
                    const topicA = allTopicsInSubject.find(t => t.name === a.topic);
                    const topicB = allTopicsInSubject.find(t => t.name === b.topic);
                    return (topicA?.orderIndex || 0) - (topicB?.orderIndex || 0);
                })[0];

            if (firstUnlocked) {
                return {
                    subjectId: subjectName,
                    topicId: firstUnlocked.topic,
                    subjectReadiness: weakestSubject.averageMastery ?? 0,
                    topicMastery: firstUnlocked.mastery,
                    status: 'PRACTICE',
                    reason: 'Weakest domain focus: Regular practice'
                };
            }
        }

        // Global Fallback (Case A: All Mastered)
        const globalBest = await TopicMastery.findOne({ userId, unlocked: true }).sort({ mastery: 1 });
        if (globalBest) {
            return {
                subjectId: globalBest.subject,
                topicId: globalBest.topic,
                subjectReadiness: 100,
                topicMastery: globalBest.mastery,
                status: 'MAINTENANCE',
                reason: 'All domains strong: System maintenance'
            };
        }

        return null;
    } catch (err) {
        console.error('[RecommendationService] Error:', err);
        throw err;
    }
};

module.exports = {
    getWeakestDomainRecommendation
};
