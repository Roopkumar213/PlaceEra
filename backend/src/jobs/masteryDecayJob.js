const cron = require('node-cron');
const { addDecayJob } = require('../../queues/decayQueue');
const { addNotificationJob } = require('../../queues/notificationQueue');

const startScheduler = () => {
    if (!addDecayJob || !addNotificationJob) {
        console.log('⚠️  Scheduler not started: Queue features are disabled (Redis unavailable)');
        return;
    }

    console.log('🕒 Scheduler Started.');

    // 1. Mastery Decay (Daily at Midnight)
    cron.schedule('0 0 * * *', async () => {
        console.log('🕒 Cron Trigger: Enqueueing Mastery Decay Job...');
        try {
            await addDecayJob({
                triggeredAt: new Date(),
                source: 'cron'
            });
            console.log('✅ Decay Job Enqueued.');
        } catch (err) {
            console.error('❌ Failed to enqueue Decay Job:', err);
        }
    });

    // 2. Notifications (Daily at 9 AM)
    // In a real system, we might run this every minute to check user timezones.
    // For now, simpler implementation: Global batch at 9 AM Server Time.
    cron.schedule('0 9 * * *', async () => {
        console.log('🕒 Cron Trigger: Enqueueing Notifications...');
        try {
            // In a real scenario, we might query all users here and enqueue 1 job per user
            // Or enqueue a "BatchNotification" job that the worker expands.
            // Let's assume we enqueue a "ProcessBatch" job.

            await addNotificationJob({
                type: 'DAILY_REMINDER_BATCH',
                triggeredAt: new Date()
            });
            console.log('✅ Notification Batch Job Enqueued.');
        } catch (err) {
            console.error('❌ Failed to enqueue Notification Job:', err);
        }
    });
};

module.exports = startScheduler;
