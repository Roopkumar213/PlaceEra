const request = require('supertest');
const app = require('../../src/app');
const db = require('../setup');
const User = require('../../src/models/User');
const SubjectMastery = require('../../src/models/SubjectMastery');
const TopicMastery = require('../../src/models/TopicMastery');
const Track = require('../../src/models/Track');
const Subject = require('../../src/models/Subject');
const Topic = require('../../src/models/Topic');
const jwt = require('jsonwebtoken');

describe('Multi-Track Adaptive Engine V2 Verification', () => {
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
        await SubjectMastery.deleteMany({});
        await TopicMastery.deleteMany({});
        await Track.deleteMany({});
        await Subject.deleteMany({});
        await Topic.deleteMany({});

        // Create user
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Track Tester',
                email: 'track@test.com',
                password: 'password123',
                domain: 'Software Engineering'
            });

        token = res.body.token;
        userId = res.body.user.id;

        // Seed Tracks & Weights
        await Track.create([
            { name: 'DSA', weight: 2.0, orderIndex: 0 },
            { name: 'DEV', weight: 1.0, orderIndex: 1 },
            { name: 'APTITUDE', weight: 0.5, orderIndex: 2 }
        ]);

        // Seed Subjects mapped to tracks
        await Subject.create([
            { name: 'Algorithms', count: 1, orderIndex: 0, track: 'DSA' },
            { name: 'Backend', count: 1, orderIndex: 1, track: 'DEV' },
            { name: 'Quant', count: 1, orderIndex: 2, track: 'APTITUDE' }
        ]);

        // Seed Topics
        await Topic.create([
            { name: 'Sorting', subject: 'Algorithms', orderIndex: 0 },
            { name: 'APIs', subject: 'Backend', orderIndex: 0 },
            { name: 'Probability', subject: 'Quant', orderIndex: 0 }
        ]);

        // Seed DailyConcepts to prevent live LLM generation during tests
        const DailyConcept = require('../../src/models/DailyConcept');
        await DailyConcept.create({
            topic: 'Variables',
            subject: 'Programming Basics',
            difficulty: 'Easy',
            summary: 'Mock summary that is much longer to pass the validation rule. '.repeat(2),
            explanation: 'Mock explanation Mock explanation '.repeat(10), // > 200 chars
            codeExample: {
                language: 'javascript',
                code: 'let a = 1;'
            },
            quiz: [
                { question: '1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
                { question: '2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
                { question: '3', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
                { question: '4', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
                { question: '5', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' }
            ]
        });

    });


    test('Recommendation strictly respects Multi-Track weight scaling', async () => {
        // Mock scenario: user is seemingly weaker in APTITUDE (40 mastery) than DSA (60 mastery)
        // However, DSA weight (2.0) vs APTITUDE weight (0.5) completely flips the effective mastery.
        // Effective mastery = Real / Weight
        // DSA: 60 / 2.0 = 30
        // APTITUDE: 40 / 0.5 = 80
        // Result: DSA should be recommended as the "weakest" domain due to its critical weight.

        await SubjectMastery.create([
            { userId, subject: 'Algorithms', track: 'DSA', averageMastery: 60, totalAttempts: 10, createdAt: new Date() },
            { userId, subject: 'Quant', track: 'APTITUDE', averageMastery: 40, totalAttempts: 10, createdAt: new Date() }
        ]);

        await TopicMastery.create([
            { userId, subject: 'Algorithms', topic: 'Sorting', mastery: 60, unlocked: true },
            { userId, subject: 'Quant', topic: 'Probability', mastery: 40, unlocked: true }
        ]);

        const recRes = await request(app)
            .get('/api/recommendation')
            .set('Authorization', `Bearer ${token}`);

        expect(recRes.statusCode).toBe(200);
        // It must recommend Algorithms despite it having a higher numerical mastery score.
        expect(recRes.body.subjectId).toBe('Algorithms');
        expect(recRes.body.topicId).toBe('Sorting');
    });

    test('Daily engine creates primary and secondary track plans', async () => {
        const todayRes = await request(app)
            .get('/api/today')
            .set('Authorization', `Bearer ${token}`);

        expect(todayRes.statusCode).toBe(200);
        expect(todayRes.body).toHaveProperty('topic');
        expect(todayRes.body.meta).toHaveProperty('secondaryBlock');

        // Check the secondary block structure
        const sb = todayRes.body.meta.secondaryBlock;
        expect(['APTITUDE', 'DEV', 'DEVOPS']).toContain(sb.track);
        expect(sb).toHaveProperty('subject');
        expect(sb).toHaveProperty('topic');
    });

});
