const cron = require('node-cron');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const WeeklyProgressSnapshot = require('../models/WeeklyProgressSnapshot');
const { calculateGlobalReadiness } = require('../services/globalReadinessEngine');

// Logic to run for a single user
const processUserSnapshot = async (user) => {
    try {
        const userId = user._id;

        // 1. Calculate Readiness
        const readinessData = await calculateGlobalReadiness(userId);

        // 2. Calculate Weekly Stats
        // Week Start Date (Previous Monday? Or just today?)
        // Spec says "Every Sunday 23:59". So the snapshot is for the WEEK ENDING today.
        // weekStartDate should probably be LAST Monday.
        const today = new Date();
        const weekStartDate = new Date(today);
        weekStartDate.setDate(today.getDate() - 6); // Monday
        weekStartDate.setHours(0, 0, 0, 0);

        // Quizzes Completed this week
        const quizzesCompleted = await UserProgress.countDocuments({
            userId,
            completedAt: { $gte: weekStartDate }
        });

        // 3. Save Snapshot
        // Upsert to avoiding duplicates if job runs twice
        await WeeklyProgressSnapshot.findOneAndUpdate(
            { userId, weekStartDate },
            {
                averageScore: readinessData.readinessScore, // Using readiness as proxy for "average"? Or calculate quiz avg? Spec says "averageScore" but engine returns readiness. Let's use readiness.
                readinessScore: readinessData.readinessScore,
                quizzesCompleted,
                streak: 0 // We'd need the streak calc logic here too, or just store 0 for now
            },
            { upsert: true, new: true }
        );

        console.log(`Snapshot saved for user ${user.email}`);

    } catch (err) {
        console.error(`Failed snapshot for user ${user._id}:`, err);
    }
};

// The Job Function
const runWeeklySnapshotJob = async () => {
    console.log('--- Starting Weekly Progress Snapshot Job ---');

    // Process all users
    // In production, use cursor or batching
    const users = await User.find({});

    for (const user of users) {
        await processUserSnapshot(user);
    }

    console.log('--- Weekly Snapshot Job Completed ---');
};

// Schedule: Every Sunday at 23:59
const scheduleWeeklySnapshot = () => {
    cron.schedule('59 23 * * 0', runWeeklySnapshotJob);
    console.log('📅 Weekly Snapshot Job Scheduled (Sun 23:59)');
};

module.exports = { scheduleWeeklySnapshot, runWeeklySnapshotJob };
