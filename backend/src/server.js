require('dotenv').config(); // Load from backend/.env first
const path = require('path');
// Also try to load from root if not found (optional, but good for monorepos)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');

const app = express();
app.set('trust proxy', 1); // Enable if behind reverse proxy (Heroku, Nginx, etc.)

// Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { message: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const quizLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 quiz submissions per minute
    message: { message: 'Too many quiz submissions, please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
// Health check BEFORE rate limiter
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use(globalLimiter); // Apply global rate limiting
app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/daily'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/curriculum', require('./routes/curriculum'));
app.use('/api/quiz', quizLimiter, require('./routes/quiz')); // Apply quiz-specific rate limiting
app.use('/api/system', require('./routes/system'));

// Database Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/placeera';

mongoose.connect(MONGO_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true // Sometimes needed for specific network/Atlas configurations
})
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Jobs
const startDecayJob = require('./jobs/masteryDecayJob');
startDecayJob();

const startNotificationScheduler = require('./jobs/notificationScheduler');
startNotificationScheduler();

// Global Error Handler (must be after all routes)
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Don't expose stack traces in production
    const isDev = process.env.NODE_ENV === 'development';

    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        ...(isDev && { stack: err.stack })
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
