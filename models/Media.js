// server/models/Media.js
const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    required: [true, 'Media type is required'],
    enum: ['image', 'video', 'audio', 'document']
  },
  
  // File information
  url: {
    type: String,
    required: [true, 'Media URL is required']
  },
  publicId: {
    type: String, // Cloudinary public ID for deletion
    required: [true, 'Public ID is required']
  },
  filename: String,
  originalName: String,
  size: {
    type: Number, // File size in bytes
    required: true
  },
  mimeType: String,
  
  // Image/Video specific
  dimensions: {
    width: Number,
    height: Number
  },
  duration: Number, // For videos/audio in seconds
  
  // Thumbnails for videos
  thumbnail: {
    url: String,
    publicId: String
  },
  
  // Organization and categorization
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'campaign-events', 'rallies', 'meetings', 'interviews', 'speeches',
      'behind-scenes', 'community-visits', 'endorsements', 'debates',
      'promotional', 'press-conference', 'social-moments'
    ]
  },
  album: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Event/Context information
  event: {
    name: String,
    date: Date,
    location: {
      venue: String,
      county: String,
      constituency: String,
      ward: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    }
  },
  
  // People in the media
  peopleTagged: [{
    name: String,
    title: String,
    role: String
  }],
  
  // Attribution
  photographer: {
    name: String,
    contact: String,
    credit: String
  },
  source: {
    type: String,
    enum: ['official', 'volunteer', 'media-partner', 'public', 'agency'],
    default: 'official'
  },
  
  // Status and publication
  status: {
    type: String,
    enum: ['private', 'public', 'featured', 'archived'],
    default: 'private'
  },
  featured: {
    type: Boolean,
    default: false
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  
  // Usage rights and permissions
  rights: {
    type: String,
    enum: ['all-rights', 'limited-use', 'attribution-required', 'no-commercial'],
    default: 'all-rights'
  },
  copyrightHolder: String,
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  downloads: {
    type: Number,
    default: 0
  },
  shares: {
    facebook: { type: Number, default: 0 },
    twitter: { type: Number, default: 0 },
    instagram: { type: Number, default: 0 },
    whatsapp: { type: Number, default: 0 }
  },
  
  // Alternative text for accessibility
  altText: {
    type: String,
    maxlength: [125, 'Alt text cannot exceed 125 characters']
  },
  
  // Metadata
  exifData: {
    camera: String,
    lens: String,
    settings: String,
    gps: {
      lat: Number,
      lng: Number
    }
  },
  
  // Quality and processing
  quality: {
    type: String,
    enum: ['low', 'medium', 'high', 'original'],
    default: 'high'
  },
  processed: {
    type: Boolean,
    default: false
  },
  
  // Related content
  relatedMedia: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  }],
  pressRelease: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Press'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for file size in human readable format
mediaSchema.virtual('formattedSize').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for aspect ratio (for images/videos)
mediaSchema.virtual('aspectRatio').get(function() {
  if (this.dimensions && this.dimensions.width && this.dimensions.height) {
    return (this.dimensions.width / this.dimensions.height).toFixed(2);
  }
  return null;
});

// Virtual for formatted duration (for videos/audio)
mediaSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return null;
  
  const minutes = Math.floor(this.duration / 60);
  const seconds = Math.floor(this.duration % 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Indexes for efficient queries
mediaSchema.index({ type: 1, status: 1, publishDate: -1 });
mediaSchema.index({ category: 1, publishDate: -1 });
mediaSchema.index({ album: 1, publishDate: -1 });
mediaSchema.index({ tags: 1 });
mediaSchema.index({ featured: 1, publishDate: -1 });
mediaSchema.index({ 'event.date': -1 });
mediaSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text' 
});

// Static method to get featured media
mediaSchema.statics.getFeatured = function(type = null, limit = 10) {
  const query = { 
    status: 'public', 
    featured: true 
  };
  
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ publishDate: -1 })
    .limit(limit);
};

// Static method to get by category
mediaSchema.statics.getByCategory = function(category, limit = 20) {
  return this.find({ 
    status: 'public', 
    category: category 
  })
    .sort({ publishDate: -1 })
    .limit(limit);
};

// Static method to get gallery by album
mediaSchema.statics.getAlbum = function(album, limit = 50) {
  return this.find({ 
    status: 'public', 
    album: album 
  })
    .sort({ publishDate: -1 })
    .limit(limit);
};

// Method to increment views
mediaSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to increment downloads
mediaSchema.methods.incrementDownloads = function() {
  this.downloads += 1;
  return this.save();
};

module.exports = mongoose.model('Media', mediaSchema);