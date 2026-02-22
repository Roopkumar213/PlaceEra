const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter for sensitive endpoints.
 * Uses userId-based keying to prevent per-user abuse,
 * falling back to IP for unauthenticated routes.
 * 
 * Note: keyGenerator uses req.user.id (string), NOT req.ip directly,
 * which avoids the IPv6 ambiguity warning from express-rate-limit.
 */
const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 submissions per user per window
    message: {
        success: false,
        message: 'Too many submission attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }, // Suppress IPv6 validation in controlled environments
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => {
        // Always prefer user ID (avoids IP-based IPv6 issues)
        return req.user ? `user:${req.user.id}` : `ip:${req.socket.remoteAddress}`;
    }
});

const mockStartLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Max 3 mock starts per user per hour
    message: {
        success: false,
        message: 'Too many mock test starts. Please focus on daily quizzes and try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => req.user ? `user:${req.user.id}` : `ip:${req.socket.remoteAddress}`
});

module.exports = {
    submissionLimiter,
    mockStartLimiter
};
