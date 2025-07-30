// server/controllers/pressController.js
const Press = require('../models/Press');
const { validationResult } = require('express-validator');
const {
  cloudinary,
  deleteFromCloudinary
} = require('../config/cloudinary');

const fs = require('fs').promises;

// Enhanced upload function with better error handling
const uploadToCloudinary = async (filePath, folder = 'press-releases') => {
  try {
    // Verify file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      console.error('❌ File not found:', filePath);
      throw new Error(`File not found at path: ${filePath}`);
    }

    const path = require('path');
    const ext = path.extname(filePath).toLowerCase();
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
    const resourceType = videoExtensions.includes(ext) ? 'video' : 'image';

    console.log('📤 Uploading to Cloudinary:', {
      filePath,
      folder: `campaign2027/${folder}`,
      resourceType,
      fileSize: (await fs.stat(filePath)).size / 1024 / 1024 + 'MB'
    });

    const result = await cloudinary.uploader.upload(filePath, {
      folder: `campaign2027/${folder}`,
      resource_type: resourceType,
      quality: 'auto',
      fetch_format: 'auto',
      timeout: 960000,
      transformation: resourceType === 'image' ? [
        { width: 1200, height: 800, crop: 'limit' }
      ] : undefined
    });

    console.log('✅ Cloudinary upload success:', {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      bytes: result.bytes
    });

    // Clean up temp file - FIXED VERSION
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log(`✅ Deleted temp file: ${filePath}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Error deleting temp file:', err);
      }
    }

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      width: result.width,
      height: result.height
    };
  } catch (error) {
    console.error('❌ Cloudinary upload failed:', error.message);
    
    // Clean up temp file after failed upload - FIXED VERSION
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log(`✅ Deleted temp file after failed upload: ${filePath}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Error deleting temp file after failed upload:', err);
      }
    }
    
    throw error;
  }
};

// Helper function to upload multiple files
const uploadMultipleToCloudinary = async (files, folder = 'press-releases') => {
  const uploadPromises = files.map(file => uploadToCloudinary(file.path, folder));
  return Promise.all(uploadPromises);
};

// Helper function to parse tags
const parseTags = (tags) => {
  if (!tags) return [];
  
  if (Array.isArray(tags)) {
    return tags.map(t => t.toString().trim().toLowerCase()).filter(Boolean);
  }
  
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }
  
  return [];
};

// Helper function to parse SEO keywords
const parseSeoKeywords = (keywords) => {
  if (!keywords) return [];
  
  if (Array.isArray(keywords)) {
    return keywords.map(k => k.toString().trim()).filter(Boolean);
  }
  
  if (typeof keywords === 'string') {
    return keywords.split(',').map(k => k.trim()).filter(Boolean);
  }
  
  return [];
};

// Enhanced cleanup function to handle file deletion safely
const safeFileCleanup = async (filePaths) => {
  if (!filePaths) return;
  
  if (!Array.isArray(filePaths)) {
    filePaths = [filePaths];
  }

  for (const filePath of filePaths) {
    if (!filePath) continue;
    
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log(`✅ Cleaned up: ${filePath}`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`ℹ️ File doesn't exist (already deleted): ${filePath}`);
      } else {
        console.error(`❌ Error deleting ${filePath}:`, err.message);
      }
    }
  }
};

// @desc    Get all press releases
// @route   GET /api/press
// @access  Public
const getAllPress = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      startDate,
      endDate,
      featured,
      published = true,
      type
    } = req.query;

    // Build query
    const query = {};
    
    if (published === 'true') {
      query.published = true;
      query.publishDate = { $lte: new Date() };
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (startDate || endDate) {
      query.publishDate = {};
      if (startDate) query.publishDate.$gte = new Date(startDate);
      if (endDate) query.publishDate.$lte = new Date(endDate);
    }
    
    if (featured === 'true') {
      query.featured = true;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Press.countDocuments(query);
    
    // Fetch press releases
    const pressReleases = await Press.find(query)
      .sort({ publishDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: pressReleases,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all press error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching press releases'
    });
  }
};

// @desc    Get single press release
// @route   GET /api/press/:id
// @access  Public
const getPressById = async (req, res) => {
  try {
    const pressRelease = await Press.findById(req.params.id).lean();

    if (!pressRelease) {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }

    // Check if published (unless admin)
    if (!pressRelease.published && !req.user?.role === 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }

    // Increment view count
    await Press.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 }
    });

    res.json({
      success: true,
      data: pressRelease
    });
  } catch (error) {
    console.error('Get press by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching press release'
    });
  }
};

// @desc    Create new press release
// @route   POST /api/press
// @access  Private (Admin only)

// Enhanced createPress function
const createPress = async (req, res, next) => {
  let filesToCleanup = [];
  
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Track files for cleanup
    if (req.files?.featuredImage?.[0]) {
      filesToCleanup.push(req.files.featuredImage[0].path);
    }
    if (req.files?.attachments?.length > 0) {
      filesToCleanup.push(...req.files.attachments.map(file => file.path));
    }

    // Prepare press data
    const pressData = {
      ...req.body,
      tags: parseTags(req.body.tags),
      published: req.body.published === 'true',
      featured: req.body.featured === 'true',
      publishDate: req.body.publishDate ? new Date(req.body.publishDate) : new Date(),
      seo: {
        title: req.body.seoTitle || req.body.title,
        description: req.body.seoDescription 
          ? req.body.seoDescription.substring(0, 160)
          : req.body.excerpt?.substring(0, 160) || '',
        keywords: parseSeoKeywords(req.body.seoKeywords)
      }
    };

    // Handle featured image upload
    if (req.files?.featuredImage?.[0]) {
      pressData.featuredImage = await uploadToCloudinary(
        req.files.featuredImage[0].path,
        'press-releases/featured'
      );
      // Remove from cleanup list since uploadToCloudinary handles it
      filesToCleanup = filesToCleanup.filter(path => path !== req.files.featuredImage[0].path);
    }

    // Handle attachments upload
    if (req.files?.attachments?.length > 0) {
      pressData.attachments = await Promise.all(
        req.files.attachments.map(async (file) => {
          const uploaded = await uploadToCloudinary(file.path, 'press-releases/attachments');
          // Remove from cleanup list since uploadToCloudinary handles it
          filesToCleanup = filesToCleanup.filter(path => path !== file.path);
          return {
            ...uploaded,
            type: file.mimetype.startsWith('video/') ? 'video' : 'image',
            filename: file.originalname,
            size: file.size
          };
        })
      );
    }

    // Create the press release
    const press = await Press.create(pressData);

    res.status(201).json({
      success: true,
      data: press,
      message: 'Press release created successfully'
    });

  } catch (error) {
    console.error('Create press error:', error);

    res.status(400).json({
      success: false,
      message: 'Failed to create press release',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Clean up any remaining temp files
    if (filesToCleanup.length > 0) {
      await safeFileCleanup(filesToCleanup);
    }
  }
};

// @desc    Update press release
// @route   PUT /api/press/:id
// @access  Private (Admin only)

// Enhanced updatePress function
const updatePress = async (req, res, next) => {
  let filesToCleanup = [];
  
  try {
    const { id } = req.params;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Track files for cleanup
    if (req.files?.featuredImage?.[0]) {
      filesToCleanup.push(req.files.featuredImage[0].path);
    }
    if (req.files?.attachments?.length > 0) {
      filesToCleanup.push(...req.files.attachments.map(file => file.path));
    }

    // Get existing press release
    const existingPress = await Press.findById(id);
    if (!existingPress) {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }

    // Prepare update data
    const updateData = {
      ...req.body,
      tags: parseTags(req.body.tags),
      seo: {
        title: req.body.seoTitle || req.body.title,
        description: req.body.seoDescription
          ? req.body.seoDescription.substring(0, 160)
          : req.body.excerpt?.substring(0, 160) || '',
        keywords: parseSeoKeywords(req.body.seoKeywords)
      },
      updatedAt: new Date()
    };

    // Handle featured image update
    if (req.files?.featuredImage?.[0]) {
      try {
        // Delete old featured image if it exists
        if (existingPress.featuredImage?.publicId) {
          await deleteFromCloudinary(existingPress.featuredImage.publicId)
            .catch(err => console.error('Error deleting old image:', err));
        }

        // Upload new featured image
        updateData.featuredImage = await uploadToCloudinary(
          req.files.featuredImage[0].path,
          'press-releases/featured'
        );
        // Remove from cleanup list since uploadToCloudinary handles it
        filesToCleanup = filesToCleanup.filter(path => path !== req.files.featuredImage[0].path);
      } catch (uploadError) {
        console.error('Featured image upload failed:', uploadError);
        return res.status(400).json({
          success: false,
          message: 'Failed to upload featured image',
          error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
        });
      }
    }

    // Handle new attachments
    if (req.files?.attachments?.length > 0) {
      try {
        const newAttachments = await Promise.all(
          req.files.attachments.map(async (file) => {
            const uploaded = await uploadToCloudinary(file.path, 'press-releases/attachments');
            // Remove from cleanup list since uploadToCloudinary handles it
            filesToCleanup = filesToCleanup.filter(path => path !== file.path);
            return {
              ...uploaded,
              type: file.mimetype.startsWith('video/') ? 'video' : 'image',
              filename: file.originalname,
              size: file.size
            };
          })
        );

        updateData.attachments = [
          ...(existingPress.attachments || []),
          ...newAttachments
        ];
      } catch (uploadError) {
        console.error('Attachments upload failed:', uploadError);
        return res.status(400).json({
          success: false,
          message: 'Failed to upload attachments',
          error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
        });
      }
    }

    // Save update
    const updatedPress = await Press.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: updatedPress,
      message: 'Press release updated successfully'
    });

  } catch (error) {
    console.error('Update press error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update press release',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Clean up any remaining temp files
    if (filesToCleanup.length > 0) {
      await safeFileCleanup(filesToCleanup);
    }
  }
};

// @desc    Delete press release
// @route   DELETE /api/press/:id
// @access  Private (Admin only)
const deletePress = async (req, res) => {
  try {
    const pressRelease = await Press.findById(req.params.id);
    
    if (!pressRelease) {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }

    // Delete featured image from cloudinary
    if (pressRelease.featuredImage && pressRelease.featuredImage.publicId) {
      try {
        await cloudinary.uploader.destroy(pressRelease.featuredImage.publicId);
      } catch (deleteError) {
        console.error('Error deleting featured image from cloudinary:', deleteError);
      }
    }

    // Delete attachments from cloudinary
    if (pressRelease.attachments && pressRelease.attachments.length > 0) {
      for (const attachment of pressRelease.attachments) {
        try {
          if (attachment.publicId) {
            await cloudinary.uploader.destroy(attachment.publicId, {
              resource_type: attachment.resourceType || 'image'
            });
          }
        } catch (deleteError) {
          console.error('Error deleting attachment from cloudinary:', deleteError);
        }
      }
    }

    await Press.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Press release deleted successfully'
    });
  } catch (error) {
    console.error('Delete press error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting press release'
    });
  }
};

// @desc    Get latest press releases
// @route   GET /api/press/latest
// @access  Public
const getLatestPress = async (req, res) => {
  try {
    console.log('=== Getting latest press releases ===');
    const { limit = 5, type } = req.query;

    if (!Press) {
      console.error('Press model not found!');
      return res.status(500).json({
        success: false,
        message: 'Press model not configured'
      });
    }

    const query = {
      published: true,
      publishDate: { $lte: new Date() }
    };

    if (type && type !== 'all') {
      query.type = type;
    }

    console.log('Query:', JSON.stringify(query, null, 2));

    const totalCount = await Press.countDocuments({});
    console.log('Total press releases in database:', totalCount);

    if (totalCount === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'No press releases found in database'
      });
    }

    const pressReleases = await Press.find(query)
      .sort({ publishDate: -1 })
      .limit(parseInt(limit))
      .select('title excerpt category publishDate slug views type createdAt featuredImage')
      .lean();

    console.log('Found press releases:', pressReleases?.length || 0);

    res.json({
      success: true,
      data: pressReleases || [],
      count: pressReleases?.length || 0
    });

  } catch (error) {
    console.error('=== Get latest press ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'MongooseError' || error.name === 'MongoError') {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: 'Please check if MongoDB is running'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching latest press releases',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Search press releases
// @route   GET /api/press/search
// @access  Public
const searchPress = async (req, res) => {
  try {
    const {
      search,
      category,
      tags,
      type,
      page = 1,
      limit = 20
    } = req.query;

    if (!search) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }

    const query = {
      published: true,
      publishDate: { $lte: new Date() },
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ]
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Press.countDocuments(query);

    const pressReleases = await Press.find(query)
      .sort({ publishDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: pressReleases,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Search press error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching press releases'
    });
  }
};

// @desc    Get press statistics
// @route   GET /api/press/stats
// @access  Private (Admin only)
const getPressStats = async (req, res) => {
  try {
    const totalPress = await Press.countDocuments();
    const publishedPress = await Press.countDocuments({ 
      published: true,
      publishDate: { $lte: new Date() }
    });
    const draftPress = await Press.countDocuments({ published: false });
    const featuredPress = await Press.countDocuments({ featured: true });

    // Get press by category
    const categoryCounts = await Press.aggregate([
      { $match: { published: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get press by type
    const typeCounts = await Press.aggregate([
      { $match: { published: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get monthly press counts for the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyStats = await Press.aggregate([
      { 
        $match: { 
          publishDate: { $gte: twelveMonthsAgo },
          published: true
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$publishDate' },
            month: { $month: '$publishDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get top viewed press releases
    const topViewed = await Press.find({ published: true })
      .sort({ views: -1 })
      .limit(10)
      .select('title views publishDate type')
      .lean();

    res.json({
      success: true,
      data: {
        overview: {
          total: totalPress,
          published: publishedPress,
          drafts: draftPress,
          featured: featuredPress
        },
        categories: categoryCounts,
        types: typeCounts,
        monthlyStats,
        topViewed
      }
    });
  } catch (error) {
    console.error('Get press stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching press statistics'
    });
  }
};

// @desc    Get press releases by type
// @route   GET /api/press/type/:type
// @access  Public
const getPressByType = async (req, res) => {
  try {
    const { type } = req.params;
    const {
      page = 1,
      limit = 20,
      category,
      search,
      featured
    } = req.query;

    // Validate type
    const validTypes = ['PRESS RELEASE', 'VIDEO', 'ANNOUNCEMENT'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be one of: PRESS RELEASE, VIDEO, ANNOUNCEMENT'
      });
    }

    // Build query
    const query = {
      type,
      published: true,
      publishDate: { $lte: new Date() }
    };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (featured === 'true') {
      query.featured = true;
    }

    // Pagination setup
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Press.countDocuments(query);
    
    // Fetch press releases
    const pressReleases = await Press.find(query)
      .sort({ publishDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: pressReleases,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get press by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching press releases by type'
    });
  }
};

// @desc    Toggle press featured status
// @route   PATCH /api/press/:id/featured
// @access  Private (Admin only)
const toggleFeatured = async (req, res) => {
  try {
    const pressRelease = await Press.findById(req.params.id);
    
    if (!pressRelease) {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }

    pressRelease.featured = !pressRelease.featured;
    await pressRelease.save();

    res.json({
      success: true,
      message: `Press release ${pressRelease.featured ? 'featured' : 'unfeatured'} successfully`,
      data: { featured: pressRelease.featured }
    });
  } catch (error) {
    console.error('Toggle featured error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating press release'
    });
  }
};

// @desc    Delete press attachment
// @route   DELETE /api/press/:id/attachments/:attachmentId
// @access  Private (Admin only)
const deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    
    const pressRelease = await Press.findById(id);
    
    if (!pressRelease) {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }

    const attachmentIndex = pressRelease.attachments.findIndex(
      att => att._id.toString() === attachmentId
    );

    if (attachmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const attachment = pressRelease.attachments[attachmentIndex];

    // Delete from cloudinary
    if (attachment.publicId) {
      try {
        await cloudinary.uploader.destroy(attachment.publicId, {
          resource_type: attachment.resourceType || 'image'
        });
      } catch (deleteError) {
        console.error('Error deleting from cloudinary:', deleteError);
      }
    }

    // Remove from array
    pressRelease.attachments.splice(attachmentIndex, 1);
    await pressRelease.save();

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    console.error('Delete attachment error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Press release not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting attachment'
    });
  }
};

module.exports = {
  getAllPress,
  getPressById,
  createPress,
  updatePress,
  deletePress,
  getLatestPress,
  searchPress,
  getPressStats,
  toggleFeatured,
  deleteAttachment,
  getPressByType 
};