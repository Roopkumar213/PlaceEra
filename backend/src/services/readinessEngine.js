const SubjectMastery = require('../models/SubjectMastery');

const { calculateOverallScore, SUBJECT_WEIGHTS } = require('../utils/engineHelpers');

/**
 * Calculates the overall readiness score for a user.
 * @param {string} userId 
 * @returns {Promise<{score: number, classification: string, details: object}>}
 */
const calculateReadiness = async (userId) => {
    const subjects = await SubjectMastery.find({ userId });

    const normalizedScore = calculateOverallScore(subjects);
    const roundedScore = Math.round(normalizedScore);

    const details = {};
    subjects.forEach(sub => {
        details[sub.subject] = {
            mastery: Math.round(sub.averageMastery ?? 0),
            weight: SUBJECT_WEIGHTS[sub.subject] || 0.1
        };
    });

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
