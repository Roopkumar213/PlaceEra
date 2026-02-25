const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../setup');
const User = require('../../src/models/User');
const DailyGlobalContent = require('../../src/models/DailyGlobalContent');
const TopicMastery = require('../../src/models/TopicMastery');
const DailySession = require('../../src/models/DailySession');
const jwt = require('jsonwebtoken');

describe('Adaptive Difficulty Calibration Integration', () => {
    let beginnerToken, advancedToken;
    let beginnerId, advancedId;
    let globalContentId;

    beforeAll(async () => {
        await db.connect();
    });

    afterAll(async () => {
        await db.close();
    });

    afterEach(async () => {
        await db.clear();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await DailyGlobalContent.deleteMany({});
        await TopicMastery.deleteMany({});
        await DailySession.deleteMany({});

        // Create Beginner User
        const beginner = await User.create({ name: 'Beg', email: 'beg@test.com', passwordHash: 'hashed' });
        beginnerId = beginner._id;
        beginnerToken = jwt.sign({ id: beginner._id }, process.env.JWT_SECRET || 'test_secret');

        // Create Advanced User
        const advanced = await User.create({ name: 'Adv', email: 'adv@test.com', passwordHash: 'hashed' });
        advancedId = advanced._id;
        advancedToken = jwt.sign({ id: advanced._id }, process.env.JWT_SECRET || 'test_secret');

        // Create TopicMastery
        await TopicMastery.create([
            { userId: beginnerId, subject: 'Algorithms', topic: 'Sorting', mastery: 10 },    // Beginner < 40
            { userId: advancedId, subject: 'Algorithms', topic: 'Sorting', mastery: 85 }     // Advanced > 70
        ]);

        // Create Global Content containing 25 questions: 8 E, 9 M, 8 H
        const questions = Array.from({ length: 25 }).map((_, i) => {
            let diff = 'MEDIUM';
            if (i < 8) diff = 'EASY';
            else if (i > 16) diff = 'HARD';
            return {
                id: `q${i}`,
                question: `Q${i} Diff: ${diff}`,
                options: ['A', 'B', 'C', 'D'],
                correctAnswer: 'A',
                difficulty: diff
            };
        });

        const nowUTC = new Date();
        const dateKey = `${nowUTC.getUTCFullYear()}-${String(nowUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(nowUTC.getUTCDate()).padStart(2, '0')}`;

        const gContent = await DailyGlobalContent.create({
            dateKey,
            clusterId: 'Algorithms',
            topicId: 'Sorting',
            questions,
            codingQuestions: []
        });
        globalContentId = gContent._id;
    });

    it('should assign easier questions to beginner and harder questions to advanced deterministically', async () => {
        // Fetch session for Beginner
        const begRes = await request(app)
            .get('/api/daily/session')
            .set('Authorization', `Bearer ${beginnerToken}`);

        // Fetch session for Advanced
        const advRes = await request(app)
            .get('/api/daily/session')
            .set('Authorization', `Bearer ${advancedToken}`);

        console.log('BEG QS[0]', begRes.body.questions[0]);

        expect(begRes.statusCode).toBe(200);
        expect(advRes.statusCode).toBe(200);

        const begQs = begRes.body.questions;
        const advQs = advRes.body.questions;

        // Verify total questions returned equals sum of target distribution (e.g. 10 questions)
        expect(begQs.length).toBe(10);
        expect(advQs.length).toBe(10);

        // Analyze difficulty distribution
        const countDiff = (qs) => qs.reduce((acc, q) => {
            acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
            return acc;
        }, { EASY: 0, MEDIUM: 0, HARD: 0 });

        const begDist = countDiff(begQs);
        const advDist = countDiff(advQs);

        // Beginner expects 7 EASY, 3 MEDIUM, 0 HARD
        expect(begDist.EASY).toBe(7);
        expect(begDist.MEDIUM).toBe(3);
        expect(begDist.HARD).toBe(0);

        // Advanced expects 2 EASY, 4 MEDIUM, 4 HARD
        expect(advDist.EASY).toBe(2);
        expect(advDist.MEDIUM).toBe(4);
        expect(advDist.HARD).toBe(4);

        // Verify that consecutive calls return strictly identical (determinsitic) arrays 
        // Note: the /api/daily/session endpoint first writes to DailySession, so it retrieves from cache thereafter
        const begResCached = await request(app)
            .get('/api/daily/session')
            .set('Authorization', `Bearer ${beginnerToken}`);

        expect(begResCached.body.questions.map(q => q.id)).toEqual(begQs.map(q => q.id));
    });
});
