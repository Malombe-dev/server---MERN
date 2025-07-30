// server/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage for temporary files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/temp';
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

// File filter for images and videos
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp|svg/;
  const allowedVideoTypes = /mp4|avi|mov|wmv|webm|mkv|flv|m4v/;
  const allowedDocTypes = /pdf|doc|docx/; // Optional: for press kits
  
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const mimetype = file.mimetype.toLowerCase();

  console.log('Uploading file:', {
    name: file.originalname,
    mimetype,
    ext
  });
  
  // Check for images
    if (mimetype.startsWith('image/') && allowedImageTypes.test(ext)) {
      return cb(null, true);
    }

    // Check for videos
    if (mimetype.startsWith('video/') && allowedVideoTypes.test(ext)) {
      return cb(null, true);
    }

    // Check for documents (optional)
    if (mimetype.startsWith('application/') && allowedDocTypes.test(ext)) {
      return cb(null, true);
    }

    // Unsupported type
    cb(new Error(`Unsupported file type: .${ext}. Allowed: images, videos, PDF`));

};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
    files: 10 // Maximum 10 files
  },
  fileFilter: fileFilter
});

// Middleware for multiple file uploads
const uploadMiddleware = {
  // Single featured image
  single: upload.single('featuredImage'),
  
  // Multiple attachments
  multiple: upload.array('attachments', 10),
  
  // Both featured image and attachments
  fields: upload.fields([
    { name: 'featuredImage', maxCount: 1 },
    { name: 'attachments', maxCount: 10 }
  ]),
  
  // Handle any files
  any: upload.any()
};

// Cleanup temporary files
const cleanupTempFiles = (files) => {
  if (!files) return;
  
  const fileArray = Array.isArray(files) ? files : [files];
  
  fileArray.forEach(file => {
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error('Error deleting temp file:', error);
      }
    }
  });
};

// Error handling middleware
const handleUploadError = (error, req, res, next) => {
  // Clean up any uploaded files
  if (req.files) {
    Object.values(req.files).forEach(files => {
      cleanupTempFiles(files);
    });
  }
  if (req.file) {
    cleanupTempFiles(req.file);
  }

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 100MB'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum is 10 files'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field'
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Upload error: ${error.message}`
        });
    }
  }

  if (error.message.includes('Unsupported file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next(error);
};

module.exports = {
  upload,
  uploadMiddleware,
  cleanupTempFiles,
  handleUploadError
};