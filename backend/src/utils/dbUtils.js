const mongoose = require('mongoose');

/**
 * Executes a function within a transaction if possible.
 * In test environments without replica sets, it runs without a transaction.
 * @param {Function} fn - Function to execute, receives (session).
 * @returns {Promise<any>}
 */
const withTransaction = async (fn) => {
    // Check if we should skip transactions (e.g. in Memory DB tests)
    // We can also check if the connection is a replica set, but NODE_ENV is safer for now.
    if (process.env.NODE_ENV === 'test') {
        return await fn(null);
    }

    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await fn(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};

module.exports = { withTransaction };
