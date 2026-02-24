const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const DailySession = require('../../src/models/DailySession');
const db = require('../setup');
const { ensureDailyContentGenerated } = require('../../src/jobs/midnightWorker');
const DailyGlobalContent = require('../../src/models/DailyGlobalContent');

jest.mock('../../src/services/llmService', () => ({
    generateLesson: jest.fn().mockImplementation(async () => {
        return {
            topic: "Big O",
            subject: "Foundations",
            difficulty: "Medium",
            summary: "O(n) matters.",
            explanation: "Here is why it matters...",
            codeExample: { language: "js", code: "return true;" },
            questions: [
                { id: "q1", question: "A", options: ["1", "2", "3", "4"], correctAnswer: "1" }
            ],
            codingQuestions: [
                { id: "cq1", title: "Two Sum", description: "find 2", difficulty: "Easy", testCases: [] }
            ]
        };
    })
}));

describe('Unified Daily Session API Verification', () => {
    let token;
    let userId;

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
        // Clean db
        await User.deleteMany({});
        await DailySession.deleteMany({});
        await DailyGlobalContent.deleteMany({});

        // Create user
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Session Tester',
                email: 'session@test.com',
                password: 'password123',
                domain: 'Software Engineering'
            });

        token = res.body.token;
        userId = res.body.user.id;
    });

    test('Identical session returned on repeat calls to /api/daily/session', async () => {
        // Run global generator
        await ensureDailyContentGenerated();

        // 1. First Call: Generates session
        const firstRes = await request(app)
            .get('/api/daily/session')
            .set('Authorization', `Bearer ${token}`);

        expect(firstRes.statusCode).toBe(200);
        expect(firstRes.body).toHaveProperty('_id');
        expect(firstRes.body).toHaveProperty('cluster');
        expect(firstRes.body).toHaveProperty('topic');
        expect(firstRes.body).toHaveProperty('behavioralState');
        expect(firstRes.body.questions.length).toBeGreaterThan(0);
        expect(firstRes.body.codingQuestions.length).toBeGreaterThan(0);

        const firstSessionId = firstRes.body._id;
        const dbCount1 = await DailySession.countDocuments();
        expect(dbCount1).toBe(1);

        // 2. Second Call: Retrieves cached session
        const secondRes = await request(app)
            .get('/api/daily/session')
            .set('Authorization', `Bearer ${token}`);

        expect(secondRes.statusCode).toBe(200);
        expect(secondRes.body._id).toBe(firstSessionId);
        expect(secondRes.body.questions[0]._id).toBe(firstRes.body.questions[0]._id);

        // 3. Verify no extra DB writes occurred
        const dbCount2 = await DailySession.countDocuments();
        expect(dbCount2).toBe(1); // Still exactly 1

        jest.restoreAllMocks();
    });
});
