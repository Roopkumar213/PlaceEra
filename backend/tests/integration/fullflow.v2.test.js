/**
 * Full System Flow V2 Integration Test
 *
 * Covers:
 *  Signup → Onboarding → Dashboard Init → Quiz →
 *  Unlock → Recommendation → Mock → Analytics →
 *  Plateau Simulation → User Analytics → Export → Rebuild
 *
 * Does NOT alter core scoring or unlock algorithms —
 * only exercises the system through existing APIs.
 */

const request = require('supertest');
const app = require('../../src/app');
const db = require('../setup');
const User = require('../../src/models/User');
const Topic = require('../../src/models/Topic');
const Subject = require('../../src/models/Subject');
const DailyConcept = require('../../src/models/DailyConcept');
const TopicMastery = require('../../src/models/TopicMastery');
const SubjectMastery = require('../../src/models/SubjectMastery');
const LearningEventLog = require('../../src/models/LearningEventLog');

describe('Full System Flow V2 — Signup → Quiz → Unlock → Mock → Analytics → Rebuild', () => {
    jest.setTimeout(120000);
    beforeAll(async () => await db.connect());
    afterAll(async () => await db.close());
    afterEach(async () => await db.clear());

    // ── Shared helpers ──────────────────────────────────────────────────────────
    const CONCEPT_BASE = {
        difficulty: 'Medium',
        summary: 'A detailed summary that is at least fifty characters long and readable.',
        explanation: 'A comprehensive explanation that must be at least 200 characters. '.repeat(4),
        codeExample: { language: 'javascript', code: 'console.log("PlaceEra");' },
        quiz: [{
            question: 'Which option is correct?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'B'
        }]
    };

    async function createUser(email = 'system@v2.com') {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'System Tester', email, password: 'Password123!' });
        expect(res.statusCode).toBe(200);
        const { token } = res.body;
        const userId = res.body.user.id;

        await request(app)
            .put('/api/auth/onboarding')
            .set('Authorization', `Bearer ${token}`)
            .send({ timezone: 'UTC', preferredTimes: ['09:00'], onceOrTwice: 'once' });

        return { token, userId };
    }

    async function seedSubjectsAndTopics() {
        await Subject.create({ name: 'Foundations', orderIndex: 1 });
        await Subject.create({ name: 'Data Structures', orderIndex: 2 });
        await Subject.create({ name: 'Algorithms', orderIndex: 3 });

        const topics = [
            { name: 'Big O Notation', subject: 'Foundations', orderIndex: 1 },
            { name: 'Arrays', subject: 'Foundations', orderIndex: 2 },
            { name: 'Linked Lists', subject: 'Data Structures', orderIndex: 1 },
            { name: 'Sorting', subject: 'Algorithms', orderIndex: 1 }
        ];
        await Topic.insertMany(topics);

        for (const t of topics) {
            for (const diff of ['Easy', 'Medium', 'Hard']) {
                for (let i = 0; i < 5; i++) {
                    await DailyConcept.create({
                        ...CONCEPT_BASE,
                        difficulty: diff,
                        topic: t.name,
                        subject: t.subject
                    });
                }
            }
        }
    }

    // ── Test: Full lifecycle in one flow ────────────────────────────────────────
    it('should complete full system flow: Signup → Dashboard → Quiz → Unlock → Recommendation → Mock → Analytics → Rebuild', async () => {
        const { token, userId } = await createUser();
        await seedSubjectsAndTopics();

        // ── 1. DASHBOARD LOAD (triggers mastery bootstrap) ──────────────────────
        const dashRes = await request(app)
            .get('/api/progress/dashboard')
            .set('Authorization', `Bearer ${token}`);

        expect(dashRes.statusCode).toBe(200);
        expect(dashRes.body).toHaveProperty('behavior');
        // Behavior stub must have valid state
        expect(['OPTIMAL', 'COLD_START', 'PLATEAU', 'OVERLOAD']).toContain(dashRes.body.behavior.behavioralState);

        // Bootstrap should have unlocked first 2 topics per subject
        const unlocked = await TopicMastery.find({ userId, unlocked: true });
        expect(unlocked.length).toBeGreaterThan(0);

        // ── 2. QUIZ SUBMISSION on the first topic ───────────────────────────────
        // First, ensure we have a TopicMastery row for Big O Notation at 65
        await TopicMastery.findOneAndUpdate(
            { userId, topic: 'Big O Notation' },
            { $set: { mastery: 65 } }
        );

        const concept = await DailyConcept.findOne({ topic: 'Big O Notation' });
        expect(concept).not.toBeNull();

        const quizRes = await request(app)
            .post('/api/quiz/submit')
            .set('Authorization', `Bearer ${token}`)
            .send({
                quizId: concept._id,
                answers: { 0: 'B' },
                submissionId: 'fullflow-v2-sub-001'
            });

        expect(quizRes.statusCode).toBe(200);
        expect(quizRes.body).toHaveProperty('masteryUpdate');
        expect(quizRes.body.masteryUpdate.current).toBeGreaterThan(0);

        // ── 3. UNLOCK CHAIN ─────────────────────────────────────────────────────
        // Raise Big O mastery ≥ 70 to trigger unlock of next topic
        await TopicMastery.findOneAndUpdate(
            { userId, topic: 'Big O Notation' },
            { $set: { mastery: 72 } }
        );
        // Re-run quiz to trigger unlock evaluation
        const concept2 = await DailyConcept.findOne({ topic: 'Big O Notation' });
        await request(app)
            .post('/api/quiz/submit')
            .set('Authorization', `Bearer ${token}`)
            .send({
                quizId: concept2._id,
                answers: { 0: 'B' },
                submissionId: 'fullflow-v2-sub-002'
            });

        // SubjectMastery should now exist for Foundations
        const subMastery = await SubjectMastery.findOne({ userId, subject: 'Foundations' });
        expect(subMastery).not.toBeNull();

        // ── 4. RECOMMENDATION ──────────────────────────────────────────────────
        const recoRes = await request(app)
            .get('/api/recommendation')
            .set('Authorization', `Bearer ${token}`);

        expect(recoRes.statusCode).toBe(200);
        expect(recoRes.body).toHaveProperty('topicId');

        // ── 5. MOCK TEST ────────────────────────────────────────────────────────
        await SubjectMastery.create({ userId, subject: 'Data Structures', averageMastery: 30 });
        await SubjectMastery.create({ userId, subject: 'Algorithms', averageMastery: 50 });

        const mockStart = await request(app)
            .post('/api/mock/start')
            .set('Authorization', `Bearer ${token}`);

        expect(mockStart.statusCode).toBe(200);
        const { sessionId, questions, config } = mockStart.body;

        // V2: must include difficulty profile
        expect(config.difficultyProfile).toBeDefined();
        expect(['EASY_HEAVY', 'MIXED', 'HARD_HEAVY']).toContain(config.difficultyProfile);

        // All questions must have a difficulty field
        questions.forEach(q => {
            expect(['Easy', 'Medium', 'Hard']).toContain(q.difficulty);
        });

        // Submit all correct
        const mockAnswers = {};
        questions.forEach(q => { mockAnswers[q.id] = 'B'; });

        const mockSubmit = await request(app)
            .post('/api/mock/submit')
            .set('Authorization', `Bearer ${token}`)
            .send({ sessionId, answers: mockAnswers });

        expect(mockSubmit.statusCode).toBe(200);
        expect(mockSubmit.body.summary.totalScore).toBe(100);
        expect(mockSubmit.body.summary).toHaveProperty('difficultyBreakdown');
        expect(mockSubmit.body.summary).toHaveProperty('weakestTopic');

        // ── 6. MOCK ANALYTICS ───────────────────────────────────────────────────
        const analyticsRes = await request(app)
            .get('/api/mock/analytics')
            .set('Authorization', `Bearer ${token}`);

        expect(analyticsRes.statusCode).toBe(200);
        expect(analyticsRes.body.totalSessions).toBe(1);
        expect(analyticsRes.body.bestScore).toBe(100);
        expect(analyticsRes.body.improvementTrend.length).toBeGreaterThan(0);

        // ── 7. USER ANALYTICS ───────────────────────────────────────────────────
        const userAnalyticsRes = await request(app)
            .get('/api/user/analytics')
            .set('Authorization', `Bearer ${token}`);

        expect(userAnalyticsRes.statusCode).toBe(200);
        expect(userAnalyticsRes.body).toHaveProperty('totalQuizzes');
        expect(userAnalyticsRes.body).toHaveProperty('totalMocks');
        expect(userAnalyticsRes.body.totalMocks).toBe(1);
        expect(userAnalyticsRes.body).toHaveProperty('strongestSubject');
        expect(userAnalyticsRes.body).toHaveProperty('weakestSubject');
        expect(Array.isArray(userAnalyticsRes.body.recentVelocity)).toBe(true);
        expect(Array.isArray(userAnalyticsRes.body.subjectBreakdown)).toBe(true);

    });

    // ── Test: Plateau simulation through analytics ───────────────────────────
    it('should detect PLATEAU state when velocity stays flat', async () => {
        const { userId } = await createUser('plateau@v2.com');
        const { computeBehavioralState, PLATEAU_LOOKBACK, PLATEAU_VELOCITY_THRESHOLD } = require('../../src/services/behaviorService');

        // Seed low-delta events (below plateau threshold)
        const events = [];
        const lowDelta = PLATEAU_VELOCITY_THRESHOLD / 4; // Well below threshold
        for (let i = 0; i < PLATEAU_LOOKBACK; i++) {
            events.push({
                userId,
                topicId: 'TestTopic',
                subject: 'Foundations',
                eventType: 'QUIZ_SUBMIT',
                previousMastery: 50,
                newMastery: 50 + lowDelta,
                delta: lowDelta,
                timestamp: new Date(Date.now() - (PLATEAU_LOOKBACK - i) * 60000)
            });
        }
        await LearningEventLog.insertMany(events);

        const state = await computeBehavioralState(userId);
        expect(state.state).toBe('PLATEAU');
        expect(state.meta.avgVelocity).toBeLessThan(PLATEAU_VELOCITY_THRESHOLD);
    });

    // ── Test: Export endpoints ───────────────────────────────────────────────
    it('should export mock history as CSV', async () => {
        const { token, userId } = await createUser('export@v2.com');
        await seedSubjectsAndTopics();

        // Complete a mock session first
        await SubjectMastery.create({ userId, subject: 'Foundations', averageMastery: 45 });
        const mockS = await request(app).post('/api/mock/start').set('Authorization', `Bearer ${token}`);
        if (mockS.statusCode === 200) {
            const ans = {};
            mockS.body.questions.forEach(q => { ans[q.id] = 'B'; });
            await request(app).post('/api/mock/submit').set('Authorization', `Bearer ${token}`)
                .send({ sessionId: mockS.body.sessionId, answers: ans });
        }

        const csvRes = await request(app)
            .get('/api/user/export/csv')
            .set('Authorization', `Bearer ${token}`);

        expect(csvRes.statusCode).toBe(200);
        expect(csvRes.headers['content-type']).toContain('text/csv');
        expect(csvRes.text).toContain('Score(%)');
    });

    it('should export mastery snapshot as JSON', async () => {
        const { token } = await createUser('snapshot@v2.com');
        await seedSubjectsAndTopics();

        // Initialize mastery via dashboard
        await request(app).get('/api/progress/dashboard').set('Authorization', `Bearer ${token}`);

        const jsonRes = await request(app)
            .get('/api/user/export/mastery')
            .set('Authorization', `Bearer ${token}`);

        expect(jsonRes.statusCode).toBe(200);
        expect(jsonRes.headers['content-type']).toContain('application/json');
        const snapshot = JSON.parse(jsonRes.text);
        expect(snapshot).toHaveProperty('exportedAt');
        expect(snapshot).toHaveProperty('topics');
        expect(snapshot).toHaveProperty('subjects');
    });

    // ── Test: System Rebuild ─────────────────────────────────────────────────
    it('should rebuild SubjectMastery and unlocks via POST /api/system/rebuild', async () => {
        const { token, userId } = await createUser('rebuild@v2.com');
        await seedSubjectsAndTopics();

        // Initialize mastery
        await request(app).get('/api/progress/dashboard').set('Authorization', `Bearer ${token}`);

        // Manually corrupt SubjectMastery
        await SubjectMastery.deleteMany({ userId });

        // Run rebuild
        const rebuildRes = await request(app)
            .post('/api/system/rebuild')
            .set('Authorization', `Bearer ${token}`);

        expect(rebuildRes.statusCode).toBe(200);
        expect(rebuildRes.body.message).toContain('complete');
        expect(rebuildRes.body.unlocksEvaluated).toBe(true);

        // SubjectMastery should be re-created
        const rebuilt = await SubjectMastery.find({ userId });
        expect(rebuilt.length).toBeGreaterThan(0);
    });

    // ── Test: Production Guards ──────────────────────────────────────────────
    it('should reject unauthenticated requests on protected endpoints', async () => {
        const endpoints = [
            { method: 'get', path: '/api/progress/dashboard' },
            { method: 'get', path: '/api/user/analytics' },
            { method: 'get', path: '/api/mock/analytics' },
            { method: 'post', path: '/api/system/rebuild' }
        ];

        for (const { method, path: ep } of endpoints) {
            const res = await request(app)[method](ep);
            expect(res.statusCode).toBe(401);
        }
    });

    it('should return 200 on /api/health without auth', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});
