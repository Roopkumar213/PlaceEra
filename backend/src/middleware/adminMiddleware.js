const User = require('../models/User');

const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Requires admin privileges' });
        }
        next();
    } catch (err) {
        console.error('Admin middleware error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = adminMiddleware;
