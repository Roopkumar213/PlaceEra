const mongoose = require('mongoose');
const User = require('../src/models/User');
const TopicMastery = require('../src/models/TopicMastery');
const DailyConcept = require('../src/models/DailyConcept');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const VERIFY_TOPIC = 'Concurrency Check';
const VERIFY_SUBJECT = 'Test Env';

const runVerification = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/placeera');
        console.log('✅ DB Connected');

        // 1. Setup User & Concept
        const user = await User.create({
            name: 'Concurrency Tester',
            email: `conc_${Date.now()}@test.com`,
            password: 'pass'
        });
        const userId = user._id;

        const concept = await DailyConcept.create({
            topic: VERIFY_TOPIC,
            subject: VERIFY_SUBJECT,
            content: 'Test content',
            difficulty: 'Easy'
        });

        // 2. Generate Token
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        const API_URL = 'http://localhost:5000/api/quiz/submit';

        // 3. Fire Simultaneous Requests (Race Condition Test)
        console.log('🚀 Firing 5 simultaneous requests...');

        const requests = [];
        const submissionIdRaw = 'sub_' + Date.now();

        // MIX: 3 with same submissionId (Idempotency check), 2 with different (Atomic check)

        // Request A (Idempotent Group)
        for (let i = 0; i < 3; i++) {
            requests.push(axios.post(API_URL, {
                quizId: concept._id,
                score: 10,
                submissionId: submissionIdRaw // Same ID
            }, { headers: { Authorization: `Bearer ${token}` } }));
        }

        // Request B (Unique - Should increment attempt count)
        requests.push(axios.post(API_URL, {
            quizId: concept._id,
            score: 100,
            submissionId: submissionIdRaw + '_unique'
        }, { headers: { Authorization: `Bearer ${token}` } }));


        const results = await Promise.allSettled(requests);

        // 4. Verify Results
        console.log('\n--- RESULTS ---');
        results.forEach((r, i) => {
            console.log(`Req ${i}: ${r.status} ${r.value?.data?.message || 'OK'}`);
        });

        // 5. Check DB State
        const mastery = await TopicMastery.findOne({ userId, topic: VERIFY_TOPIC });
        console.log('\n--- DB STATE ---');
        console.log(`Total Attempts: ${mastery.totalAttempts}`);
        console.log(`Mastery: ${mastery.mastery}`);

        // Expectation:
        // 3 Requests used same ID -> processed ONCE.
        // 1 Request used unique ID -> processed ONCE.
        // Total Attempts should be 2.

        if (mastery.totalAttempts === 2) {
            console.log('✅ PASS: Concurrency & Idempotency logic verified.');
        } else {
            console.log('❌ FAIL: Expected 2 attempts, got ' + mastery.totalAttempts);
        }

        // Cleanup
        await User.deleteOne({ _id: userId });
        await TopicMastery.deleteMany({ userId });
        await DailyConcept.deleteOne({ _id: concept._id });
        await mongoose.connection.close();

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

runVerification();
