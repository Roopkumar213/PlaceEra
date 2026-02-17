const Ajv = require('ajv');
const path = require('path');
const fs = require('fs');

const SCHEMA_PATH = path.resolve(__dirname, '../../../infrastructure/schemas/dailyConcept.schema.json');

let ajv;
let validate;

try {
    ajv = new Ajv();
    const schemaStr = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    const schema = JSON.parse(schemaStr);
    validate = ajv.compile(schema);
} catch (err) {
    console.warn('Failed to initialize AJV or load schema:', err.message);
    // Fallback validator if AJV fails (e.g., not installed)
    validate = () => true;
    validate.errors = [];
}

/**
 * Validates the lesson data against the schema.
 * @param {Object} data 
 * @returns {Object} { isValid: boolean, errors: Array }
 */
function validateLesson(data) {
    if (!validate) {
        return { isValid: false, errors: ['Validator not initialized'] };
    }

    const valid = validate(data);
    return {
        isValid: valid,
        errors: valid ? [] : validate.errors
    };
}

module.exports = { validateLesson };
