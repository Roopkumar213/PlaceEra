const mongoose = require('mongoose');
const User = require('./src/models/User');
const TopicMastery = require('./src/models/TopicMastery');
const SubjectMastery = require('./src/models/SubjectMastery');
const { calculateGlobalReadiness } = require('./src/services/globalReadinessEngine');
require('dotenv').config();

const verifyFlow = async () => {
    try {
        console.log('--- Connecting to DB ---');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const testEmail = `verify_local_${Date.now()}@test.com`;
        const user = await User.create({
            name: 'Verify Bot Local',
            email: testEmail,
            password: 'hashedpassword123'
        });
        console.log(`1. User Created: ${user.email}`);

        // Insert Topics
        await TopicMastery.create({ userId: user._id, topic: 'Arrays', subject: 'DSA', proficiency: 80, attempts: 1 });
        await TopicMastery.create({ userId: user._id, topic: 'HashMaps', subject: 'DSA', proficiency: 90, attempts: 1 });
        await TopicMastery.create({ userId: user._id, topic: 'NodeJS', subject: 'Backend', proficiency: 60, attempts: 1 });

        console.log('2. Topics Inserted.');

        // Calculate
        console.log('3. Calculating Readiness...');
        const result = await calculateGlobalReadiness(user._id);

        console.log('--- Result ---');
        console.log(JSON.stringify(result, null, 2));

        if (result.readinessScore === 49) {
            console.log('✅ calculation correct (49.0)');
        } else {
            console.error(`❌ calculation mismatch. Got ${result.readinessScore}`);
        }

        // Cleanup
        await User.deleteOne({ _id: user._id });
        await TopicMastery.deleteMany({ userId: user._id });
        await SubjectMastery.deleteMany({ userId: user._id });

        console.log('Cleanup Done.');
        process.exit(0);
    } catch (err) {
        console.error('Failed:', err);
        process.exit(1);
    }
};

verifyFlow();
