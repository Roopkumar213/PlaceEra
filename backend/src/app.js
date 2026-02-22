require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');

const app = express();

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());

// CORS: restrict to known origins in production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server (no origin) and known origins
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true
}));

// Global API rate limiter: 200 requests per 15 minutes per user/IP
// Applied BEFORE route handlers. Per-route limiters (quiz, mock) add stricter limits on top.
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: req => req.user ? `user:${req.user.id}` : `ip:${req.socket?.remoteAddress ?? 'unknown'}`,
    message: { message: 'Too many requests. Please slow down.' }
});
app.use('/api', globalLimiter);

app.use(express.json({ limit: '1mb' })); // Guard against oversized payloads
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', env: process.env.NODE_ENV ?? 'development' });
});

app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/daily'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/curriculum', require('./routes/curriculum'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/system', require('./routes/system'));
app.use('/api/recommendation', require('./routes/recommendation'));
app.use('/api/mock', require('./routes/mock'));
app.use('/api/user', require('./routes/user'));

// Global Error Handler (Must be last)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
