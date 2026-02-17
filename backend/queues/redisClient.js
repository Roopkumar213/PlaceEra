require('dotenv').config();

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false'; // Default to true unless explicitly disabled

if (!REDIS_ENABLED) {
    console.log('⚠️  Redis is disabled. Queue features will not be available.');
    // Export null to prevent any Redis operations
    module.exports = null;
} else {
    const IORedis = require('ioredis');

    const redisConfig = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,
        retryStrategy: (times) => {
            // Stop retrying after 3 attempts to avoid spam
            if (times > 3) {
                console.error('❌ Redis connection failed after 3 attempts. Disabling Redis.');
                return null; // Stop retrying
            }
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    };

    const connection = new IORedis(redisConfig);

    connection.on('connect', () => console.log('✅ Redis Client Connected'));
    connection.on('error', (err) => {
        // Only log once to avoid spam
        if (!connection._errorLogged) {
            console.error('❌ Redis Client Error:', err.message);
            console.log('⚠️  Continuing without Redis. Queue features will be limited.');
            connection._errorLogged = true;
        }
    });

    module.exports = connection;
}
