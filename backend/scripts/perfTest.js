const mongoose = require('mongoose');
const User = require('../src/models/User');
const TopicMastery = require('../src/models/TopicMastery');
const DailyConcept = require('../src/models/DailyConcept');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api/quiz/submit';
const CONCURRENT_USERS = 50; // Scaled down for local dev stability (Goal: 100)
const DECAY_RECORDS = 5000;

const runLoadTest = async () => {
    try {
        const uri = 'mongodb://127.0.0.1:27017/placeera';
        console.log(`Connecting to ${uri}...`);
        await mongoose.connect(uri);
        console.log('✅ DB Connected');

        // 1. DATA SEEDING (Decay Job Test)
        console.log(`SEEDING ${DECAY_RECORDS} records for Decay Test...`);
        const bulkOps = [];
        const testUser = await User.create({ name: 'PerfUser', email: `perf_${Date.now()}@test.com`, password: '123' });

        for (let i = 0; i < DECAY_RECORDS; i++) {
            bulkOps.push({
                insertOne: {
                    document: {
                        userId: testUser._id,
                        topic: `Topic_${i}`,
                        subject: 'LoadTest',
                        mastery: 80,
                        lastAttemptAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 Days old
                    }
                }
            });
        }
        await TopicMastery.bulkWrite(bulkOps);
        console.log('✅ Seeding Complete.');

        // 2. CONCURRENCY QUIZ TEST
        console.log(`🚀 Launching ${CONCURRENT_USERS} concurrent quiz submissions...`);

        // Create a test concept
        const concept = await DailyConcept.create({
            topic: 'LoadTopic',
            subject: 'Perf',
            content: 'Test',
            difficulty: 'Medium',
            quiz: []
        });

        const token = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

        const requests = [];
        const startTime = Date.now();

        for (let i = 0; i < CONCURRENT_USERS; i++) {
            requests.push(axios.post(API_URL, {
                quizId: concept._id,
                score: 80,
                // Simulate race: Same submissionId for half, unique for half?
                // Let's test ATOMICITY mainly: Unique IDs hitting same topic
                submissionId: `sub_${i}_${Date.now()}`
            }, { headers: { Authorization: `Bearer ${token}` } }));
        }

        const results = await Promise.allSettled(requests);
        const duration = Date.now() - startTime;

        const success = results.filter(r => r.status === 'fulfilled').length;
        const fail = results.filter(r => r.status === 'rejected').length;

        console.log(`\n--- RESULTS ---`);
        console.log(`Total Requests: ${CONCURRENT_USERS}`);
        console.log(`Success: ${success}`);
        console.log(`Failed: ${fail}`);
        console.log(`Duration: ${duration}ms`);
        console.log(`Avg Latency: ${duration / CONCURRENT_USERS}ms`);

        // 3. VERIFY ATOMICITY
        const mastery = await TopicMastery.findOne({ userId: testUser._id, topic: 'LoadTopic' });
        if (mastery) {
            console.log(`Final Mastery attempts: ${mastery.totalAttempts}`);
            if (mastery.totalAttempts === success) {
                console.log('✅ ATOMICITY PASS: Attempts match success count.');
            } else {
                console.log(`❌ ATOMICITY WARN: DB says ${mastery.totalAttempts}, requests say ${success}`);
            }
        }

        // Cleanup
        console.log('Cleaning up...');
        await User.deleteOne({ _id: testUser._id });
        await TopicMastery.deleteMany({ userId: testUser._id });
        await DailyConcept.deleteOne({ _id: concept._id });
        await mongoose.connection.close();

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

runLoadTest();
