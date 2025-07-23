// server/models/Press.js
const mongoose = require('mongoose');

const pressSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  summary: {
    type: String,
    required: [true, 'Summary is required'],
    maxlength: [500, 'Summary cannot exceed 500 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'statement', 'policy', 'campaign-update', 'response', 'announcement',
      'speech', 'interview', 'endorsement', 'rally', 'debate'
    ]
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Media attachments
  featuredImage: {
    url: String,
    publicId: String,
    alt: String
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'video', 'document'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    publicId: String,
    filename: String,
    size: Number,
    caption: String
  }],

  // Publication details
  publishDate: {
    type: Date,
    required: [true, 'Publish date is required'],
    default: Date.now
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'archived'],
    default: 'draft'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Author information
  author: {
    name: {
      type: String,
      required: [true, 'Author name is required']
    },
    title: {
      type: String,
      required: [true, 'Author title is required']
    },
    email: String,
    phone: String
  },

  // Location/Event context
  location: {
    venue: String,
    county: String,
    constituency: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  eventDate: Date,

  // Contact information for media
  mediaContact: {
    name: String,
    title: String,
    phone: String,
    email: String
  },

  // Analytics and engagement
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
    whatsapp: { type: Number, default: 0 },
    linkedin: { type: Number, default: 0 }
  },

  // SEO
  metaDescription: {
    type: String,
    maxlength: [160, 'Meta description cannot exceed 160 characters']
  },
  keywords: [{
    type: String,
    lowercase: true
  }],

  // Language
  language: {
    type: String,
    enum: ['en', 'sw'],
    default: 'en'
  },

  // Related content
  relatedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Press'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for reading time (words per minute = 200)
pressSchema.virtual('readingTime').get(function() {
  const wordCount = this.content.split(' ').length;
  const readingTime = Math.ceil(wordCount / 200);
  return readingTime;
});

// Virtual for formatted publish date
pressSchema.virtual('formattedDate').get(function() {
  return this.publishDate.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Create slug from title before saving
pressSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Auto-generate meta description if not provided
  if (!this.metaDescription && this.summary) {
    this.metaDescription = this.summary.substring(0, 160);
  }
  
  next();
});

// Indexes for efficient queries
pressSchema.index({ status: 1, publishDate: -1 });
pressSchema.index({ category: 1, publishDate: -1 });
pressSchema.index({ tags: 1 });
pressSchema.index({ slug: 1 }, { unique: true });
pressSchema.index({ 
  title: 'text', 
  summary: 'text', 
  content: 'text' 
});

// Static method to get recent press releases
pressSchema.statics.getRecent = function(limit = 10) {
  return this.find({ status: 'published' })
    .sort({ publishDate: -1 })
    .limit(limit)
    .select('title summary category publishDate featuredImage slug');
};

// Static method to get by category
pressSchema.statics.getByCategory = function(category, limit = 10) {
  return this.find({ 
    status: 'published', 
    category: category 
  })
    .sort({ publishDate: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Press', pressSchema);