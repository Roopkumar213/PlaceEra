const cron = require('node-cron');
const TopicMastery = require('../models/TopicMastery');

const startDecayJob = () => {
    // Run every day at midnight: '0 0 * * *'
    cron.schedule('0 0 * * *', async () => {
        console.log('🔄 Running Mastery Decay Job...');
        const startTime = Date.now();
        let updatedCount = 0;

        try {
            // Fetch all mastery records where mastery > 0
            const cursor = TopicMastery.find({ mastery: { $gt: 0 } }).cursor();

            for await (const doc of cursor) {
                const lastPracticed = new Date(doc.lastAttemptAt);
                const today = new Date();

                // Difference in days
                const diffTime = Math.abs(today - lastPracticed);
                const daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (daysSince <= 1) continue; // Don't decay if practiced today or yesterday

                // Exponential Decay Formula: N(t) = N0 * e^(-lambda * t)
                // user suggested: mastery = mastery * Math.exp(-0.02 * daysSince)

                const decayFactor = Math.exp(-0.02 * daysSince);
                const oldMastery = doc.mastery;
                let newMastery = oldMastery * decayFactor;

                // Clamp to 0
                if (newMastery < 0) newMastery = 0;

                // Optimization: Only update if the change is significant (> 0.5 difference)
                if (Math.abs(oldMastery - newMastery) > 0.5) {
                    doc.mastery = newMastery;
                    await doc.save();
                    updatedCount++;
                }
            }

            const duration = Date.now() - startTime;
            console.log(`✅ Mastery Decay Job Complete. Updated ${updatedCount} records in ${duration}ms.`);

        } catch (err) {
            console.error('❌ Mastery Decay Job Failed:', err);
        }
    });
};

module.exports = startDecayJob;
