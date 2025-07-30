const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campaign-2027',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'avi', 'mov', 'pdf'],
    transformation: [
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ]
  }
});

// Multer upload configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Define allowed file types
    const allowedTypes = {
      images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
      videos: ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'],
      documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    };

    const allAllowed = [...allowedTypes.images, ...allowedTypes.videos, ...allowedTypes.documents];

    if (allAllowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${allAllowed.join(', ')}`), false);
    }
  }
});

class FileUploadService {
  // Upload single file
  static uploadSingle(fieldName) {
    return upload.single(fieldName);
  }

  // Upload multiple files
  static uploadMultiple(fieldName, maxCount = 10) {
    return upload.array(fieldName, maxCount);
  }

  // Upload fields (different field names)
  static uploadFields(fields) {
    return upload.fields(fields);
  }

  // Upload to specific folder
  static async uploadToFolder(file, folder, options = {}) {
    try {
      const uploadOptions = {
        folder: `campaign-2027/${folder}`,
        ...options
      };

      // If it's an image, add image-specific transformations
      if (file.mimetype.startsWith('image/')) {
        uploadOptions.transformation = [
          { quality: 'auto' },
          { fetch_format: 'auto' },
          { width: 1200, height: 800, crop: 'limit' }
        ];
      }

      const result = await cloudinary.uploader.upload(file.path, uploadOptions);
      
      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes
      };
    } catch (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  // Delete file from Cloudinary
  static async deleteFile(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  // Get file URL with transformations
  static getTransformedUrl(publicId, transformations) {
    return cloudinary.url(publicId, {
      transformation: transformations
    });
  }

  // Generate thumbnail
  static getThumbnail(publicId, width = 300, height = 200) {
    return cloudinary.url(publicId, {
      transformation: [
        { width, height, crop: 'fill' },
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });
  }

  // Validate file before upload
  static validateFile(file, options = {}) {
    const {
      maxSize = 50 * 1024 * 1024, // 50MB default
      allowedTypes = ['image', 'video', 'application']
    } = options;

    // Check file size
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
    }

    // Check file type
    const fileType = file.mimetype.split('/')[0];
    const isValidType = allowedTypes.some(type => 
      file.mimetype.startsWith(type) || file.mimetype.includes(type)
    );

    if (!isValidType) {
      throw new Error(`Invalid file type: ${file.mimetype}`);
    }

    return true;
  }

  // Process image for different sizes
  static async processImageSizes(publicId) {
    const sizes = {
      thumbnail: { width: 300, height: 200, crop: 'fill' },
      medium: { width: 800, height: 600, crop: 'limit' },
      large: { width: 1200, height: 900, crop: 'limit' },
      hero: { width: 1920, height: 1080, crop: 'fill' }
    };

    const processedSizes = {};

    for (const [sizeName, dimensions] of Object.entries(sizes)) {
      processedSizes[sizeName] = cloudinary.url(publicId, {
        transformation: [
          dimensions,
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      });
    }

    return processedSizes;
  }

  // Bulk upload files
  static async bulkUpload(files, folder, options = {}) {
    const uploadPromises = files.map(file => 
      this.uploadToFolder(file, folder, options)
    );

    try {
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      throw new Error(`Bulk upload failed: ${error.message}`);
    }
  }

  // Generate signed upload URL (for direct client uploads)
  static generateSignedUploadUrl(options = {}) {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    const params = {
      timestamp,
      folder: 'campaign-2027',
      ...options
    };

    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    return {
      url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
      params: {
        ...params,
        signature,
        api_key: process.env.CLOUDINARY_API_KEY
      }
    };
  }
}

module.exports = {
  FileUploadService,
  upload,
  cloudinary
};