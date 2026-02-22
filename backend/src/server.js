const app = require('./app');
const mongoose = require('mongoose');

// Database Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/placeera';

mongoose.connect(MONGO_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true
})
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Jobs
if (process.env.REDIS_ENABLED !== 'false' && process.env.NODE_ENV !== 'test') {
    const startDecayJob = require('./jobs/masteryDecayJob');
    startDecayJob();
    console.log('📡 Queue System: Enabled');
} else if (process.env.NODE_ENV !== 'test') {
    console.log('📡 Queue System: Disabled (Local Mode)');
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
