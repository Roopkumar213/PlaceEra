const connection = require('./redisClient');

// If Redis is disabled, export dummy functions
if (!connection) {
    module.exports = {
        decayQueue: null,
        addDecayJob: async () => {
            console.log('⚠️  Decay job skipped (Redis disabled)');
            return null;
        }
    };
} else {
    const { Queue } = require('bullmq');

    const decayQueue = new Queue('decay-queue', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            removeOnComplete: true,
            removeOnFail: 500 // Keep last 500 failed jobs for inspection
        }
    });

    const addDecayJob = async (data) => {
        return await decayQueue.add('process-decay', data, {
            // Unique job ID logic to prevent duplicates if needed
            // jobId: `decay-${Date.now()}` 
        });
    };

    module.exports = { decayQueue, addDecayJob };
}
