const mongoose = require('mongoose');

const ReleaseSchema = new mongoose.Schema({
    appVersion: { type: String, required: true }, // VD: 1.0.0
    bundleVersion: { type: String, required: true }, // VD: 1.0.1
    fileName: { type: String, required: true }, // Tên file trên server (VD: 1709123-bundle.zip)
    fileHash: { type: String, required: true }, // ← THÊM: Hash của file
    forceUpdate: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    description: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Release', ReleaseSchema);