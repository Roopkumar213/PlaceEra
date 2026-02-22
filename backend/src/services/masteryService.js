const mongoose = require('mongoose');
const TopicMastery = require('../models/TopicMastery');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');

const User = require('../models/User');

/**
 * Auto-initializes TopicMastery for a new user.
 * Selects first 2 topics per subject and sets initial mastery.
 * @param {string} userId - The ID of the user to initialize.
 */
const initializeUserMasteryIfEmpty = async (userId) => {
    // 1. Guard: Check if onboarding is complete before bootstrapping
    // This prevents half-configured users from getting a curriculum.
    const user = await User.findById(userId);
    if (!user || !user.onboardingComplete) {
        // console.log(`[MasteryInit] Skipping: User ${userId} has not completed onboarding.`);
        return;
    }

    const session = await mongoose.startSession();

    // 2. Enterprise Configuration: Majority Write Concern + Snapshot Read Concern
    const transactionOptions = {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
    };

    try {
        await session.withTransaction(async () => {
            // Idempotency: Count existing mastery rows
            const existingCount = await TopicMastery.countDocuments({ userId }).session(session);
            if (existingCount > 0) {
                return;
            }

            console.log(`[MasteryInit] Initializing mastery for user: ${userId}`);

            // Source of Truth: We prefer DB models but fallback to hardcoded structure
            let subjects = await Subject.find().sort({ orderIndex: 1 }).session(session);

            const CURRICULUM_STRUCTURE = [
                { module: 'Foundations', topics: ['Big O Notation', 'Arrays & Strings', 'Basic Math'] },
                { module: 'Data Structures', topics: ['Linked Lists', 'Stacks & Queues', 'Trees', 'Graphs', 'Hash Maps'] },
                { module: 'Algorithms', topics: ['Sorting', 'Searching', 'Recursion', 'Dynamic Programming', 'Greedy'] }
            ];

            // 3. Guard: Handle empty or partial results safely
            if (!subjects || subjects.length === 0) {
                for (const mod of CURRICULUM_STRUCTURE) {
                    if (!mod || !mod.topics || mod.topics.length === 0) continue;

                    // slice(0, 2) is safe for empty arrays or single-item arrays
                    const firstTwo = mod.topics.slice(0, 2);
                    for (const topicName of firstTwo) {
                        await TopicMastery.findOneAndUpdate(
                            { userId, topic: topicName },
                            {
                                $setOnInsert: {
                                    subject: mod.module,
                                    mastery: 5,
                                    unlocked: true,
                                    recommended: true,
                                    lastAttemptAt: null,
                                    decayLocked: false,
                                    createdAt: new Date()
                                }
                            },
                            { upsert: true, session }
                        );
                    }
                }
            } else {
                for (const sub of subjects) {
                    const topics = await Topic.find({ subject: sub.name })
                        .sort({ orderIndex: 1 })
                        .limit(2)
                        .session(session);

                    if (!topics || topics.length === 0) continue;

                    for (const topic of topics) {
                        await TopicMastery.findOneAndUpdate(
                            { userId, topic: topic.name },
                            {
                                $setOnInsert: {
                                    subject: sub.name,
                                    mastery: 5,
                                    unlocked: true,
                                    recommended: true,
                                    lastAttemptAt: null,
                                    decayLocked: false,
                                    createdAt: new Date()
                                }
                            },
                            { upsert: true, session }
                        );
                    }
                }
            }
        }, transactionOptions);
        console.log(`[MasteryInit] Successfully initialized mastery for user: ${userId}`);
    } catch (err) {
        console.error(`[MasteryInit] Error initializing mastery for user ${userId}:`, err);
        throw err;
    } finally {
        await session.endSession();
    }
};

/**
 * Evaluates and updates the unlocked status of topics for a user.
 * Implements linear progression logic: 
 * 1. The first topic of each subject is always unlocked.
 * 2. Topic N is unlocked if Topic N-1 has mastery >= 70.
 * @param {string} userId - The user ID to evaluate.
 * @param {mongoose.ClientSession} session - The active session for transaction.
 */
const evaluateAndUpdateUnlocks = async (userId, session) => {
    try {
        // 1. Fetch Subjects and Topics to establish the roadmap
        let [allSubjects, allTopics] = await Promise.all([
            Subject.find().sort({ orderIndex: 1 }).session(session),
            Topic.find().sort({ orderIndex: 1 }).session(session)
        ]);

        // TODO: [DEBT] Remove hardcoded fallback once DB seeding/migration is production-verified
        const CURRICULUM_STRUCTURE = [
            { module: 'Foundations', topics: ['Big O Notation', 'Arrays & Strings', 'Basic Math'] },
            { module: 'Data Structures', topics: ['Linked Lists', 'Stacks & Queues', 'Trees', 'Graphs', 'Hash Maps'] },
            { module: 'Algorithms', topics: ['Sorting', 'Searching', 'Recursion', 'Dynamic Programming', 'Greedy'] }
        ];

        // Fallback for cold start
        if (allSubjects.length === 0) {
            allTopics = [];
            CURRICULUM_STRUCTURE.forEach((mod, modIdx) => {
                mod.topics.forEach((topicName, topicIdx) => {
                    allTopics.push({
                        name: topicName,
                        subject: mod.module,
                        orderIndex: (modIdx * 100) + topicIdx
                    });
                });
            });
        }

        // 2. Fetch User's current mastery
        const userMastery = await TopicMastery.find({ userId }).session(session);
        const masteryMap = userMastery.reduce((acc, m) => {
            acc[m.topic] = m;
            return acc;
        }, {});

        // 3. Group topics by subject
        const topicsBySubject = allTopics.reduce((acc, t) => {
            if (!acc[t.subject]) acc[t.subject] = [];
            acc[t.subject].push(t);
            return acc;
        }, {});

        const bulkOps = [];
        const unlockLogEntries = [];
        const LearningEventLog = require('../models/LearningEventLog');

        // 4. Evaluate sequence per subject
        for (const subjectName in topicsBySubject) {
            const topics = topicsBySubject[subjectName];
            let previousTopicMastered = true; // Seed true for the first topic

            for (let i = 0; i < topics.length; i++) {
                const topic = topics[i];
                const currentMasteryRecord = masteryMap[topic.name];

                // Rule: If i == 0, always unlocked. Else, unlocked if previous >= 70.
                const shouldBeUnlocked = (i === 0) || previousTopicMastered;

                if (currentMasteryRecord) {
                    // Refinement: MONOTONIC UNLOCKS
                    // If already unlocked, stay unlocked. Never re-lock.
                    if (shouldBeUnlocked && !currentMasteryRecord.unlocked) {
                        bulkOps.push({
                            updateOne: {
                                filter: { _id: currentMasteryRecord._id },
                                update: { $set: { unlocked: true } }
                            }
                        });

                        unlockLogEntries.push({
                            userId,
                            topicId: topic.name,
                            subject: topic.subject,
                            eventType: 'TOPIC_UNLOCKED',
                            previousMastery: currentMasteryRecord.mastery,
                            newMastery: currentMasteryRecord.mastery,
                            delta: 0,
                            meta: { reason: 'linear_progression' }
                        });
                        console.log(`[MasteryUnlock] User ${userId} unlocked topic: ${topic.name}`);
                    }
                    // Update flow state for the NEXT topic in the sequence
                    previousTopicMastered = currentMasteryRecord.mastery >= 70;
                } else if (shouldBeUnlocked) {
                    // New record for newly unlocked topic
                    // Precision: Absolute control over initialized fields
                    bulkOps.push({
                        updateOne: {
                            filter: { userId, topic: topic.name },
                            update: {
                                $setOnInsert: {
                                    subject: topic.subject,
                                    mastery: 5, // Start with "Available" base
                                    unlocked: true,
                                    recommended: false, // Will be set by recommendation engine or rotation
                                    lastAttemptAt: null,
                                    decayLocked: false,
                                    createdAt: new Date()
                                }
                            },
                            upsert: true
                        }
                    });

                    unlockLogEntries.push({
                        userId,
                        topicId: topic.name,
                        subject: topic.subject,
                        eventType: 'TOPIC_UNLOCKED',
                        previousMastery: 0,
                        newMastery: 5,
                        delta: 5,
                        meta: { reason: 'linear_progression_initial' }
                    });
                    console.log(`[MasteryUnlock] User ${userId} auto-initialized & unlocked topic: ${topic.name}`);

                    previousTopicMastered = false; // Mastery is 5, not >= 70
                } else {
                    // Locked and no record exists - nothing to do
                    previousTopicMastered = false;
                }
            }
        }

        // 5. Execute in bulk
        if (bulkOps.length > 0) {
            await TopicMastery.bulkWrite(bulkOps, { session });
        }
        if (unlockLogEntries.length > 0) {
            await LearningEventLog.insertMany(unlockLogEntries, { session });
        }

    } catch (err) {
        console.error(`[MasteryUnlock] Evaluation failed for user ${userId}:`, err);
        throw err;
    }
};

module.exports = {
    initializeUserMasteryIfEmpty,
    evaluateAndUpdateUnlocks
};
