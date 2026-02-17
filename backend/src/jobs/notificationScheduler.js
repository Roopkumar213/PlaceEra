const cron = require('node-cron');
const { DateTime } = require('luxon');
const User = require('../models/User');
const DailyConcept = require('../models/DailyConcept');

let addNotificationJob;

// Try to load queue modules, but don't fail if Redis is unavailable
try {
    const notificationQueue = require('../../queues/notificationQueue');
    addNotificationJob = notificationQueue.addNotificationJob;
} catch (err) {
    console.log('⚠️  Queue modules not available (Redis may be disabled):', err.message);
}

const startScheduler = () => {
    if (!addNotificationJob) {
        console.log('⚠️  Notification scheduler not started: Queue features are disabled (Redis unavailable)');
        console.log('📧 Note: Email notifications require Redis. Please enable Redis to use this feature.');
        return;
    }

    console.log('🕒 Timezone-Aware Notification Scheduler Started.');

    // Run every minute to check for users whose local time matches their preferred time
    cron.schedule('* * * * *', async () => {
        try {
            const now = DateTime.utc();

            // Get all users with email enabled
            const users = await User.find({
                emailEnabled: true,
                preferredTimes: { $exists: true, $ne: [] }
            }).select('_id email name timezone preferredTimes onceOrTwice lastNotificationDate');

            for (const user of users) {
                try {
                    // Convert current UTC time to user's timezone
                    const userLocalTime = now.setZone(user.timezone || 'UTC');
                    const currentHourMinute = userLocalTime.toFormat('HH:mm');

                    // Check if current time matches any of user's preferred times
                    if (!user.preferredTimes.includes(currentHourMinute)) {
                        continue;
                    }

                    // Check if we already sent notification today (in user's timezone)
                    const todayInUserTZ = userLocalTime.toISODate(); // YYYY-MM-DD

                    if (user.lastNotificationDate) {
                        const lastNotifDate = DateTime.fromJSDate(user.lastNotificationDate, { zone: user.timezone || 'UTC' });
                        const lastNotifDay = lastNotifDate.toISODate();

                        // If sent today...
                        if (lastNotifDay === todayInUserTZ) {
                            if (user.onceOrTwice === 'once') {
                                // Once mode: Already sent today -> Skip
                                continue;
                            } else {
                                // Twice mode: Allow if > 4 hours passed
                                const diffHours = now.diff(lastNotifDate, 'hours').hours;
                                if (diffHours < 4) {
                                    continue;
                                }
                            }
                        }
                    }

                    // Enqueue notification job
                    console.log(`📧 Enqueueing notification for ${user.email} (${user.timezone}, ${currentHourMinute})`);

                    await addNotificationJob({
                        userId: user._id.toString(),
                        email: user.email,
                        name: user.name,
                        timezone: user.timezone,
                        type: 'DAILY_LESSON',
                        triggeredAt: new Date()
                    });

                    // Update lastNotificationDate
                    await User.findByIdAndUpdate(user._id, {
                        lastNotificationDate: new Date()
                    });

                } catch (userErr) {
                    console.error(`Error processing user ${user.email}:`, userErr.message);
                }
            }

        } catch (err) {
            console.error('❌ Scheduler Error:', err.message);
        }
    });

    console.log('✅ Scheduler will check every minute for users to notify based on their timezone and preferred times.');
};

module.exports = startScheduler;
