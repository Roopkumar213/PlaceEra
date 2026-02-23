const express = require('express');
const router = express.Router();
const TopicMastery = require('../models/TopicMastery');
const authMiddleware = require('../middleware/authMiddleware');

// Mock Curriculum Structure (This would ideally be in a DB)
const CURRICULUM_STRUCTURE = [
    {
        module: 'Foundations',
        track: 'DSA',
        topics: ['Big O Notation', 'Arrays & Strings', 'Basic Math']
    },
    {
        module: 'Data Structures',
        track: 'DSA',
        topics: ['Linked Lists', 'Stacks & Queues', 'Trees', 'Graphs', 'Hash Maps']
    },
    {
        module: 'Algorithms',
        track: 'DSA',
        topics: ['Sorting', 'Searching', 'Recursion', 'Dynamic Programming', 'Greedy']
    },
    {
        module: 'Quantitative Aptitude',
        track: 'APTITUDE',
        topics: ['Probability', 'Permutations', 'Time & Work', 'Ratio & Proportion']
    },
    {
        module: 'Logical Reasoning',
        track: 'APTITUDE',
        topics: ['Number Series', 'Blood Relations', 'Syllogism']
    },
    {
        module: 'Backend Development',
        track: 'DEV',
        topics: ['REST APIs', 'Database Design', 'Authentication', 'Caching']
    },
    {
        module: 'Cloud Fundamentals',
        track: 'DEVOPS',
        topics: ['Docker', 'CI/CD Pipelines', 'AWS Basics', 'Kubernetes']
    }
];

// GET /api/curriculum
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const trackFilter = req.query.track ? req.query.track.toUpperCase() : null;

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
            // Filter by track if requested
            const trackFilter = req.query.track ? req.query.track.toUpperCase() : null;
            let filteredSubjects = subjects;
            if (trackFilter) {
                // If subject doesn't have track defined, it counts as 'DSA'
                filteredSubjects = subjects.filter(s => (s.track || 'DSA') === trackFilter);
            }

            // Group topics by subject from DB
            curriculum = filteredSubjects.map(sub => {
                const subTopics = topics.filter(t => t.subject === sub.name);
                return {
                    module: sub.name,
                    track: sub.track || 'DSA',
                    cluster: sub.cluster || '',
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
            const trackFilter = req.query.track ? req.query.track.toUpperCase() : null;
            let filteredFallback = CURRICULUM_STRUCTURE;
            if (trackFilter) {
                // If subject doesn't have track defined, it counts as 'DSA'
                filteredFallback = CURRICULUM_STRUCTURE.filter(s => (s.track || 'DSA') === trackFilter);
            }

            curriculum = filteredFallback.map(module => ({
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
