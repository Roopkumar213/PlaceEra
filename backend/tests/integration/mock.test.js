const request = require('supertest');
const app = require('../../src/app');
const db = require('../setup');
const User = require('../../src/models/User');
const SubjectMastery = require('../../src/models/SubjectMastery');
const TopicMastery = require('../../src/models/TopicMastery');
const DailyConcept = require('../../src/models/DailyConcept');
const MockSession = require('../../src/models/MockSession');
const RevisionQueue = require('../../src/models/RevisionQueue');

describe('Weekly Mock Engine Integration', () => {
    jest.setTimeout(60000);
    beforeAll(async () => await db.connect());
    afterAll(async () => await db.close());
    afterEach(async () => await db.clear());

    async function setupAuthenticatedUser() {
        const signupRes = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Mock User', email: 'mock@test.com', password: 'Password123!' });
        const token = signupRes.body.token;
        const userId = signupRes.body.user.id;

        await request(app)
            .put('/api/auth/onboarding')
            .set('Authorization', `Bearer ${token}`)
            .send({ timezone: 'UTC', preferredTimes: ['09:00'], onceOrTwice: 'once' });

        return { token, userId };
    }

    async function seedCurriculum() {
        const subjects = ['Foundations', 'Data Structures', 'Algorithms'];
        const dummyValidData = {
            difficulty: 'Easy',
            summary: 'This is a summary that is long enough to pass the validation of 50 characters. Repeating for length requirements.',
            explanation: 'This is a long explanation that is at least 200 characters long. Let us repeat it to reach the limit. This is a long explanation that is at least 200 characters long. Let us repeat it to reach the limit. This is a long explanation that is at least 200 characters long.',
            codeExample: { language: 'javascript', code: 'console.log("hello");' }
        };

        for (const [idx, sub] of subjects.entries()) {
            for (let i = 0; i < 15; i++) {
                await DailyConcept.create({
                    ...dummyValidData,
                    topic: `${sub} Topic ${i}`,
                    subject: sub,
                    quiz: [{
                        question: `Q${i} in ${sub}`,
                        options: ['1', '2', '3', '4'],
                        correctAnswer: '2'
                    }]
                });
            }
        }
    }

    it('should handle full mock lifecycle correctly', async () => {
        const { token, userId } = await setupAuthenticatedUser();
        await seedCurriculum();

        // 1. Setup Masteries
        await SubjectMastery.create({ userId, subject: 'Foundations', averageMastery: 40 });
        await SubjectMastery.create({ userId, subject: 'Data Structures', averageMastery: 60 });
        await SubjectMastery.create({ userId, subject: 'Algorithms', averageMastery: 80 });

        // Seed target topic
        await TopicMastery.create({ userId, topic: 'Foundations Topic 1', subject: 'Foundations', mastery: 40, totalAttempts: 1, lastAttemptAt: new Date() });

        // 2. Start Mock
        const startRes = await request(app)
            .post('/api/mock/start')
            .set('Authorization', `Bearer ${token}`);

        expect(startRes.statusCode).toBe(200);
        expect(startRes.body.questions.length).toBe(30);

        const sessionId = startRes.body.sessionId;
        const questions = startRes.body.questions;

        // 3. Submit Answers (100% correct to ensure upward delta)
        const answers = {};
        questions.forEach(q => { answers[q.id] = '2'; }); // Correct answer is always '2' in our seed

        const submitRes = await request(app)
            .post('/api/mock/submit')
            .set('Authorization', `Bearer ${token}`)
            .send({ sessionId, answers });

        expect(submitRes.statusCode).toBe(200);
        expect(submitRes.body.summary.totalScore).toBe(100);

        // 4. Verify Mastery Changes
        const updatedTM = await TopicMastery.findOne({ userId, topic: 'Foundations Topic 1' });
        // Delta = (100 - 40) * 0.25 = 15. New = 55.
        expect(updatedTM.mastery).toBe(55);

        // 5. Verify No Automatic Revision Queue
        const revisions = await RevisionQueue.find({ userId });
        expect(revisions.length).toBe(0);

        // 6. Verify Recommendation shifts (Topic C should be recommended if B mastered)
        // We need to trigger evaluateAndUpdateUnlocks which should unlock more topics
        // Let's check if 'Basic Math' or something was unlocked if Prereqs passed.
        // Actually, our seed topics don't have linear dependencies set up in Topic model.
        // But the engine fallback logic CURRICULUM_STRUCTURE in masteryService might trigger.
    });
});
