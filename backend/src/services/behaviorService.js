/**
 * Behavioral Intelligence Service
 * Handles streak tracking, plateau detection, burnout detection, and learning velocity.
 *
 * INVARIANTS:
 * - Never mutates mastery scoring
 * - Never mutates unlock engine state
 * - Only reads LearningEventLog, UserProgress, TopicMastery, and User
 * - Writes only to User.streak, User.lastActiveDate, and User.behavioralState
 */

const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const LearningEventLog = require('../models/LearningEventLog');
const TopicMastery = require('../models/TopicMastery');

// ─── Configuration constants ────────────────────────────────────────────────
const BURNOUT_QUIZ_THRESHOLD = 8;       // More than this many quiz/mock submissions in one day = OVERLOAD
const PLATEAU_LOOKBACK = 5;             // Look at last N QUIZ_SUBMIT events for velocity
const PLATEAU_VELOCITY_THRESHOLD = 2.0; // If avg mastery delta < this across last 5 attempts → PLATEAU
const VELOCITY_LOOKBACK = 10;           // Events to compute recent velocity trend


/**
 * updateStreakAndBehavior
 * Called after every quiz or mock completion.
 * Updates streak days and evaluates behavioral state.
 * @param {string} userId
 */
const updateStreakAndBehavior = async (userId) => {
    try {
        const user = await User.findById(userId).select('+streak +lastActiveDate +behavioralState');
        if (!user) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const lastActiveDateStr = user.lastActiveDate
            ? new Date(user.lastActiveDate).toISOString().split('T')[0]
            : null;

        let newStreak = user.streak ?? 0;

        if (lastActiveDateStr !== todayStr) {
            // Check if yesterday
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            if (lastActiveDateStr === yesterday) {
                // Consecutive day — increment streak
                newStreak = newStreak + 1;
            } else if (lastActiveDateStr === null) {
                // First ever activity
                newStreak = 1;
            } else {
                // Gap > 1 day — reset streak
                newStreak = 1;
            }
        }
        // If already active today, streak stays the same

        // Evaluate behavioral state
        const behavioralState = await computeBehavioralState(userId);

        await User.findByIdAndUpdate(userId, {
            $set: {
                streak: newStreak,
                lastActiveDate: new Date(),
                behavioralState: behavioralState.state,
                behavioralMeta: behavioralState.meta
            }
        });
    } catch (err) {
        console.error('[BehaviorService] updateStreakAndBehavior failed:', err.message);
        // Non-blocking — don't propagate to caller
    }
};


/**
 * computeBehavioralState
 * Derives user's learning behavioral state from activity patterns.
 * Returns { state, meta }
 * States: OPTIMAL | PLATEAU | OVERLOAD | COLD_START
 */
const computeBehavioralState = async (userId) => {
    try {
        const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h

        // 1. Burnout check — count quiz/mock events today
        const todayAttempts = await LearningEventLog.countDocuments({
            userId,
            eventType: { $in: ['QUIZ_SUBMIT', 'MOCK_COMPLETED'] },
            timestamp: { $gte: windowStart }
        });

        if (todayAttempts > BURNOUT_QUIZ_THRESHOLD) {
            return {
                state: 'OVERLOAD',
                meta: {
                    todayAttempts,
                    message: `You've done ${todayAttempts} sessions today. Take a break to consolidate learning.`,
                    suggestion: 'Rest, review, or do a leisurely read. Excessive drilling reduces retention.'
                }
            };
        }

        // 2. Plateau check — look at last N QUIZ_SUBMIT mastery deltas
        const recentEvents = await LearningEventLog.find({
            userId,
            eventType: 'QUIZ_SUBMIT'
        }).sort({ timestamp: -1 }).limit(PLATEAU_LOOKBACK).select('delta');

        if (recentEvents.length >= PLATEAU_LOOKBACK) {
            const avgDelta = recentEvents.reduce((sum, e) => sum + Math.abs(e.delta ?? 0), 0) / recentEvents.length;

            if (avgDelta < PLATEAU_VELOCITY_THRESHOLD) {
                return {
                    state: 'PLATEAU',
                    meta: {
                        avgVelocity: parseFloat(avgDelta.toFixed(2)),
                        message: 'Your mastery progress has slowed. Try harder topics or review foundational concepts.',
                        suggestion: 'Switch to a different subject or attempt the Mock Test to break the plateau.'
                    }
                };
            }
        }

        // 3. Cold start — no recent activity
        if (recentEvents.length === 0 && todayAttempts === 0) {
            return {
                state: 'COLD_START',
                meta: {
                    message: 'No recent activity detected. Let\'s get back on track!',
                    suggestion: 'Start today\'s recommended topic to reignite your learning.'
                }
            };
        }

        // 4. Optimal
        return {
            state: 'OPTIMAL',
            meta: {
                todayAttempts,
                message: 'You\'re in the zone! Keep up the consistent practice.',
                suggestion: 'Continue with today\'s recommendation or attempt a Weekly Mock.'
            }
        };
    } catch (err) {
        console.error('[BehaviorService] computeBehavioralState failed:', err.message);
        return { state: 'OPTIMAL', meta: {} }; // Default safe state
    }
};


/**
 * getLearningVelocity
 * Computes a rolling velocity score from recent mastery changes.
 * Returns array of { date, avgDelta } data points for charting.
 */
const getLearningVelocity = async (userId) => {
    try {
        const events = await LearningEventLog.find({
            userId,
            eventType: 'QUIZ_SUBMIT'
        })
            .sort({ timestamp: -1 })
            .limit(VELOCITY_LOOKBACK)
            .select('delta timestamp');

        if (events.length === 0) return [];

        // Group by date and average delta per day
        const byDate = {};
        events.forEach(e => {
            const d = new Date(e.timestamp).toISOString().split('T')[0];
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(e.delta ?? 0);
        });

        return Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, deltas]) => ({
                date,
                avgDelta: parseFloat(
                    (deltas.reduce((s, d) => s + Math.abs(d), 0) / deltas.length).toFixed(2)
                ),
                count: deltas.length
            }));
    } catch (err) {
        console.error('[BehaviorService] getLearningVelocity failed:', err.message);
        return [];
    }
};


/**
 * getBehavioralSummary
 * Returns the full behavioral snapshot for a user.
 * Used by dashboard and recommendation endpoints.
 */
const getBehavioralSummary = async (userId) => {
    try {
        const user = await User.findById(userId).select('streak lastActiveDate behavioralState behavioralMeta');
        if (!user) return null;

        const streakDays = user.streak ?? 0;

        // Re-compute live state (in case it's stale)
        const liveState = await computeBehavioralState(userId);
        const velocity = await getLearningVelocity(userId);

        return {
            streakDays,
            lastActiveDate: user.lastActiveDate || null,
            behavioralState: liveState.state,
            behavioralMeta: liveState.meta,
            velocityHistory: velocity
        };
    } catch (err) {
        console.error('[BehaviorService] getBehavioralSummary failed:', err.message);
        return null;
    }
};


module.exports = {
    updateStreakAndBehavior,
    getBehavioralSummary,
    getLearningVelocity,
    computeBehavioralState,
    // Expose constants for testing
    BURNOUT_QUIZ_THRESHOLD,
    PLATEAU_LOOKBACK,
    PLATEAU_VELOCITY_THRESHOLD
};
