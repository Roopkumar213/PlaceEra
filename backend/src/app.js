require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/daily'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/curriculum', require('./routes/curriculum'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/system', require('./routes/system'));
app.use('/api/recommendation', require('./routes/recommendation'));

module.exports = app;
