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

        // 1. Auto-initialize if empty
        const { initializeUserMasteryIfEmpty } = require('../services/masteryService');
        await initializeUserMasteryIfEmpty(userId);

        const [subjects, topics, mastery] = await Promise.all([
            require('../models/Subject').find().sort({ orderIndex: 1 }),
            require('../models/Topic').find().sort({ orderIndex: 1 }),
            TopicMastery.find({ userId })
        ]);

        // Map mastery to a lookup object
        const masteryMap = {};
        mastery.forEach(m => {
            masteryMap[m.topic] = m;
        });

        let curriculum;

        if (subjects.length > 0) {
            // Group topics by subject from DB
            curriculum = subjects.map(sub => {
                const subTopics = topics.filter(t => t.subject === sub.name);
                return {
                    module: sub.name,
                    topics: subTopics.map(t => {
                        const m = masteryMap[t.name] || { mastery: 0, unlocked: false, recommended: false };
                        let status = 'LOCKED';
                        if (m.unlocked) {
                            if (m.mastery >= 70) status = 'MASTERED';
                            else if (m.mastery <= 5) status = 'AVAILABLE';
                            else status = 'IN_PROGRESS';
                        }
                        return {
                            name: t.name,
                            mastery: m.mastery,
                            unlocked: m.unlocked,
                            recommended: m.recommended,
                            status
                        };
                    })
                };
            });
        } else {
            // Fallback to hardcoded structure
            curriculum = CURRICULUM_STRUCTURE.map(module => ({
                ...module,
                topics: module.topics.map(topicName => {
                    const m = masteryMap[topicName] || { mastery: 0, unlocked: false, recommended: false };
                    let status = 'LOCKED';
                    if (m.unlocked) {
                        if (m.mastery >= 70) status = 'MASTERED';
                        else if (m.mastery <= 5) status = 'AVAILABLE';
                        else status = 'IN_PROGRESS';
                    }
                    return {
                        name: topicName,
                        mastery: m.mastery,
                        unlocked: m.unlocked,
                        recommended: m.recommended,
                        status
                    };
                })
            }));
        }

        res.json(curriculum);
    } catch (err) {
        console.error('Curriculum Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
