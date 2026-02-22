const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getWeakestDomainRecommendation } = require('../services/recommendationService');

/**
 * @route GET /api/recommendation
 * @desc Get the highly personalized topic recommendation based on weakest domain.
 * @access Private
 */
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const recommendation = await getWeakestDomainRecommendation(userId);

        if (!recommendation) {
            return res.status(404).json({ message: 'No recommendation available yet. Complete more quizzes!' });
        }

        res.json(recommendation);
    } catch (err) {
        console.error('[RecommendationAPI] Error:', err.message);
        res.status(500).json({ message: 'Server Error calculating recommendation' });
    }
});

module.exports = router;
