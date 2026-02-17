const path = require('path');
const mongoose = require('mongoose');

// Resolve Backend Root relative to this script (scripts/verifyFlow.js -> ../backend)
const BACKEND_ROOT = path.resolve(__dirname, '../backend');

const User = require(path.join(BACKEND_ROOT, 'src/models/User'));
const TopicMastery = require(path.join(BACKEND_ROOT, 'src/models/TopicMastery'));
const SubjectMastery = require(path.join(BACKEND_ROOT, 'src/models/SubjectMastery')); // Added explicitly
const UserProgress = require(path.join(BACKEND_ROOT, 'src/models/UserProgress'));
const { calculateGlobalReadiness } = require(path.join(BACKEND_ROOT, 'src/services/globalReadinessEngine'));

require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') }); // Load env correctly

const verifyFlow = async () => {
    try {
        console.log('--- Connecting to DB ---');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // 1. Create Test User
        const testEmail = `verify_${Date.now()}@test.com`;
        const user = await User.create({
            name: 'Verify Bot',
            email: testEmail,
            password: 'hashedpassword123'
        });
        console.log(`1. User Created: ${user.email} (${user._id})`);

        // 2. Simulate User Activity (Insert TopicMastery directly to simulate quiz results)
        // Topic: "Arrays" (DSA) -> 80%
        await TopicMastery.create({
            userId: user._id,
            topicId: new mongoose.Types.ObjectId(), // Fake ID
            topic: 'Arrays',
            subject: 'DSA',
            proficiency: 80,
            attempts: 1,
            lastAttempt: new Date()
        });

        // Topic: "HashMaps" (DSA) -> 90%
        await TopicMastery.create({
            userId: user._id,
            topicId: new mongoose.Types.ObjectId(),
            topic: 'HashMaps',
            subject: 'DSA',
            proficiency: 90,
            attempts: 1,
            lastAttempt: new Date()
        });

        // Topic: "NodeJS" (Backend) -> 60%
        await TopicMastery.create({
            userId: user._id,
            topicId: new mongoose.Types.ObjectId(),
            topic: 'NodeJS',
            subject: 'Backend',
            proficiency: 60,
            attempts: 1,
            lastAttempt: new Date()
        });

        console.log('2. Topic Masteries Inserted.');
        // Note: We are NOT inserting SubjectMastery. We rely on Part 2 (Auto Rebuild).

        // 3. Call Readiness Engine
        console.log('3. Calculating Readiness (Should trigger Auto-Sync)...');
        const result = await calculateGlobalReadiness(user._id);

        console.log('--- Readiness Result ---');
        console.log(JSON.stringify(result, null, 2));

        // Validation
        // DSA Avg: (80+90)/2 = 85. Weight 0.40 -> 34 points.
        // Backend Avg: 60. Weight 0.25 -> 15 points.
        // Total: 49 points.
        // Score: 49.0
        // Classification: Needs Work (<55) or Improving?
        // Logic: if >= 55 Improving. 49 is "Needs Work".

        if (result.readinessScore === 49) {
            console.log('✅ calculation correct (49.0)');
        } else {
            console.error(`❌ calculation mismatch. Expected 49.0, got ${result.readinessScore}`);
        }

        if (result.breakdown.length === 2) {
            console.log('✅ Breakdown contains rebuilt subjects.');
        } else {
            console.error('❌ Breakdown missing subjects. Auto-sync failed?');
        }

        // Cleanup
        await User.deleteOne({ _id: user._id });
        await TopicMastery.deleteMany({ userId: user._id });
        const SM = require(path.join(BACKEND_ROOT, 'src/models/SubjectMastery'));
        await SM.deleteMany({ userId: user._id });

        console.log('Cleanup Done.');
        process.exit(0);

    } catch (err) {
        require('fs').writeFileSync('verify_error.log', `Verification Failed: ${err.message}\n${err.stack}`);
        console.error('Verification Failed:', err);
        process.exit(1);
    }
};

verifyFlow();
