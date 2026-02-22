const request = require('supertest');
const app = require('../../src/app');
const db = require('../setup');
const User = require('../../src/models/User');
const LearningEventLog = require('../../src/models/LearningEventLog');
const DailyConcept = require('../../src/models/DailyConcept');
const {
    updateStreakAndBehavior,
    computeBehavioralState,
    getBehavioralSummary,
    BURNOUT_QUIZ_THRESHOLD,
    PLATEAU_LOOKBACK,
    PLATEAU_VELOCITY_THRESHOLD
} = require('../../src/services/behaviorService');

describe('Behavioral Intelligence Layer — Integration Tests', () => {
    jest.setTimeout(60000);
    beforeAll(async () => await db.connect());
    afterAll(async () => await db.close());
    afterEach(async () => await db.clear());

    // ─── Helper: Create authenticated user ──────────────────────────────────
    async function createUser() {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Behavioral Test User', email: 'beh@test.com', password: 'Password123!' });
        const token = res.body.token;
        const userId = res.body.user.id;
        await request(app)
            .put('/api/auth/onboarding')
            .set('Authorization', `Bearer ${token}`)
            .send({ timezone: 'UTC', preferredTimes: ['09:00'], onceOrTwice: 'once' });
        return { token, userId };
    }

    async function seedQuizEvents(userId, count, deltaBetweenEach = 0.5) {
        const events = [];
        for (let i = 0; i < count; i++) {
            events.push({
                userId,
                topicId: `Topic${i}`,
                subject: 'Algorithms',
                eventType: 'QUIZ_SUBMIT',
                previousMastery: 50,
                newMastery: 50 + deltaBetweenEach,
                delta: deltaBetweenEach,
                timestamp: new Date(Date.now() - (count - i) * 60000) // 1-min intervals
            });
        }
        await LearningEventLog.insertMany(events);
    }

    // ─── Test 1: Streak increments correctly ──────────────────────────────────
    describe('Streak System', () => {
        it('should start streak at 1 on first activity', async () => {
            const { userId } = await createUser();
            await updateStreakAndBehavior(userId);
            const user = await User.findById(userId);
            expect(user.streak).toBe(1);
        });

        it('should increment streak on consecutive days', async () => {
            const { userId } = await createUser();
            const yesterday = new Date(Date.now() - 86400000);

            // Simulate first activity yesterday
            await User.findByIdAndUpdate(userId, {
                streak: 3,
                lastActiveDate: yesterday
            });

            // Activity today → should increment to 4
            await updateStreakAndBehavior(userId);

            const user = await User.findById(userId);
            expect(user.streak).toBe(4);
        });

        it('should NOT double-increment streak for same day activity', async () => {
            const { userId } = await createUser();
            await updateStreakAndBehavior(userId); // First call today

            const user1 = await User.findById(userId);
            expect(user1.streak).toBe(1);

            await updateStreakAndBehavior(userId); // Second call same day

            const user2 = await User.findById(userId);
            expect(user2.streak).toBe(1); // Must not increment again
        });

        it('should reset streak if gap > 1 day', async () => {
            const { userId } = await createUser();
            const threeDaysAgo = new Date(Date.now() - 3 * 86400000);

            await User.findByIdAndUpdate(userId, {
                streak: 10,
                lastActiveDate: threeDaysAgo
            });

            await updateStreakAndBehavior(userId);

            const user = await User.findById(userId);
            expect(user.streak).toBe(1); // Reset to 1
        });

        it('should expose streak in dashboard response', async () => {
            const { token, userId } = await createUser();
            await User.findByIdAndUpdate(userId, { streak: 7, lastActiveDate: new Date() });

            const res = await request(app)
                .get('/api/progress/dashboard')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            // The dashboard exposes streak directly + via behavior object
            expect(res.body).toHaveProperty('behavior');
            expect(res.body.behavior).toHaveProperty('streakDays');
        });
    });

    // ─── Test 2: Plateau Detection ────────────────────────────────────────────
    describe('Plateau Detection', () => {
        it('should detect PLATEAU when recent velocity is below threshold', async () => {
            const { userId } = await createUser();

            // Seed PLATEAU_LOOKBACK events with tiny deltas (all below threshold / 2)
            await seedQuizEvents(userId, PLATEAU_LOOKBACK, PLATEAU_VELOCITY_THRESHOLD / 2 - 0.1);

            const state = await computeBehavioralState(userId);
            expect(state.state).toBe('PLATEAU');
            expect(state.meta.avgVelocity).toBeLessThan(PLATEAU_VELOCITY_THRESHOLD);
        });

        it('should NOT detect PLATEAU with high velocity', async () => {
            const { userId } = await createUser();

            // Seed events with high deltas (above threshold)
            await seedQuizEvents(userId, PLATEAU_LOOKBACK, PLATEAU_VELOCITY_THRESHOLD * 3);

            const state = await computeBehavioralState(userId);
            expect(state.state).not.toBe('PLATEAU');
        });

        it('should NOT detect PLATEAU with fewer than PLATEAU_LOOKBACK events', async () => {
            const { userId } = await createUser();
            await seedQuizEvents(userId, PLATEAU_LOOKBACK - 1, 0.01);

            const state = await computeBehavioralState(userId);
            // With insufficient data, can't assert plateau even with low deltas
            expect(state.state).not.toBe('PLATEAU');
        });
    });

    // ─── Test 3: Burnout Detection ────────────────────────────────────────────
    describe('Burnout (OVERLOAD) Detection', () => {
        it('should detect OVERLOAD when user exceeds quiz threshold in 24h', async () => {
            const { userId } = await createUser();

            // Seed BURNOUT_QUIZ_THRESHOLD + 1 events within last hour
            const events = [];
            for (let i = 0; i <= BURNOUT_QUIZ_THRESHOLD; i++) {
                events.push({
                    userId,
                    topicId: `Topic${i}`,
                    subject: 'Algorithms',
                    eventType: 'QUIZ_SUBMIT',
                    previousMastery: 50,
                    newMastery: 55,
                    delta: 5,
                    timestamp: new Date(Date.now() - i * 60000) // 1 min apart, all within 24h
                });
            }
            await LearningEventLog.insertMany(events);

            const state = await computeBehavioralState(userId);
            expect(state.state).toBe('OVERLOAD');
            expect(state.meta.todayAttempts).toBeGreaterThan(BURNOUT_QUIZ_THRESHOLD);
        });

        it('should NOT trigger OVERLOAD with exactly BURNOUT_QUIZ_THRESHOLD quizzes', async () => {
            const { userId } = await createUser();
            await seedQuizEvents(userId, BURNOUT_QUIZ_THRESHOLD, 5);

            const state = await computeBehavioralState(userId);
            // Exactly at threshold — should NOT be OVERLOAD (must be strictly more than threshold)
            expect(state.state).not.toBe('OVERLOAD');
        });

        it('should NOT count events older than 24 hours toward burnout', async () => {
            const { userId } = await createUser();

            // All events are > 25 hours ago → should NOT trigger OVERLOAD
            const events = [];
            for (let i = 0; i <= BURNOUT_QUIZ_THRESHOLD + 2; i++) {
                events.push({
                    userId,
                    topicId: `OldTopic${i}`,
                    subject: 'Algorithms',
                    eventType: 'QUIZ_SUBMIT',
                    previousMastery: 50,
                    newMastery: 55,
                    delta: 5,
                    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000) // 26h ago
                });
            }
            await LearningEventLog.insertMany(events);

            const state = await computeBehavioralState(userId);
            expect(state.state).not.toBe('OVERLOAD');
        });
    });

    // ─── Test 4: Behavioral State in Dashboard ────────────────────────────────
    describe('Dashboard Behavioral Exposure', () => {
        it('should expose behavior.behavioralState in dashboard response', async () => {
            const { token } = await createUser();

            const res = await request(app)
                .get('/api/progress/dashboard')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.behavior).toBeDefined();
            expect(res.body.behavior.behavioralState).toBeDefined();
            expect(['OPTIMAL', 'PLATEAU', 'OVERLOAD', 'COLD_START']).toContain(
                res.body.behavior.behavioralState
            );
        });

        it('should expose behavior.velocityHistory as array in dashboard', async () => {
            const { token } = await createUser();

            const res = await request(app)
                .get('/api/progress/dashboard')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body.behavior.velocityHistory)).toBe(true);
        });
    });

    // ─── Test 5: getBehavioralSummary ─────────────────────────────────────────
    describe('getBehavioralSummary utility', () => {
        it('should return a valid behavioral summary object', async () => {
            const { userId } = await createUser();
            const summary = await getBehavioralSummary(userId);

            expect(summary).not.toBeNull();
            expect(summary).toHaveProperty('streakDays');
            expect(summary).toHaveProperty('behavioralState');
            expect(summary).toHaveProperty('behavioralMeta');
            expect(summary).toHaveProperty('velocityHistory');
        });

        it('should return COLD_START for a brand new user with no activity', async () => {
            const { userId } = await createUser();
            const state = await computeBehavioralState(userId);

            expect(state.state).toBe('COLD_START');
        });
    });
});
