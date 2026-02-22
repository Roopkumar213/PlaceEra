const request = require('supertest');
const app = require('../../src/app');
const db = require('../setup');
const User = require('../../src/models/User');
const Topic = require('../../src/models/Topic');
const Subject = require('../../src/models/Subject');
const DailyConcept = require('../../src/models/DailyConcept');
const TopicMastery = require('../../src/models/TopicMastery');

describe('Full User Journey Integration', () => {
    jest.setTimeout(60000); // Higher timeout for replica set startup
    beforeAll(async () => await db.connect());
    afterAll(async () => await db.close());
    afterEach(async () => await db.clear());

    it('should complete a full cycle: Signup -> Onboarding -> Quiz -> Unlock -> Recommendation', async () => {
        // 1. SIGNUP
        const signupRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'Password123!'
            });

        expect(signupRes.statusCode).toBe(200);
        const token = signupRes.body.token;
        const userId = signupRes.body.user.id;

        // 2. ONBOARDING
        const onboardingRes = await request(app)
            .put('/api/auth/onboarding')
            .set('Authorization', `Bearer ${token}`)
            .send({
                timezone: 'UTC',
                preferredTimes: ['09:00'],
                onceOrTwice: 'once'
            });

        expect(onboardingRes.statusCode).toBe(200);

        // Seed some data for the engine
        await Subject.create({ name: 'Foundations', orderIndex: 1 });
        await Topic.create({ name: 'Big O Notation', subject: 'Foundations', orderIndex: 1 });
        await Topic.create({ name: 'Arrays & Strings', subject: 'Foundations', orderIndex: 2 });
        await Topic.create({ name: 'Basic Math', subject: 'Foundations', orderIndex: 3 });

        // 3. DASHBOARD LOAD (Initializes Mastery)
        const dashRes = await request(app)
            .get('/api/progress/dashboard')
            .set('Authorization', `Bearer ${token}`);

        expect(dashRes.statusCode).toBe(200);

        // bootstrap-logic: initializes first 2 topics
        let masteryA = await TopicMastery.findOne({ userId, topic: 'Big O Notation' });
        expect(masteryA.unlocked).toBe(true);
        let masteryB = await TopicMastery.findOne({ userId, topic: 'Arrays & Strings' });
        expect(masteryB.unlocked).toBe(true);

        // Topic C should be locked because Topic B has no mastery yet
        let masteryC = await TopicMastery.findOne({ userId, topic: 'Basic Math' });
        expect(masteryC).toBeNull();

        // 4. QUIZ SUBMISSION (Passing Topic A & B)
        const dummyValidData = {
            difficulty: 'Easy',
            summary: 'This is a summary that is long enough to pass the validation of 50 characters. This is a summary that is long enough to pass the validation of 50 characters.',
            explanation: 'This is a long explanation that is at least 200 characters long. Let us repeat it to reach the limit. This is a long explanation that is at least 200 characters long. Let us repeat it to reach the limit. This is a long explanation that is at least 200 characters long.',
            codeExample: {
                language: 'javascript',
                code: 'console.log("hello");'
            },
            quiz: [{
                question: 'What is 1+1?',
                options: ['1', '2', '3', '4'],
                correctAnswer: '2'
            }]
        };

        // Set A and B to 65 so quizes make them "Mastered"
        await TopicMastery.updateMany({ userId }, { $set: { mastery: 65 } });

        const quizA = await DailyConcept.create({
            ...dummyValidData,
            topic: 'Big O Notation',
            subject: 'Foundations',
            title: 'Big O Quiz'
        });

        const resA = await request(app)
            .post('/api/quiz/submit')
            .set('Authorization', `Bearer ${token}`)
            .send({
                quizId: quizA._id,
                answers: { 0: '2' }, // Correct answer is '2' for our dummy quiz
                submissionId: 'test-sub-a'
            });
        expect(resA.statusCode).toBe(200);

        const quizB = await DailyConcept.create({
            ...dummyValidData,
            topic: 'Arrays & Strings',
            subject: 'Foundations',
            title: 'Arrays Quiz'
        });

        const resB = await request(app)
            .post('/api/quiz/submit')
            .set('Authorization', `Bearer ${token}`)
            .send({
                quizId: quizB._id,
                answers: { 0: '2' }, // Correct answer is '2'
                submissionId: 'test-sub-b'
            });
        expect(resB.statusCode).toBe(200);

        // 5. UNLOCK VERIFICATION (Topic C should now be unlocked)
        masteryC = await TopicMastery.findOne({ userId, topic: 'Basic Math' });
        expect(masteryC).not.toBeNull();
        expect(masteryC.unlocked).toBe(true);

        // EXTRA: Verify SubjectMastery consistency
        const SubjectMastery = require('../../src/models/SubjectMastery');
        const subMastery = await SubjectMastery.findOne({ userId, subject: 'Foundations' });
        expect(subMastery.totalAttempts).toBe(2);
        expect(subMastery.totalTopics).toBe(2);

        // 6. RECOMMENDATION
        const recoRes = await request(app)
            .get('/api/recommendation')
            .set('Authorization', `Bearer ${token}`);

        expect(recoRes.statusCode).toBe(200);
        expect(recoRes.body.topicId).toBe('Basic Math');
        expect(recoRes.body.status).toBe('AVAILABLE');
    });
});
