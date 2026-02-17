const IORedis = require('ioredis');
require('dotenv').config();

const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

const connection = new IORedis(redisConfig);

connection.on('connect', () => console.log('✅ Redis Client Connected'));
connection.on('error', (err) => console.error('❌ Redis Client Error:', err));

module.exports = connection;
