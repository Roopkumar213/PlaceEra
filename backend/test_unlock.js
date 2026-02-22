const mongoose = require('mongoose');
const User = require('./src/models/User');
const TopicMastery = require('./src/models/TopicMastery');
const Topic = require('./src/models/Topic');
const Subject = require('./src/models/Subject');
const { initializeUserMasteryIfEmpty, evaluateAndUpdateUnlocks } = require('./src/services/masteryService');

require('dotenv').config();

const test = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/placeera');
        console.log('Connected to DB');

        // 1. Setup Test User
        const testUserEmail = `test_${Date.now()}@example.com`;
        const user = new User({
            name: 'Test User',
            email: testUserEmail,
            passwordHash: 'hash',
            onboardingComplete: true
        });
        await user.save();
        const userId = user._id;

        const logMastery = (mastery) => {
            mastery.forEach(m => {
                console.log(`[TOPIC] ${m.topic.padEnd(20)} | Unlocked: ${String(m.unlocked).padEnd(5)} | Mastery: ${m.mastery}`);
            });
        };

        // 2. Initialize
        await initializeUserMasteryIfEmpty(userId);
        let mastery = await TopicMastery.find({ userId }).sort({ topic: 1 });
        console.log('\n--- 1. INITIAL STATE (Bootstrap) ---');
        logMastery(mastery);

        // 3. Master Topic 1 (Big O Notation)
        const t1 = "Big O Notation";
        await TopicMastery.findOneAndUpdate({ userId, topic: t1 }, { mastery: 80 });
        console.log(`\n>>> ACTION: Set ${t1} to 80%`);

        const session = await mongoose.startSession();
        await session.withTransaction(async () => {
            await evaluateAndUpdateUnlocks(userId, session);
        });
        await session.endSession();

        mastery = await TopicMastery.find({ userId }).sort({ topic: 1 });
        console.log('\n--- 2. AFTER T1 MASTERY ---');
        logMastery(mastery);

        // 4. Master Topic 2 (Arrays & Strings)
        const t2 = "Arrays & Strings";
        await TopicMastery.findOneAndUpdate({ userId, topic: t2 }, { mastery: 75 });
        console.log(`\n>>> ACTION: Set ${t2} to 75%`);

        const session2 = await mongoose.startSession();
        await session2.withTransaction(async () => {
            await evaluateAndUpdateUnlocks(userId, session2);
        });
        await session2.endSession();

        mastery = await TopicMastery.find({ userId }).sort({ topic: 1 });
        console.log('\n--- 3. AFTER T2 MASTERY (Expect T3 to unlock) ---');
        logMastery(mastery);

        // Clean up
        await User.deleteOne({ _id: userId });
        await TopicMastery.deleteMany({ userId });
        console.log('\nCleanup done.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

test();
