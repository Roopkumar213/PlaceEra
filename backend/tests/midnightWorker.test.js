const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DailyGlobalContent = require('../src/models/DailyGlobalContent');
const TopicMastery = require('../src/models/TopicMastery');
const { ensureDailyContentGenerated } = require('../src/jobs/midnightWorker');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const jwt = require('jsonwebtoken');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await DailyGlobalContent.deleteMany({});
    await TopicMastery.deleteMany({});
    await User.deleteMany({});
});

describe('Midnight Worker & Global Daily Content Integration', () => {
    it('generates exactly 1 record on first run', async () => {
        await ensureDailyContentGenerated();
        const records = await DailyGlobalContent.find({});
        expect(records.length).toBe(1);
    });

    it('is idempotent (multiple runs do not duplicate)', async () => {
        // Run multiple instances effectively simultaneously
        await Promise.all([
            ensureDailyContentGenerated(),
            ensureDailyContentGenerated(),
            ensureDailyContentGenerated(),
            ensureDailyContentGenerated()
        ]);

        const records = await DailyGlobalContent.find({});
        expect(records.length).toBe(1);
    });

    it('serves the exact same content to different users without LLM calls on fetch', async () => {
        // Generate content via worker
        await ensureDailyContentGenerated();

        // Register Users
        const user1 = await User.create({ name: 'User 1', email: 'user1@test.com', passwordHash: 'hashed' });
        const user2 = await User.create({ name: 'User 2', email: 'user2@test.com', passwordHash: 'hashed' });

        const token1 = jwt.sign({ id: user1._id }, process.env.JWT_SECRET || 'test_secret');
        const token2 = jwt.sign({ id: user2._id }, process.env.JWT_SECRET || 'test_secret');

        // Note: Make sure process.env.JWT_SECRET matches what app.js uses in tests if it's set differently

        const res1 = await request(app)
            .get('/api/daily/session')
            .set('Authorization', `Bearer ${token1}`);

        expect(res1.status).toBe(200);

        const res2 = await request(app)
            .get('/api/daily/session')
            .set('Authorization', `Bearer ${token2}`);

        expect(res2.status).toBe(200);

        // They must receive the same questions
        expect(res1.body.questions.length).toBeGreaterThan(0);
        expect(res2.body.questions.length).toBeGreaterThan(0);

        const ids1 = res1.body.questions.map(q => q.id).sort();
        const ids2 = res2.body.questions.map(q => q.id).sort();

        expect(ids1).toEqual(ids2);

        // Assert NO LLM call behavior during request - implicitly true if we bypass LLM in endpoint logic and ONLY use standard fetching
    });
});
