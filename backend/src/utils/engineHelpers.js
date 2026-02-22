/**
 * Pure helper to evaluate the linear unlock progression.
 * Implements Monotonic Unlocks: Unlocks topics based on previous mastery thresholds.
 * @param {Array} topics - Ordered list of topics in a subject.
 * @param {Object} masteryMap - Map of user topic mastery { topicName: { mastery, unlocked } }
 * @returns {Array} - List of topics that need unlocking action.
 */
const evaluateUnlockState = (topics, masteryMap) => {
    let previousTopicMastered = true; // Seed true for the first topic
    const updates = [];

    for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        const currentRecord = masteryMap[topic.name];

        // Rule: Topic 0 is always unlocked. Topic N is unlocked if Topic N-1 mastery >= 70.
        const shouldBeUnlocked = (i === 0) || previousTopicMastered;

        if (shouldBeUnlocked) {
            // MONOTONIC INVARIANT: Only unlock if not already unlocked. Never relock.
            if (!currentRecord || !currentRecord.unlocked) {
                updates.push({
                    topic: topic.name,
                    subject: topic.subject,
                    type: currentRecord ? 'UNLOCK' : 'INITIALIZE'
                });
            }
        }

        // Update state for next topic
        if (currentRecord) {
            previousTopicMastered = currentRecord.mastery >= 70;
        } else {
            previousTopicMastered = false;
        }
    }

    return updates;
};

/**
 * Pure helper for recommendation tie-breaking logic.
 * Incorporates Track Weights: effective mastery = (real mastery) / (track weight).
 * Higher track weight lowers the effective mastery, making it "weaker" and prioritized.
 * @param {Array} subjects - List of subject mastery objects.
 * @param {Object} trackWeights - Map of { trackName: weightNumber }
 * @returns {Array} - Sorted list prioritizing heavily weighted, weak subjects.
 */
const sortSubjectsByWeakness = (subjects, trackWeights = {}) => {
    return [...subjects].sort((a, b) => {
        const weightA = trackWeights[a.track || 'DSA'] || 1.0;
        const weightB = trackWeights[b.track || 'DSA'] || 1.0;

        // Effective mastery is artificially reduced for high-weight tracks
        // making them appear "weaker" to the recommendation engine.
        const effMasteryA = (a.averageMastery ?? 0) / weightA;
        const effMasteryB = (b.averageMastery ?? 0) / weightB;

        if (effMasteryA !== effMasteryB) return effMasteryA - effMasteryB;

        const attemptsA = a.totalAttempts ?? 0;
        const attemptsB = b.totalAttempts ?? 0;
        if (attemptsA !== attemptsB) return attemptsA - attemptsB;

        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
};

const SUBJECT_WEIGHTS = {
    'Data Structures': 0.4,
    'Algorithms': 0.4,
    'Backend': 0.25,
    'Foundations': 0.2,
    'Programming Basics': 0.1
};

/**
 * Pure helper for overall readiness calculation.
 * @param {Array} subjects - List of SubjectMastery records.
 * @returns {number} - Normalized readiness score.
 */
const calculateOverallScore = (subjects) => {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    subjects.forEach(sub => {
        let weight = SUBJECT_WEIGHTS[sub.subject] || 0.1;
        totalWeightedScore += (sub.averageMastery ?? 0) * weight;
        totalWeight += weight;
    });

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
};

module.exports = {
    evaluateUnlockState,
    sortSubjectsByWeakness,
    calculateOverallScore,
    SUBJECT_WEIGHTS
};
