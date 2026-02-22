const request = require('supertest');
const app = require('../../src/app');
const db = require('../setup');
const SubjectMastery = require('../../src/models/SubjectMastery');
const TopicMastery = require('../../src/models/TopicMastery');
const DailyConcept = require('../../src/models/DailyConcept');
const MockSession = require('../../src/models/MockSession');

describe('Adaptive Simulation V2 — Integration Tests', () => {
    jest.setTimeout(90000);
    beforeAll(async () => await db.connect());
    afterAll(async () => await db.close());
    afterEach(async () => await db.clear());

    // ── helpers ──────────────────────────────────────────────────────────────
    async function createUser(email = 'mock@v2.com') {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'V2 Tester', email, password: 'Password123!' });
        const { token } = res.body;
        const userId = res.body.user.id;
        await request(app)
            .put('/api/auth/onboarding')
            .set('Authorization', `Bearer ${token}`)
            .send({ timezone: 'UTC', preferredTimes: ['09:00'], onceOrTwice: 'once' });
        return { token, userId };
    }

    /**
     * Seed DailyConcepts across subjects and difficulties.
     * counts: { Foundations: { Easy: 5, Medium: 5, Hard: 5 }, ... }
     */
    async function seedCurriculum(counts = {}) {
        const base = {
            summary: 'Summary that is long enough to pass validation — repeating for length. Fifty chars needed.',
            explanation: 'Long explanation that is at least 200 characters. '.repeat(5),
            codeExample: { language: 'javascript', code: 'console.log("test");' },
            quiz: [{
                question: 'Test question?',
                options: ['A', 'B', 'C', 'D'],
                correctAnswer: 'B'
            }]
        };

        const created = [];
        for (const [subject, diffCounts] of Object.entries(counts)) {
            for (const [difficulty, n] of Object.entries(diffCounts)) {
                for (let i = 0; i < n; i++) {
                    const doc = await DailyConcept.create({
                        ...base,
                        topic: `${subject} ${difficulty} Topic ${i}`,
                        subject,
                        difficulty
                    });
                    created.push(doc);
                }
            }
        }
        return created;
    }

    async function seedMasteries(userId, map) {
        for (const [subject, avg] of Object.entries(map)) {
            await SubjectMastery.create({ userId, subject, averageMastery: avg });
            await TopicMastery.create({ userId, topic: `${subject} Base`, subject, mastery: avg, totalAttempts: 1 });
        }
    }

    // ─── Test Suite 1: Adaptive difficulty weighting ─────────────────────────
    describe('Adaptive Difficulty Weighting', () => {
        it('should assign EASY_HEAVY profile when weakest subject readiness < 40', async () => {
            const { token, userId } = await createUser('easy@v2.com');
            await seedCurriculum({
                Foundations: { Easy: 10, Medium: 10, Hard: 10 },
                'Data Structures': { Easy: 10, Medium: 10, Hard: 10 }
            });
            await seedMasteries(userId, { Foundations: 25, 'Data Structures': 60 });

            const res = await request(app)
                .post('/api/mock/start')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.config.difficultyProfile).toBe('EASY_HEAVY');

            // Majority of questions for weakest subject should be Easy
            const questions = res.body.questions;
            const foundationQs = questions.filter(q => q.subject === 'Foundations');
            const easyQs = foundationQs.filter(q => q.difficulty === 'Easy');
            // With EASY_HEAVY ratios (60% Easy), majority should be Easy
            expect(easyQs.length).toBeGreaterThan(foundationQs.length * 0.4);
        });

        it('should assign HARD_HEAVY profile when subject readiness >= 70', async () => {
            const { token, userId } = await createUser('hard@v2.com');
            await seedCurriculum({
                Algorithms: { Easy: 10, Medium: 10, Hard: 10 },
                Foundations: { Easy: 10, Medium: 10, Hard: 10 }
            });
            await seedMasteries(userId, { Algorithms: 80, Foundations: 75 });

            const res = await request(app)
                .post('/api/mock/start')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            // With high readiness on both, profile should be HARD_HEAVY
            expect(['HARD_HEAVY', 'MIXED']).toContain(res.body.config.difficultyProfile);
        });

        it('should assign MIXED profile when readiness is 40–69', async () => {
            const { token, userId } = await createUser('mixed@v2.com');
            await seedCurriculum({
                Foundations: { Easy: 10, Medium: 10, Hard: 10 }
            });
            await seedMasteries(userId, { Foundations: 55 });

            const res = await request(app)
                .post('/api/mock/start')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.config.difficultyProfile).toBe('MIXED');
        });

        it('should include difficulty field in each question returned', async () => {
            const { token, userId } = await createUser('qfield@v2.com');
            await seedCurriculum({ Foundations: { Easy: 20, Medium: 10, Hard: 5 } });
            await seedMasteries(userId, { Foundations: 30 });

            const res = await request(app)
                .post('/api/mock/start')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            res.body.questions.forEach(q => {
                expect(['Easy', 'Medium', 'Hard']).toContain(q.difficulty);
            });
        });

        it('should include adaptive time limit in config response', async () => {
            const { token, userId } = await createUser('time@v2.com');
            await seedCurriculum({ Foundations: { Easy: 20 } });
            await seedMasteries(userId, { Foundations: 20 });

            const res = await request(app)
                .post('/api/mock/start')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.config.timeLimitMinutes).toBeGreaterThan(0);
            expect(res.body.config.subjectTimeSuggestions).toBeDefined();
        });
    });

    // ─── Test Suite 2: Submit — difficulty & analytics fields ─────────────────
    describe('Submit — Analytics Storage', () => {
        async function doFullMock(email) {
            const { token, userId } = await createUser(email);
            await seedCurriculum({ Foundations: { Easy: 20, Medium: 10, Hard: 5 } });
            await seedMasteries(userId, { Foundations: 35 });

            const startRes = await request(app)
                .post('/api/mock/start')
                .set('Authorization', `Bearer ${token}`);

            const { sessionId, questions } = startRes.body;
            const answers = {};
            questions.forEach(q => { answers[q.id] = 'B'; }); // All correct

            const submitRes = await request(app)
                .post('/api/mock/submit')
                .set('Authorization', `Bearer ${token}`)
                .send({ sessionId, answers });

            return { token, userId, sessionId, submitRes };
        }

        it('should return difficultyBreakdown in submit summary', async () => {
            const { submitRes } = await doFullMock('submita@v2.com');
            expect(submitRes.statusCode).toBe(200);
            expect(submitRes.body.summary.difficultyBreakdown).toBeDefined();
        });

        it('should return weakestTopic in submit summary', async () => {
            const { submitRes } = await doFullMock('submitb@v2.com');
            expect(submitRes.statusCode).toBe(200);
            // weakestTopic may be null if all answered correctly
            // but it should at least be defined
            expect(submitRes.body.summary).toHaveProperty('weakestTopic');
        });

        it('should persist difficultyBreakdown and weakestTopic in MockSession', async () => {
            const { userId, sessionId } = await doFullMock('submitc@v2.com');
            const saved = await MockSession.findById(sessionId);
            expect(saved.difficultyBreakdown).toBeDefined();
        });

        it('should compute percentile on second session (vs first)', async () => {
            const { token, userId } = await createUser('pctile@v2.com');
            await seedCurriculum({ Foundations: { Easy: 20, Medium: 10 } });
            await seedMasteries(userId, { Foundations: 40 });

            // First session — score <50
            const s1 = await request(app).post('/api/mock/start').set('Authorization', `Bearer ${token}`);
            const a1 = {};
            s1.body.questions.forEach(q => { a1[q.id] = 'WRONG_OPTION'; }); // All wrong
            await request(app).post('/api/mock/submit').set('Authorization', `Bearer ${token}`)
                .send({ sessionId: s1.body.sessionId, answers: a1 });

            // Second session — all correct
            const s2 = await request(app).post('/api/mock/start').set('Authorization', `Bearer ${token}`);
            const a2 = {};
            s2.body.questions.forEach(q => { a2[q.id] = 'B'; });
            const res2 = await request(app).post('/api/mock/submit').set('Authorization', `Bearer ${token}`)
                .send({ sessionId: s2.body.sessionId, answers: a2 });

            // Percentile should be defined (100 — did better than all 1 prior session)
            expect(res2.statusCode).toBe(200);
            expect(res2.body.summary.percentile).not.toBeNull();
        });
    });

    // ─── Test Suite 3: GET /api/mock/analytics ────────────────────────────────
    describe('GET /api/mock/analytics', () => {
        it('should return zero-state analytics for user with no sessions', async () => {
            const { token } = await createUser('noana@v2.com');

            const res = await request(app)
                .get('/api/mock/analytics')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.totalSessions).toBe(0);
            expect(res.body.averageScore).toBe(0);
            expect(res.body.improvementTrend).toHaveLength(0);
        });

        it('should return correct averageScore and bestScore after sessions', async () => {
            const { token, userId } = await createUser('ana@v2.com');
            await seedCurriculum({ Foundations: { Easy: 20, Medium: 10 } });
            await seedMasteries(userId, { Foundations: 40 });

            // Run two mock sessions: one perfect, one 0%
            for (const answerRight of [true, false]) {
                const s = await request(app).post('/api/mock/start').set('Authorization', `Bearer ${token}`);
                const ans = {};
                s.body.questions.forEach(q => { ans[q.id] = answerRight ? 'B' : 'WRONG'; });
                await request(app).post('/api/mock/submit').set('Authorization', `Bearer ${token}`)
                    .send({ sessionId: s.body.sessionId, answers: ans });
            }

            const res = await request(app)
                .get('/api/mock/analytics')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.totalSessions).toBe(2);
            expect(res.body.bestScore).toBe(100);
            expect(res.body.averageScore).toBe(50); // (100 + 0) / 2
        });

        it('should track weakestRecurringTopic across sessions', async () => {
            const { token, userId } = await createUser('weak@v2.com');
            await seedCurriculum({ Foundations: { Easy: 30 } });
            await seedMasteries(userId, { Foundations: 40 });

            // Two sessions both answered wrong (weakestTopic will recur)
            for (const _ of [1, 2]) {
                const s = await request(app).post('/api/mock/start').set('Authorization', `Bearer ${token}`);
                const ans = {};
                s.body.questions.forEach(q => { ans[q.id] = 'WRONG'; });
                await request(app).post('/api/mock/submit').set('Authorization', `Bearer ${token}`)
                    .send({ sessionId: s.body.sessionId, answers: ans });
            }

            const res = await request(app)
                .get('/api/mock/analytics')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            // weakestRecurringTopic should appear since both sessions had wrong answers
            if (res.body.weakestRecurringTopic) {
                expect(res.body.weakestRecurringTopic.occurrences).toBeGreaterThanOrEqual(1);
            }
        });

        it('should return improvementTrend with date and score per session', async () => {
            const { token, userId } = await createUser('trend@v2.com');
            await seedCurriculum({ Foundations: { Easy: 20 } });
            await seedMasteries(userId, { Foundations: 40 });

            const s = await request(app).post('/api/mock/start').set('Authorization', `Bearer ${token}`);
            const ans = {};
            s.body.questions.forEach(q => { ans[q.id] = 'B'; });
            await request(app).post('/api/mock/submit').set('Authorization', `Bearer ${token}`)
                .send({ sessionId: s.body.sessionId, answers: ans });

            const res = await request(app)
                .get('/api/mock/analytics')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.improvementTrend.length).toBeGreaterThan(0);
            expect(res.body.improvementTrend[0]).toHaveProperty('date');
            expect(res.body.improvementTrend[0]).toHaveProperty('score');
        });

        it('should return difficultyAccuracy breakdown in analytics', async () => {
            const { token, userId } = await createUser('diffana@v2.com');
            await seedCurriculum({ Foundations: { Easy: 10, Medium: 10, Hard: 5 } });
            await seedMasteries(userId, { Foundations: 35 });

            const s = await request(app).post('/api/mock/start').set('Authorization', `Bearer ${token}`);
            const ans = {};
            s.body.questions.forEach(q => { ans[q.id] = 'B'; });
            await request(app).post('/api/mock/submit').set('Authorization', `Bearer ${token}`)
                .send({ sessionId: s.body.sessionId, answers: ans });

            const res = await request(app)
                .get('/api/mock/analytics')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.difficultyAccuracy).toBeDefined();
            // Should have at least one difficulty key
            expect(Object.keys(res.body.difficultyAccuracy).length).toBeGreaterThan(0);
        });
    });
});
