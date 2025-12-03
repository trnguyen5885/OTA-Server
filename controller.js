// controllers/releaseController.js
const Release = require('./models/Release');
const semver = require('semver');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // ← THÊM: Để tính SHA256

// Hàm helper: Tính SHA256 hash của file
const calculateFileHash = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (error) => reject(error));
    });
};

// 1. API: Kiểm tra cập nhật (ĐÃ CẬP NHẬT)
exports.checkUpdate = async (req, res) => {
    try {
        const { currentAppVersion, currentBundleVersion } = req.query;

        if (!currentAppVersion || !currentBundleVersion) {
            return res.status(400).json({ message: "Thiếu thông tin version" });
        }

        const compatibleReleases = await Release.find({
            appVersion: currentAppVersion,
            isActive: true
        });

        if (compatibleReleases.length === 0) {
            return res.json({ updateAvailable: false, message: "No compatible releases" });
        }

        compatibleReleases.sort((a, b) => semver.rcompare(a.bundleVersion, b.bundleVersion));
        const latestRelease = compatibleReleases[0];

        if (semver.gt(latestRelease.bundleVersion, currentBundleVersion)) {
            const protocol = req.protocol;
            const host = req.get('host');
            const downloadUrl = `${protocol}://${host}/uploads/${latestRelease.fileName}`;

            return res.json({
                updateAvailable: true,
                bundleVersion: latestRelease.bundleVersion,
                downloadUrl: downloadUrl,
                fileHash: latestRelease.fileHash, // ← THÊM: Trả về fileHash
                forceUpdate: latestRelease.forceUpdate,
                description: latestRelease.description
            });
        } else {
            return res.json({ updateAvailable: false, message: "Already up to date" });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// 2. API: Publish Release (ĐÃ CẬP NHẬT)
exports.publishRelease = async (req, res) => {
    try {
        const { appVersion, bundleVersion, forceUpdate, description } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: "Vui lòng upload file bundle (.zip)" });
        }

        if (!semver.valid(bundleVersion)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ message: "Invalid Bundle Version format" });
        }

        // ← THÊM: Tính SHA256 hash của file
        const fileHash = await calculateFileHash(file.path);
        console.log(`Calculated SHA256 hash for ${file.filename}: ${fileHash}`);

        // Lưu vào MongoDB
        const newRelease = new Release({
            appVersion,
            bundleVersion,
            fileName: file.filename,
            fileHash: fileHash, // ← THÊM: Lưu hash vào DB
            forceUpdate: forceUpdate === 'true' || forceUpdate === true,
            description,
            isActive: true
        });

        await newRelease.save();

        res.json({ success: true, message: "Published successfully", data: newRelease });

    } catch (error) {
        console.error(error);
        // Xóa file nếu có lỗi
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: "Error publishing release" });
    }
};

// 3. API: Rollback (KHÔNG THAY ĐỔI)
exports.rollback = async (req, res) => {
    try {
        const { bundleVersionToDisable } = req.body;

        const updatedRelease = await Release.findOneAndUpdate(
            { bundleVersion: bundleVersionToDisable },
            { isActive: false },
            { new: true }
        );

        if (!updatedRelease) {
            return res.status(404).json({ message: "Version not found" });
        }

        res.json({
            success: true,
            message: `Version ${bundleVersionToDisable} disabled. Users will fallback to previous version.`
        });

    } catch (error) {
        res.status(500).json({ message: "Rollback failed" });
    }
};