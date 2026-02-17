const connection = require('./redisClient');

// If Redis is disabled, export dummy functions
if (!connection) {
    module.exports = {
        notificationQueue: null,
        addNotificationJob: async () => {
            console.log('⚠️  Notification job skipped (Redis disabled)');
            return null;
        }
    };
} else {
    const { Queue } = require('bullmq');

    const notificationQueue = new Queue('notification-queue', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: true,
            removeOnFail: 100
        }
    });

    const addNotificationJob = async (data) => {
        // data: { userId, type: 'email'|'push', content: ... }
        return await notificationQueue.add('send-notification', data);
    };

    module.exports = { notificationQueue, addNotificationJob };
}
