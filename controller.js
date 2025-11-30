const Release = require('./models/Release'); // Import Model
const semver = require('semver');
const fs = require('fs');
const path = require('path');

// 1. API: Kiểm tra cập nhật
exports.checkUpdate = async (req, res) => {
    try {
        const { currentAppVersion, currentBundleVersion } = req.query;

        if (!currentAppVersion || !currentBundleVersion) {
            return res.status(400).json({ message: "Thiếu thông tin version" });
        }

        // Tìm trong DB các bản active và khớp appVersion
        const compatibleReleases = await Release.find({
            appVersion: currentAppVersion,
            isActive: true
        });

        if (compatibleReleases.length === 0) {
            return res.json({ updateAvailable: false, message: "No compatible releases" });
        }

        // Sort bằng semver (DB sort string không chính xác với semver nên ta sort bằng code JS)
        compatibleReleases.sort((a, b) => semver.rcompare(a.bundleVersion, b.bundleVersion));
        const latestRelease = compatibleReleases[0];

        // So sánh version
        if (semver.gt(latestRelease.bundleVersion, currentBundleVersion)) {
            // Tạo URL download động dựa trên domain hiện tại
            const protocol = req.protocol;
            const host = req.get('host');
            const downloadUrl = `${protocol}://${host}/uploads/${latestRelease.fileName}`;

            return res.json({
                updateAvailable: true,
                bundleVersion: latestRelease.bundleVersion,
                downloadUrl: downloadUrl, // URL trỏ về server mình
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

// 2. API: Publish Release (Upload file ZIP)
exports.publishRelease = async (req, res) => {
    try {
        const { appVersion, bundleVersion, forceUpdate, description } = req.body;
        const file = req.file; // File do Multer xử lý

        if (!file) {
            return res.status(400).json({ message: "Vui lòng upload file bundle (.zip)" });
        }

        if (!semver.valid(bundleVersion)) {
            // Nếu lỗi, xóa file đã upload để tránh rác
            fs.unlinkSync(file.path);
            return res.status(400).json({ message: "Invalid Bundle Version format" });
        }

        // Lưu vào MongoDB
        const newRelease = new Release({
            appVersion,
            bundleVersion,
            fileName: file.filename, // Lưu tên file multer đã đặt (có timestamp)
            forceUpdate: forceUpdate === 'true' || forceUpdate === true, // Xử lý form-data gửi bool dưới dạng string
            description,
            isActive: true
        });

        await newRelease.save();

        res.json({ success: true, message: "Published successfully", data: newRelease });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error publishing release" });
    }
};

// 3. API: Rollback
exports.rollback = async (req, res) => {
    try {
        const { bundleVersionToDisable } = req.body;

        // Tìm và update trong DB
        const updatedRelease = await Release.findOneAndUpdate(
            { bundleVersion: bundleVersionToDisable },
            { isActive: false },
            { new: true } // Trả về object sau khi update
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