const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, removeAdditional: true }); // removeAdditional: true enforces strict schema

/**
 * Higher-order middleware to validate request body against a schema
 * @param {Object} schema - Ajv schema
 */
const validateBody = (schema) => {
    const validate = ajv.compile(schema);
    return (req, res, next) => {
        const valid = validate(req.body);
        if (!valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request data',
                errors: validate.errors
            });
        }
        next();
    };
};

module.exports = {
    validateBody,
    ajv
};
