const express = require('express');
const router = express.Router();
const DailyConcept = require('../models/DailyConcept');
const AdminReview = require('../models/AdminReview');
const { generateLesson } = require('../services/llmService');
const { validateLesson } = require('../utils/validateLesson');

// Hardcoded roadmap topics for now since no Roadmap model exists
const ROADMAP_TOPICS = [
    { topic: 'Variables', subject: 'Programming Basics', difficulty: 'Easy' },
    { topic: 'Loops', subject: 'Programming Basics', difficulty: 'Easy' },
    { topic: 'Functions', subject: 'Programming Basics', difficulty: 'Medium' },
    { topic: 'Arrays', subject: 'Data Structures', difficulty: 'Medium' },
    { topic: 'Objects', subject: 'Data Structures', difficulty: 'Medium' },
];

/**
 * GET /api/today
 * Retrieves or generates the daily lesson.
 */
router.get('/today', async (req, res) => {
    try {
        // 1. Check if DailyConcept already exists for today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        let dailyConcept = await DailyConcept.findOne({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        if (dailyConcept) {
            return res.json(dailyConcept);
        }

        // 2. Determine topic (Simple rotation or random for now)
        // specific logic: use day of year mod topics length to pick a topic
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const topicData = ROADMAP_TOPICS[dayOfYear % ROADMAP_TOPICS.length];

        console.log(`Generating lesson for topic: ${topicData.topic}`);

        // 3. Generate Lesson
        let lessonData;
        let attempts = 0;
        const MAX_RETRIES = 1; // 1 retry means 2 attempts total

        while (attempts <= MAX_RETRIES) {
            try {
                const startTime = Date.now();
                lessonData = await generateLesson(topicData.topic, topicData.subject, topicData.difficulty);
                const generationTime = Date.now() - startTime;
                console.log(`Lesson generated in ${generationTime}ms`);


                // 4. Validate
                const validation = validateLesson(lessonData);

                if (validation.isValid) {
                    // Save and return
                    dailyConcept = new DailyConcept(lessonData);
                    await dailyConcept.save();
                    console.log('Lesson generated and saved successfully.');
                    return res.json(dailyConcept);
                }

                console.warn(`Validation failed (Attempt ${attempts + 1}):`, validation.errors);

                // If this was the last attempt, we need to handle failure
                if (attempts === MAX_RETRIES) {
                    // Save to AdminReview
                    const review = new AdminReview({
                        topic: topicData.topic,
                        subject: topicData.subject,
                        rawOutput: JSON.stringify(lessonData),
                        errorMessage: JSON.stringify(validation.errors)
                    });
                    await review.save();
                    console.error('Lesson generation failed after retries. Saved to AdminReview.');
                    return res.status(500).json({ error: "Lesson generation failed. Admin review required." });
                }

            } catch (err) {
                console.error(`Generation attempt ${attempts + 1} error:`, err.message);
                if (attempts === MAX_RETRIES) {
                    // Save error to AdminReview even if generation crashed (if we have partial data?)
                    // If generateLesson failed, lessonData might be undefined.
                    const review = new AdminReview({
                        topic: topicData.topic,
                        subject: topicData.subject,
                        rawOutput: lessonData ? JSON.stringify(lessonData) : "No output generated",
                        errorMessage: err.message
                    });
                    await review.save();
                    return res.status(500).json({ error: "Lesson generation failed. Admin review required." });
                }
            }

            attempts++;
        }

    } catch (err) {
        console.error('Server Error in /today:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
