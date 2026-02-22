const {
    evaluateUnlockState,
    sortSubjectsByWeakness,
    calculateOverallScore
} = require('../../src/utils/engineHelpers');

describe('Adaptive Engine Pure Helpers', () => {

    describe('evaluateUnlockState (Monotonic Unlock Invariant)', () => {
        const mockTopics = [
            { name: 'Topic A', subject: 'Subject X' },
            { name: 'Topic B', subject: 'Subject X' },
            { name: 'Topic C', subject: 'Subject X' }
        ];

        it('should always unlock the first topic in a subject', () => {
            const masteryMap = {};
            const updates = evaluateUnlockState(mockTopics, masteryMap);
            expect(updates).toContainEqual({
                topic: 'Topic A',
                subject: 'Subject X',
                type: 'INITIALIZE'
            });
        });

        it('should unlock Topic N if Topic N-1 mastery >= 70', () => {
            const masteryMap = {
                'Topic A': { mastery: 75, unlocked: true }
            };
            const updates = evaluateUnlockState(mockTopics, masteryMap);
            expect(updates).toContainEqual({
                topic: 'Topic B',
                subject: 'Subject X',
                type: 'INITIALIZE'
            });
        });

        it('should NOT unlock Topic N if Topic N-1 mastery < 70', () => {
            const masteryMap = {
                'Topic A': { mastery: 65, unlocked: true }
            };
            const updates = evaluateUnlockState(mockTopics, masteryMap);
            expect(updates.find(u => u.topic === 'Topic B')).toBeUndefined();
        });

        it('should maintain Monotonic Invariant: never relock an already unlocked topic', () => {
            const masteryMap = {
                'Topic A': { mastery: 10, unlocked: true },
                'Topic B': { mastery: 5, unlocked: true } // Manually unlocked or historical
            };
            // Topic A is only 10, so normally Topic B wouldn't unlock here.
            // But it's already unlocked. We should NOT see an "UNLOCK" or "INITIALIZE" for it.
            const updates = evaluateUnlockState(mockTopics, masteryMap);
            expect(updates.find(u => u.topic === 'Topic B')).toBeUndefined();
        });
    });

    describe('sortSubjectsByWeakness (Deterministic Recommendation)', () => {
        it('should prioritize lower averageMastery', () => {
            const subjects = [
                { subject: 'Sub A', averageMastery: 80 },
                { subject: 'Sub B', averageMastery: 20 }
            ];
            const sorted = sortSubjectsByWeakness(subjects);
            expect(sorted[0].subject).toBe('Sub B');
        });

        it('should tie-break using totalAttempts (lower first)', () => {
            const subjects = [
                { subject: 'Sub A', averageMastery: 50, totalAttempts: 10, createdAt: new Date() },
                { subject: 'Sub B', averageMastery: 50, totalAttempts: 2, createdAt: new Date() }
            ];
            const sorted = sortSubjectsByWeakness(subjects);
            expect(sorted[0].subject).toBe('Sub B');
        });

        it('should handle null/missing values gracefully (Readiness Fairness)', () => {
            const subjects = [
                { subject: 'Sub A', averageMastery: 50, totalAttempts: 10 },
                { subject: 'Sub B', averageMastery: null, totalAttempts: 0 }
            ];
            const sorted = sortSubjectsByWeakness(subjects);
            expect(sorted[0].subject).toBe('Sub B'); // null treated as 0
        });
    });

    describe('calculateOverallScore (Readiness Fairness)', () => {
        it('should calculate weighted average correctly', () => {
            const subjects = [
                { subject: 'Data Structures', averageMastery: 100 }, // weight 0.4
                { subject: 'Foundations', averageMastery: 50 }       // weight 0.2
            ];
            // (100 * 0.4 + 50 * 0.2) / (0.4 + 0.2) = (40 + 10) / 0.6 = 50 / 0.6 = 83.33
            const score = calculateOverallScore(subjects);
            expect(score).toBeCloseTo(83.33, 1);
        });

        it('should return 0 for empty subjects', () => {
            expect(calculateOverallScore([])).toBe(0);
        });
    });
});
