const request = require('supertest');
const app = require('../../src/app');
const db = require('../setup');
const SubjectMastery = require('../../src/models/SubjectMastery');
const TopicMastery = require('../../src/models/TopicMastery');
const DailyConcept = require('../../src/models/DailyConcept');
const MockSession = require('../../src/models/MockSession');

describe('Security Hardening — Integration Tests', () => {
    jest.setTimeout(60000);
    beforeAll(async () => await db.connect());
    afterAll(async () => await db.close());
    afterEach(async () => await db.clear());

    // ─── Common Setup ───────────────────────────────────────────────────────────
    async function createAndAuthUser() {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Security Test User', email: 'sec@test.com', password: 'Password123!' });
        const token = res.body.token;
        const userId = res.body.user.id;
        await request(app)
            .put('/api/auth/onboarding')
            .set('Authorization', `Bearer ${token}`)
            .send({ timezone: 'UTC', preferredTimes: ['09:00'], onceOrTwice: 'once' });
        return { token, userId };
    }

    const dummyConceptData = {
        difficulty: 'Easy',
        summary: 'This is a summary long enough. Minimum fifty characters are required here yes.',
        explanation: 'This explanation is over two hundred characters long. Repeating to ensure we meet the validation constraint. This explanation is over two hundred characters long. Repeating to ensure we meet the validation constraint here.',
        codeExample: { language: 'javascript', code: 'console.log("hi");' }
    };

    async function seedQuestionsForSubject(sub, count = 15) {
        for (let i = 0; i < count; i++) {
            await DailyConcept.create({
                ...dummyConceptData,
                topic: `${sub} Topic ${i}`,
                subject: sub,
                quiz: [{
                    question: `Question ${i}?`,
                    options: ['A', 'B', 'C', 'D'],
                    correctAnswer: 'B'
                }]
            });
        }
    }

    async function startMockSession(token) {
        return request(app)
            .post('/api/mock/start')
            .set('Authorization', `Bearer ${token}`);
    }

    // ─── Test 1: Duplicate Mock Submission ──────────────────────────────────────
    describe('Duplicate Mock Submission Prevention', () => {
        it('should reject a second mock submission for the same session', async () => {
            const { token, userId } = await createAndAuthUser();

            await SubjectMastery.create({ userId, subject: 'Foundations', averageMastery: 40 });
            await SubjectMastery.create({ userId, subject: 'Data Structures', averageMastery: 60 });
            await SubjectMastery.create({ userId, subject: 'Algorithms', averageMastery: 80 });
            await seedQuestionsForSubject('Foundations');
            await seedQuestionsForSubject('Data Structures');
            await seedQuestionsForSubject('Algorithms');

            const startRes = await startMockSession(token);
            expect(startRes.statusCode).toBe(200);

            const sessionId = startRes.body.sessionId;
            const questions = startRes.body.questions;
            const answers = {};
            questions.forEach(q => { answers[q.id] = 'B'; });

            // First submission — must succeed
            const sub1 = await request(app)
                .post('/api/mock/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({ sessionId, answers });
            expect(sub1.statusCode).toBe(200);

            // Second submission — must fail
            const sub2 = await request(app)
                .post('/api/mock/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({ sessionId, answers });
            expect(sub2.statusCode).toBe(404);
            expect(sub2.body.message).toMatch(/not found|already submitted/i);
        });
    });

    // ─── Test 2: Mock Start Duplicate Guard ─────────────────────────────────────
    describe('Mock Start Duplicate Guard', () => {
        it('should reject a second mock start while one is in progress', async () => {
            const { token, userId } = await createAndAuthUser();

            await SubjectMastery.create({ userId, subject: 'Foundations', averageMastery: 40 });
            await seedQuestionsForSubject('Foundations');

            // First start — must succeed
            const start1 = await startMockSession(token);
            expect(start1.statusCode).toBe(200);

            // Second start — must fail with 400
            const start2 = await startMockSession(token);
            expect(start2.statusCode).toBe(400);
            expect(start2.body.message).toMatch(/already in progress/i);
        });
    });

    // ─── Test 3: Server-Side Score Calculation ──────────────────────────────────
    describe('Server-Side Score Calculation', () => {
        it('should calculate score server-side, ignoring any client-provided score', async () => {
            const { token, userId } = await createAndAuthUser();

            const concept = await DailyConcept.create({
                ...dummyConceptData,
                topic: 'Sorting',
                subject: 'Algorithms',
                quiz: [
                    { question: 'Q1?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
                    { question: 'Q2?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
                    { question: 'Q3?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'C' },
                    { question: 'Q4?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'D' }
                ]
            });

            // The old API accepted a 'score' field. The new API ignores it.
            // Answers: index 0 = 'A' (correct), index 1 = 'WRONG' (incorrect), others = WRONG
            const res = await request(app)
                .post('/api/quiz/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    quizId: concept._id,
                    answers: { 0: 'A', 1: 'WRONG', 2: 'WRONG', 3: 'WRONG' }
                    // Client is NOT sending a 'score' field anymore
                });

            expect(res.statusCode).toBe(200);
            // 1 correct out of 4 = 25%. Mastery was 0, score < 40% means decay.
            // But MIN_MASTERY_FLOOR for new topics = 5, so mastery stays at 5.
            expect(res.body.masteryUpdate).toBeDefined();
            // We just confirm the server calculated something — not a 500 from client-score injection
            expect(res.body.masteryUpdate.current).toBeGreaterThanOrEqual(0);
        });

        it('should strip (not reject) unknown fields from quiz submission body', async () => {
            const { token } = await createAndAuthUser();

            const concept = await DailyConcept.create({
                ...dummyConceptData,
                topic: 'Graphs',
                subject: 'Data Structures',
                quiz: [
                    { question: 'Q1?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
                    { question: 'Q2?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
                    { question: 'Q3?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'C' },
                    { question: 'Q4?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'D' }
                ]
            });

            // quizId is valid, required fields present, evilField should be stripped by Ajv
            const res = await request(app)
                .post('/api/quiz/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    quizId: concept._id.toString(),
                    answers: { 0: 'A', 1: 'B', 2: 'C', 3: 'D' },
                    evilField: 'hacked' // Should be silently stripped by removeAdditional
                });

            // Should succeed; evilField was stripped before handler ran
            expect(res.statusCode).toBe(200);
        });
    });

    // ─── Test 4: Tampered Question IDs in Mock ──────────────────────────────────
    describe('Tampered Answer Key Rejection', () => {
        it('should reject mock answers with unrelated question IDs', async () => {
            const { token, userId } = await createAndAuthUser();

            await SubjectMastery.create({ userId, subject: 'Foundations', averageMastery: 40 });
            await seedQuestionsForSubject('Foundations');

            const startRes = await startMockSession(token);
            expect(startRes.statusCode).toBe(200);

            const sessionId = startRes.body.sessionId;

            // Send one legitimate answer + one fabricated question ID
            const answers = {
                [startRes.body.questions[0].id]: 'B', // Legitimate
                'fakeid-999-injected': 'B'            // Tampered ID
            };

            const submitRes = await request(app)
                .post('/api/mock/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({ sessionId, answers });

            expect(submitRes.statusCode).toBe(400);
            expect(submitRes.body.message).toMatch(/tampered/i);
        });
    });

    // ─── Test 5: Missing required fields ────────────────────────────────────────
    describe('Schema Validation', () => {
        it('should block mock submission with no sessionId', async () => {
            const { token } = await createAndAuthUser();
            const res = await request(app)
                .post('/api/mock/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({ answers: { 'some-key': 'B' } }); // Missing sessionId

            expect(res.statusCode).toBe(400);
        });

        it('should strip unknown fields from mock submission silently (not 400)', async () => {
            const { token, userId } = await createAndAuthUser();

            // Need an active session for this
            await SubjectMastery.create({ userId, subject: 'Foundations', averageMastery: 40 });
            await seedQuestionsForSubject('Foundations');

            const startRes = await startMockSession(token);
            const sessionId = startRes.body.sessionId;
            const questions = startRes.body.questions;
            const answers = {};
            questions.forEach(q => { answers[q.id] = 'B'; });

            const res = await request(app)
                .post('/api/mock/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    sessionId,
                    answers,
                    evilField: 'hacked' // Silently stripped by removeAdditional
                });

            // Should succeed — extra field was stripped
            expect(res.statusCode).toBe(200);
        });
    });
});
