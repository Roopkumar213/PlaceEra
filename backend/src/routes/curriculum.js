const express = require('express');
const router = express.Router();
const TopicMastery = require('../models/TopicMastery');
const authMiddleware = require('../middleware/authMiddleware');

// Mock Curriculum Structure (This would ideally be in a DB)
const CURRICULUM_STRUCTURE = [
    {
        module: 'Foundations',
        topics: ['Big O Notation', 'Arrays & Strings', 'Basic Math']
    },
    {
        module: 'Data Structures',
        topics: ['Linked Lists', 'Stacks & Queues', 'Trees', 'Graphs', 'Hash Maps']
    },
    {
        module: 'Algorithms',
        topics: ['Sorting', 'Searching', 'Recursion', 'Dynamic Programming', 'Greedy']
    }
];

// GET /api/curriculum
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const mastery = await TopicMastery.find({ userId });

        // Map mastery to a lookup object
        const masteryMap = {};
        mastery.forEach(m => {
            masteryMap[m.topic] = m.proficiency;
        });

        // Enrich curriculum with user status
        const curriculum = CURRICULUM_STRUCTURE.map(module => ({
            ...module,
            topics: module.topics.map(topic => ({
                name: topic,
                proficiency: masteryMap[topic] || 0,
                status: (masteryMap[topic] || 0) > 80 ? 'Mastered' : (masteryMap[topic] > 0 ? 'In Progress' : 'Locked') // Simple logic
            }))
        }));

        res.json(curriculum);
    } catch (err) {
        console.error('Curriculum Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
