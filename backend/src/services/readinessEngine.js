const SubjectMastery = require('../models/SubjectMastery');

// Weights for different subjects
const SUBJECT_WEIGHTS = {
    'Data Structures': 0.4,
    'Algorithms': 0.4, // Map DSA to both or split? Plan said "DSA: 0.4"
    'Backend': 0.25,
    'Core CS': 0.2, // Foundations?
    'Aptitude': 0.15,
    'Foundations': 0.2, // Mapping 'Foundations' to 'Core CS' weight
    'Programming Basics': 0.1 // Low weight
};

/**
 * Calculates the overall readiness score for a user.
 * @param {string} userId 
 * @returns {Promise<{score: number, classification: string, details: object}>}
 */
const calculateReadiness = async (userId) => {
    const subjects = await SubjectMastery.find({ userId });

    let totalWeightedScore = 0;
    let totalWeight = 0;
    const details = {};

    subjects.forEach(sub => {
        // Find weight (default 0.1 if unknown)
        // Fuzzy match or exact?
        let weight = SUBJECT_WEIGHTS[sub.subject] || 0.1;

        // "DSA" in plan might mean "Data Structures" + "Algorithms"
        // Let's assume specific weights for now.

        totalWeightedScore += sub.averageMastery * weight;
        totalWeight += weight;

        details[sub.subject] = {
            mastery: Math.round(sub.averageMastery),
            weight
        };
    });

    // Normalize if totalWeight != 1 (though strictly it should be, but let's allow dynamic)
    const normalizedScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    const roundedScore = Math.round(normalizedScore);

    let classification = 'Needs Work';
    if (roundedScore >= 85) classification = 'Ready';
    else if (roundedScore >= 70) classification = 'Improving';
    else if (roundedScore >= 50) classification = 'Developing';

    return {
        score: roundedScore,
        classification,
        details
    };
};

module.exports = { calculateReadiness };
