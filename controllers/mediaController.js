const Media = require('../models/Media');
const Event = require('../models/Event');
const { validationResult } = require('express-validator');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;

// @desc    Get all media items
// @route   GET /api/media
// @access  Public
const getAllMedia = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      event,
      featured,
      tags,
      search,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Build query
    const query = { published: true };
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (event) {
      query.event = event;
    }
    
    if (featured === 'true') {
      query.featured = true;
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Media.countDocuments(query);
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = order === 'desc' ? -1 : 1;
    
    // Fetch media items
    const mediaItems = await Media.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('event', 'title date location')
      .populate('uploadedBy', 'name email')
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: mediaItems,
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
    console.error('Get all media error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching media items'
    });
  }
};

// @desc    Get single media item
// @route   GET /api/media/:id
// @access  Public
const getMediaById = async (req, res) => {
  try {
    const mediaItem = await Media.findById(req.params.id)
      .populate('event', 'title date location description')
      .populate('uploadedBy', 'name email role')
      .lean();

    if (!mediaItem) {
      return res.status(404).json({
        success: false,
        message: 'Media item not found'
      });
    }

    // Check if published (unless admin)
    if (!mediaItem.published && req.user?.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Media item not found'
      });
    }

    // Increment view count
    await Media.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 }
    });

    res.json({
      success: true,
      data: mediaItem
    });
  } catch (error) {
    console.error('Get media by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Media item not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching media item'
    });
  }
};

// @desc    Upload new media
// @route   POST /api/media
// @access  Private (Admin only)
const uploadMedia = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const {
      title,
      description,
      event,
      tags,
      featured,
      published,
      alt,
      caption
    } = req.body;

    const uploadedMedia = [];

    // Process each uploaded file
    for (const file of req.files) {
      try {
        // Determine media type
        const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
        
        // Upload to cloudinary
        const uploadOptions = {
          folder: `campaign2027/media/${mediaType}s`,
          resource_type: mediaType === 'video' ? 'video' : 'image',
          public_id: `${mediaType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        // Add video-specific options
        if (mediaType === 'video') {
          uploadOptions.eager = [
            { width: 1280, height: 720, crop: 'limit', quality: 'auto' },
            { width: 640, height: 360, crop: 'limit', quality: 'auto' }
          ];
          uploadOptions.eager_async = true;
        }

        const result = await cloudinary.uploader.upload(file.path, uploadOptions);

        // Get metadata
        const metadata = {
          width: result.width,
          height: result.height,
          format: result.format,
          size: file.size,
          duration: result.duration || null
        };

        // Generate thumbnails for videos
        let thumbnails = {};
        if (mediaType === 'video') {
          try {
            const thumbnailResult = await cloudinary.uploader.upload(result.secure_url, {
              folder: 'campaign2027/media/thumbnails',
              resource_type: 'image',
              public_id: `thumb_${result.public_id}`,
              transformation: [
                { width: 300, height: 200, crop: 'fill' },
                { flags: 'layer_apply', overlay: 'play_button' }
              ]
            });
            
            thumbnails.medium = thumbnailResult.secure_url;
          } catch (thumbError) {
            console.error('Error generating video thumbnail:', thumbError);
          }
        }

        // Create media document
        const mediaItem = new Media({
          title: title || file.originalname,
          description: description || '',
          type: mediaType,
          url: result.secure_url,
          publicId: result.public_id,
          filename: file.originalname,
          metadata,
          thumbnails,
          event: event || null,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
          featured: featured === 'true',
          published: published === 'true',
          alt: alt || title || file.originalname,
          caption: caption || '',
          uploadedBy: req.user.id
        });

        await mediaItem.save();
        uploadedMedia.push(mediaItem);

        // Clean up temporary file
        await fs.unlink(file.path);
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        
        // Clean up temporary file
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up temp file:', unlinkError);
        }
      }
    }

    if (uploadedMedia.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload any media files'
      });
    }

    // Populate references
    await Media.populate(uploadedMedia, [
      { path: 'event', select: 'title date' },
      { path: 'uploadedBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${uploadedMedia.length} media item(s)`,
      data: uploadedMedia
    });
  } catch (error) {
    console.error('Upload media error:', error);
    
    // Clean up temporary files if upload fails
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up temp file:', unlinkError);
        }
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while uploading media'
    });
  }
};

// @desc    Update media item
// @route   PUT /api/media/:id
// @access  Private (Admin only)
const updateMedia = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const mediaItem = await Media.findById(req.params.id);
    
    if (!mediaItem) {
      return res.status(404).json({
        success: false,
        message: 'Media item not found'
      });
    }

    const {
      title,
      description,
      event,
      tags,
      featured,
      published,
      alt,
      caption
    } = req.body;

    // Update fields
    mediaItem.title = title || mediaItem.title;
    mediaItem.description = description || mediaItem.description;
    mediaItem.event = event || mediaItem.event;
    mediaItem.tags = tags ? tags.split(',').map(tag => tag.trim()) : mediaItem.tags;
    mediaItem.featured = featured !== undefined ? featured === 'true' : mediaItem.featured;
    mediaItem.published = published !== undefined ? published === 'true' : mediaItem.published;
    mediaItem.alt = alt || mediaItem.alt;
    mediaItem.caption = caption || mediaItem.caption;
    mediaItem.updatedAt = new Date();

    await mediaItem.save();
    await mediaItem.populate([
      { path: 'event', select: 'title date' },
      { path: 'uploadedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: 'Media item updated successfully',
      data: mediaItem
    });
  } catch (error) {
    console.error('Update media error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Media item not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating media item'
    });
  }
};

// @desc    Delete media item
// @route   DELETE /api/media/:id
// @access  Private (Admin only)
const deleteMedia = async (req, res) => {
  try {
    const mediaItem = await Media.findById(req.params.id);
    
    if (!mediaItem) {
      return res.status(404).json({
        success: false,
        message: 'Media item not found'
      });
    }

    // Delete from cloudinary
    try {
      if (mediaItem.publicId) {
        await cloudinary.uploader.destroy(mediaItem.publicId, {
          resource_type: mediaItem.type === 'video' ? 'video' : 'image'
        });
      }

      // Delete thumbnails if any
      if (mediaItem.thumbnails && Object.keys(mediaItem.thumbnails).length > 0) {
        for (const [size, url] of Object.entries(mediaItem.thumbnails)) {
          try {
            const publicId = url.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`campaign2027/media/thumbnails/${publicId}`);
          } catch (thumbDeleteError) {
            console.error('Error deleting thumbnail:', thumbDeleteError);
          }
        }
      }
    } catch (deleteError) {
      console.error('Error deleting from cloudinary:', deleteError);
    }

    await Media.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Media item deleted successfully'
    });
  } catch (error) {
    console.error('Delete media error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Media item not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting media item'
    });
  }
};

// @desc    Get media by event
// @route   GET /api/media/event/:eventId
// @access  Public
const getMediaByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { type, limit = 50 } = req.query;

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    const query = { 
        event: eventId,
        published: true 
      };
  
      if (type && type !== 'all') {
        query.type = type;
      }
  
      const mediaItems = await Media.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('uploadedBy', 'name email')
        .lean();
  
      res.json({
        success: true,
        count: mediaItems.length,
        data: mediaItems
      });
    } catch (error) {
      console.error('Get media by event error:', error);
      
      if (error.name === 'CastError') {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Server error while fetching media by event'
      });
    }
  };
  
  // @desc    Get featured media
  // @route   GET /api/media/featured
  // @access  Public
  const getFeaturedMedia = async (req, res) => {
    try {
      const { type, limit = 12 } = req.query;
  
      const query = { 
        featured: true,
        published: true 
      };
  
      if (type && type !== 'all') {
        query.type = type;
      }
  
      const mediaItems = await Media.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('event', 'title date location')
        .populate('uploadedBy', 'name email')
        .lean();
  
      res.json({
        success: true,
        count: mediaItems.length,
        data: mediaItems
      });
    } catch (error) {
      console.error('Get featured media error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching featured media'
      });
    }
  };
  
  // @desc    Get media stats
  // @route   GET /api/media/stats
  // @access  Private (Admin only)
  const getMediaStats = async (req, res) => {
    try {
      const stats = await Media.aggregate([
        {
          $group: {
            _id: null,
            totalMedia: { $sum: 1 },
            totalImages: { $sum: { $cond: [{ $eq: ['$type', 'image'] }, 1, 0] } },
            totalVideos: { $sum: { $cond: [{ $eq: ['$type', 'video'] }, 1, 0] } },
            totalViews: { $sum: '$views' },
            featuredCount: { $sum: { $cond: ['$featured', 1, 0] } },
            publishedCount: { $sum: { $cond: ['$published', 1, 0] } }
          }
        }
      ]);
  
      const eventStats = await Media.aggregate([
        {
          $match: { event: { $ne: null } }
        },
        {
          $group: {
            _id: '$event',
            mediaCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'events',
            localField: '_id',
            foreignField: '_id',
            as: 'event'
          }
        },
        {
          $unwind: '$event'
        },
        {
          $project: {
            _id: 0,
            eventId: '$_id',
            eventTitle: '$event.title',
            mediaCount: 1
          }
        },
        {
          $sort: { mediaCount: -1 }
        },
        {
          $limit: 10
        }
      ]);
  
      res.json({
        success: true,
        data: {
          overall: stats[0] || {
            totalMedia: 0,
            totalImages: 0,
            totalVideos: 0,
            totalViews: 0,
            featuredCount: 0,
            publishedCount: 0
          },
          topEvents: eventStats
        }
      });
    } catch (error) {
      console.error('Get media stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching media statistics'
      });
    }
  };
  module.exports = {
    getAllMedia,
    getMediaById,
    uploadMedia,
    updateMedia,
    deleteMedia,
    getMediaByEvent,
    getFeaturedMedia,
    getMediaStats
  };