const SubjectMastery = require('../models/SubjectMastery');
const TopicMastery = require('../models/TopicMastery');
const Topic = require('../models/Topic');
const RevisionQueue = require('../models/RevisionQueue');

/**
 * Intelligent Recommendation Engine using Weakest Domain Philosophy (Day 3).
 * Identifies the subject where the user is struggling most and picks the optimal topic.
 * @param {string} userId
 */
const getWeakestDomainRecommendation = async (userId) => {
    try {
        // 1. Identify Weakest Subject
        // Fetch SubjectMastery records for the user
        const subjectMasteries = await SubjectMastery.find({ userId })
            .sort({
                averageMastery: 1,
                totalAttempts: 1,
                createdAt: 1
            });

        if (!subjectMasteries || subjectMasteries.length === 0) {
            return null;
        }

        const weakestSubject = subjectMasteries[0];
        const subjectName = weakestSubject.subject;

        // 2. Fetch all data for the weakest subject in parallel to avoid N+1
        const [allTopicsInSubject, topicMasteries, revisionEntries] = await Promise.all([
            Topic.find({ subject: subjectName }).sort({ orderIndex: 1 }),
            TopicMastery.find({ userId, subject: subjectName }),
            RevisionQueue.find({ userId, subject: subjectName, resolved: false })
        ]);

        const masteryMap = topicMasteries.reduce((acc, m) => {
            acc[m.topic] = m;
            return acc;
        }, {});

        const revisionSet = new Set(revisionEntries.map(r => r.topic));

        // 3. Evaluation logic (Step D)
        // Priority 1: In-progress topics (5 < mastery < 70)
        const inProgress = topicMasteries
            .filter(m => m.unlocked && m.mastery > 5 && m.mastery < 70)
            .sort((a, b) => a.mastery - b.mastery);

        if (inProgress.length > 0) {
            return {
                subjectId: subjectName,
                topicId: inProgress[0].topic,
                subjectReadiness: weakestSubject.averageMastery,
                topicMastery: inProgress[0].mastery,
                status: 'IN_PROGRESS',
                reason: 'Weakest domain focus: Improving current progress'
            };
        }

        // Priority 2: New topics (mastery <= 5)
        const newTopics = topicMasteries
            .filter(m => m.unlocked && m.mastery <= 5)
            .sort((a, b) => {
                // Find orderIndex from Topic model for sorting
                const topicA = allTopicsInSubject.find(t => t.name === a.topic);
                const topicB = allTopicsInSubject.find(t => t.name === b.topic);
                return (topicA?.orderIndex || 0) - (topicB?.orderIndex || 0);
            });

        if (newTopics.length > 0) {
            return {
                subjectId: subjectName,
                topicId: newTopics[0].topic,
                subjectReadiness: weakestSubject.averageMastery,
                topicMastery: newTopics[0].mastery,
                status: 'AVAILABLE',
                reason: 'Weakest domain focus: Start new topic'
            };
        }

        // Priority 3: Revision queue
        if (revisionEntries.length > 0) {
            // Sort revision entries by priority score DESC
            const topRevision = revisionEntries.sort((a, b) => b.priorityScore - a.priorityScore)[0];
            const m = masteryMap[topRevision.topic] || { mastery: 0 };
            return {
                subjectId: subjectName,
                topicId: topRevision.topic,
                subjectReadiness: weakestSubject.averageMastery,
                topicMastery: m.mastery,
                status: 'REVISION',
                reason: 'Weakest domain focus: Critical revision needed'
            };
        }

        // Priority 4: First unlocked topic (Fallback)
        const firstUnlocked = topicMasteries
            .filter(m => m.unlocked)
            .sort((a, b) => {
                const topicA = allTopicsInSubject.find(t => t.name === a.topic);
                const topicB = allTopicsInSubject.find(t => t.name === b.topic);
                return (topicA?.orderIndex || 0) - (topicB?.orderIndex || 0);
            })[0];

        if (firstUnlocked) {
            return {
                subjectId: subjectName,
                topicId: firstUnlocked.topic,
                subjectReadiness: weakestSubject.averageMastery,
                topicMastery: firstUnlocked.mastery,
                status: 'PRACTICE',
                reason: 'Weakest domain focus: Regular practice'
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
