require('dotenv').config(); // Load from backend/.env first
const path = require('path');
// Also try to load from root if not found (optional, but good for monorepos)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/daily'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/curriculum', require('./routes/curriculum'));
app.use('/api/quiz', require('./routes/quiz'));

// Database Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/placeera';

mongoose.connect(MONGO_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true // Sometimes needed for specific network/Atlas configurations
})
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
