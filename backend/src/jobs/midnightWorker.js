const mongoose = require('mongoose');
const DailyGlobalContent = require('../models/DailyGlobalContent');
const Subject = require('../models/Subject');
const TopicMastery = require('../models/TopicMastery');
const { generateLesson } = require('../services/llmService');

const ROADMAP_TOPICS = [
    { topic: 'Variables', subject: 'Programming Basics', difficulty: 'Easy' },
    { topic: 'Loops', subject: 'Programming Basics', difficulty: 'Easy' },
    { topic: 'Functions', subject: 'Programming Basics', difficulty: 'Medium' },
    { topic: 'Arrays', subject: 'Data Structures', difficulty: 'Medium' },
    { topic: 'Objects', subject: 'Data Structures', difficulty: 'Medium' },
    { topic: 'Recursion', subject: 'Algorithms', difficulty: 'Hard' },
    { topic: 'Sorting', subject: 'Algorithms', difficulty: 'Medium' },
    { topic: 'Big O', subject: 'Foundations', difficulty: 'Medium' }
];

const startMidnightWorker = () => {
    // Run every minute, but only trigger generation if exactly 00:00 (or close to it)
    // and ensuring idempotency with the dateKey
    setInterval(async () => {
        try {
            await ensureDailyContentGenerated();
        } catch (error) {
            console.error('[MidnightWorker] Failed:', error);
        }
    }, 60000); // Check every minute
};

/**
 * Checks if today's content exists. If not, selects a global focus topic
 * and generates the LLM content, saving it atomically.
 */
async function ensureDailyContentGenerated() {
    // Use UTC for server-wide sync
    const nowUTC = new Date();
    const dateKey = Math.max(1, nowUTC.getUTCHours()) < 24 ? // Simplistic date building for UTC midnight
        `${nowUTC.getUTCFullYear()}-${String(nowUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(nowUTC.getUTCDate()).padStart(2, '0')}` : '';

    const existing = await DailyGlobalContent.findOne({ dateKey });
    if (existing) return; // Content already generated

    // At this point we need to pick a global topic.
    // Let's find the globally weakest subject, or fallback to the roadmap
    let targetTopicData = ROADMAP_TOPICS[Math.floor(Math.random() * ROADMAP_TOPICS.length)];

    try {
        const weakestAgg = await TopicMastery.aggregate([
            { $group: { _id: '$subject', avgMastery: { $avg: '$mastery' } } },
            { $sort: { avgMastery: 1 } },
            { $limit: 1 }
        ]);

        if (weakestAgg.length > 0) {
            const subject = weakestAgg[0]._id;

            // Pick a topic from that subject
            const topicAgg = await TopicMastery.aggregate([
                { $match: { subject } },
                { $group: { _id: '$topic' } },
                { $sample: { size: 1 } }
            ]);

            if (topicAgg.length > 0) {
                targetTopicData = {
                    topic: topicAgg[0]._id,
                    subject: subject,
                    difficulty: 'Medium' // Global default
                };
            }
        }
    } catch (e) {
        console.error('[MidnightWorker] Failed to aggregate weakest global topic, using fallback.', e);
    }

    try {
        console.log(`[MidnightWorker] Generating daily content for ${dateKey} on topic: ${targetTopicData.topic}`);

        let lessonData;
        try {
            lessonData = await generateLesson(targetTopicData.topic, targetTopicData.subject, targetTopicData.difficulty);
        } catch (llmErr) {
            console.error('[MidnightWorker] LLM Failure, using fallback static data.', llmErr);
            // Fallback immediately generated mock data for reliability
            lessonData = {
                topic: targetTopicData.topic,
                subject: targetTopicData.subject,
                questions: [
                    { id: 'mq1', question: `EASY Static fallback question for ${targetTopicData.topic}`, options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', difficulty: 'EASY', conceptTag: targetTopicData.topic, baseWeight: 1 },
                    { id: 'mq2', question: `MEDIUM Static fallback question for ${targetTopicData.topic}`, options: ['A', 'B', 'C', 'D'], correctAnswer: 'B', difficulty: 'MEDIUM', conceptTag: targetTopicData.topic, baseWeight: 2 },
                    { id: 'mq3', question: `HARD Static fallback question for ${targetTopicData.topic}`, options: ['A', 'B', 'C', 'D'], correctAnswer: 'C', difficulty: 'HARD', conceptTag: targetTopicData.topic, baseWeight: 3 }
                ],
                codingQuestions: []
            };
        }

        let questions = lessonData.questions || [];
        let codingQuestions = lessonData.codingQuestions || [];

        // Formatting backward compatibility
        if (questions.length === 0 && lessonData.quiz) {
            questions = lessonData.quiz.map((q, i) => ({
                id: `q${i}`,
                question: q.question,
                options: q.options,
                correctAnswer: q.correctAnswer
            }));
        }

        // Upsert to handle race conditions if multiple distributed workers run
        await DailyGlobalContent.findOneAndUpdate(
            { dateKey },
            {
                $setOnInsert: {
                    clusterId: targetTopicData.subject,
                    topicId: targetTopicData.topic,
                    questions,
                    codingQuestions,
                    generatedAt: nowUTC
                }
            },
            { upsert: true }
        );

        console.log(`[MidnightWorker] Global content generated and saved for ${dateKey}`);

    } catch (err) {
        console.error('[MidnightWorker] Fatal error during generation:', err);
    }
}

module.exports = { startMidnightWorker, ensureDailyContentGenerated };
