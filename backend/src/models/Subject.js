const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    orderIndex: {
        type: Number,
        required: true,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Subject', subjectSchema);
