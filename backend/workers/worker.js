const { Worker } = require('bullmq');
const connection = require('../queues/redisClient');
const mongoose = require('mongoose');
const TopicMastery = require('../src/models/TopicMastery');
const LearningEventLog = require('../src/models/LearningEventLog');
require('dotenv').config();

// Connect to MongoDB (Worker needs its own connection)
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/placeera')
    .then(() => console.log('✅ Worker DB Connected'))
    .catch(err => console.error('❌ Worker DB Error:', err));

// --- PROCESSOR: DECAY LOGIC ---
const processDecay = async (job) => {
    console.log(`[Job ${job.id}] 📉 Starting Mastery Decay Processing...`);
    const startTime = Date.now();
    let processedCount = 0;
    let updatedCount = 0;

    try {
        const BATCH_SIZE = 1000;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // Only process if not practiced in last 24h

        const cursor = TopicMastery.find({
            mastery: { $gt: 0 },
            lastAttemptAt: { $lt: oneDayAgo }
        })
            .select('_id userId topic subject mastery lastAttemptAt')
            .cursor({ batchSize: BATCH_SIZE });

        const bulkOps = [];
        const decayLogs = [];

        for await (const doc of cursor) {
            processedCount++;
            const lastPracticed = new Date(doc.lastAttemptAt);
            const today = new Date();
            const diffTime = Math.abs(today - lastPracticed);
            const daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysSince <= 1) continue;

            const decayFactor = Math.exp(-0.02 * daysSince);
            const oldMastery = doc.mastery;
            let newMastery = oldMastery * decayFactor;
            if (newMastery < 0) newMastery = 0;

            if (Math.abs(oldMastery - newMastery) > 0.5) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: doc._id },
                        update: { $set: { mastery: newMastery } }
                    }
                });

                decayLogs.push({
                    insertOne: {
                        document: {
                            userId: doc.userId,
                            topicId: doc.topic,
                            subject: doc.subject,
                            eventType: 'DECAY_APPLIED',
                            previousMastery: oldMastery,
                            newMastery: newMastery,
                            delta: newMastery - oldMastery,
                            trendDirection: 'declining',
                            meta: { daysSince, decayFactor }
                        }
                    }
                });

                updatedCount++;
            }

            if (bulkOps.length >= BATCH_SIZE) {
                await TopicMastery.bulkWrite(bulkOps);
                await LearningEventLog.bulkWrite(decayLogs);
                bulkOps.length = 0;
                decayLogs.length = 0;
                if (processedCount % 5000 === 0) console.log(`[Job ${job.id}] ..scanned ${processedCount} records..`);
            }
        }

        if (bulkOps.length > 0) {
            await TopicMastery.bulkWrite(bulkOps);
            await LearningEventLog.bulkWrite(decayLogs);
        }

        const duration = Date.now() - startTime;
        console.log(`[Job ${job.id}] ✅ Decay Complete. Scanned: ${processedCount}, Updated: ${updatedCount}. Time: ${duration}ms.`);
        return { processedCount, updatedCount, duration };

    } catch (err) {
        console.error(`[Job ${job.id}] ❌ Decay Failed:`, err);
        throw err;
    }
};

// --- PROCESSOR: NOTIFICATION LOGIC ---
const emailService = require('../src/services/emailService');

const processNotification = async (job) => {
    console.log(`[Job ${job.id}] 🔔 Processing Notification: ${job.data.type}`);

    try {
        const { userId, type, email, name } = job.data;

        if (type === 'DAILY_LESSON' || type === 'DAILY_REMINDER_BATCH') {
            // In a real scenario, we'd fetch the specific lesson for the user here
            // For now, we'll send a generic "Ready for today?" email
            const lessonStub = {
                topic: 'Daily Adaptive Challenge',
                subject: 'Personalized Curriculum'
            };

            await emailService.sendDailyLesson({ email, name }, lessonStub);
            console.log(`[Job ${job.id}] ✅ Notification Email Sent to ${email}`);
        } else {
            console.log(`[Job ${job.id}] ⚠️ Unknown notification type: ${type}`);
        }

    } catch (err) {
        console.error(`[Job ${job.id}] ❌ Notification Failed:`, err.message);
        throw err; // Trigger retry
    }
};

// --- WORKER INSTANCES ---
const decayWorker = new Worker('decay-queue', processDecay, { connection, concurrency: 1 });
const notificationWorker = new Worker('notification-queue', processNotification, { connection, concurrency: 5 });

decayWorker.on('completed', job => console.log(`[Job ${job.id}] Completed`));
decayWorker.on('failed', (job, err) => console.error(`[Job ${job.id}] Failed: ${err.message}`));

notificationWorker.on('completed', job => console.log(`[Job ${job.id}] Completed`));
notificationWorker.on('failed', (job, err) => console.error(`[Job ${job.id}] Failed: ${err.message}`));

console.log('🚀 Workers Started: Listening for jobs...');

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down workers...');
    await decayWorker.close();
    await notificationWorker.close();
    await mongoose.connection.close();
    process.exit(0);
});
