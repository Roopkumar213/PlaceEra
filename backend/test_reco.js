const mongoose = require('mongoose');
const User = require('./src/models/User');
const TopicMastery = require('./src/models/TopicMastery');
const Topic = require('./src/models/Topic');
const Subject = require('./src/models/Subject');
const SubjectMastery = require('./src/models/SubjectMastery');
const { getWeakestDomainRecommendation } = require('./src/services/recommendationService');
const { initializeUserMasteryIfEmpty } = require('./src/services/masteryService');

require('dotenv').config();

const test = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/placeera');
        console.log('Connected to DB');

        // Setup Test User
        const testUserEmail = `reco_test_${Date.now()}@example.com`;
        const user = new User({
            name: 'Reco Tester',
            email: testUserEmail,
            passwordHash: 'hash',
            onboardingComplete: true
        });
        await user.save();
        const userId = user._id;

        // 1. Initialize Mastery (Creates some unlocked topics with mastery 5)
        await initializeUserMasteryIfEmpty(userId);

        // 2. Fetch Subjects to confirm what we have
        const subMasteries = await SubjectMastery.find({ userId });
        console.log(`Subjects found: ${subMasteries.map(s => s.subject).join(', ')}`);

        // Force subjects to exist in SubjectMastery for the user
        const subData = [
            { userId, subject: 'Foundations', averageMastery: 10, totalAttempts: 2, createdAt: new Date(Date.now() - 10000) },
            { userId, subject: 'Data Structures', averageMastery: 80, totalAttempts: 10, createdAt: new Date(Date.now() - 20000) },
            { userId, subject: 'Algorithms', averageMastery: 50, totalAttempts: 5, createdAt: new Date(Date.now() - 30000) }
        ];
        await SubjectMastery.insertMany(subData);

        // 3. Get Recommendation
        let reco = await getWeakestDomainRecommendation(userId);
        console.log('\n--- Normal Recommendation (Weakest Subject should be Foundations at 10%) ---');
        console.log(JSON.stringify(reco, null, 2));

        // 4. Update a topic to "In Progress" (Priority 1)
        // Foundations has "Big O Notation"
        await TopicMastery.findOneAndUpdate({ userId, topic: 'Big O Notation' }, { mastery: 45 });
        reco = await getWeakestDomainRecommendation(userId);
        console.log('\n--- After setting Big O to 45% (Priority 1: IN_PROGRESS) ---');
        console.log(JSON.stringify(reco, null, 2));

        // 5. Tie-break test: Same mastery, different totalAttempts
        await SubjectMastery.findOneAndUpdate({ userId, subject: 'Algorithms' }, { averageMastery: 10, totalAttempts: 5 });
        await SubjectMastery.findOneAndUpdate({ userId, subject: 'Foundations' }, { averageMastery: 10, totalAttempts: 10 });
        // Now Algorithms should be weakest because totalAttempts 5 < 10
        reco = await getWeakestDomainRecommendation(userId);
        console.log('\n--- Tie-break: Algorithms (TotalAttempts 5) vs Foundations (TotalAttempts 10) ---');
        console.log(`Recommended Subject: ${reco?.subjectId}`);

        // Clean up
        await User.deleteOne({ _id: userId });
        await TopicMastery.deleteMany({ userId });
        await SubjectMastery.deleteMany({ userId });
        console.log('\nCleanup done.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

test();
