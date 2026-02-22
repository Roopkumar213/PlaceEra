/**
 * Global Error Handler
 * Hides stack traces and returns consistent error messages to the client.
 */
const errorHandler = (err, req, res, next) => {
    // Log the error internally
    console.error(`[Error] ${req.method} ${req.url}:`, {
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? 'Filtered' : err.stack,
        userId: req.user ? req.user.id : 'anonymous'
    });

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: err.errors
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized access'
        });
    }

    // Default error response
    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal Server Error. Please contact support if the issue persists.'
        : err.message;

    res.status(status).json({
        success: false,
        message
    });
};

module.exports = errorHandler;
