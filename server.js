const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('./controller');

// Tạo thư mục uploads nếu chưa tồn tại
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Kết nối MongoDB (Sử dụng biến môi trường hoặc fallback về local)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ota_server';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

app.use(cors());
app.use(express.json()); // Để parse JSON body
app.use(express.urlencoded({ extended: true })); // Để parse form-data body

// --- CẤU HÌNH MULTER (UPLOAD) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') // Lưu vào thư mục uploads
    },
    filename: function (req, file, cb) {
        // Đặt tên file: timestamp-tenfilegoc.zip để tránh trùng tên
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Filter chỉ cho phép file zip (tuỳ chọn)
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || path.extname(file.originalname) === '.zip') {
        cb(null, true);
    } else {
        cb(new Error('Only .zip files are allowed!'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// --- PUBLIC FOLDER ---
// Quan trọng: Để mobile app có thể tải file từ http://server/uploads/filename.zip
app.use('/uploads', express.static('uploads'));

// --- ROUTES ---
app.get('/api/check-update', controller.checkUpdate);
// Middleware upload.single('bundle') sẽ xử lý file có key là 'bundle' trong form-data
app.post('/api/publish', upload.single('bundle'), controller.publishRelease);
app.post('/api/rollback', controller.rollback);

app.listen(PORT, () => {
    console.log(`🚀 OTA Server running on http://localhost:${PORT}`);
});