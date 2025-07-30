const mongoose = require('mongoose');

const pressSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [10, 'Title must be at least 10 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true
    },
    // CHANGED: from 'summary' to 'excerpt' to match frontend
    excerpt: {
      type: String,
      required: [true, 'Excerpt is required'],
      trim: true,
      minlength: [50, 'Excerpt must be at least 50 characters'],
      maxlength: [500, 'Excerpt cannot exceed 500 characters']
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      minlength: [100, 'Content must be at least 100 characters']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'statement',
        'policy',
        'campaign-update',
        'response',
        'announcement',
        'speech',
        'interview',
        'endorsement',
        'rally',
        'debate'
      ]
    },
    type: {
      type: String,
      enum: ['PRESS RELEASE', 'VIDEO', 'ANNOUNCEMENT'],
      default: 'PRESS RELEASE'
    },
    tags: [{ type: String, lowercase: true, trim: true }],

    /* --- Media --- */
    featuredImage: {
      url: String,
      publicId: String,
      alt: String
    },
    attachments: [
      {
        type: {
          type: String,
          enum: ['image', 'video'], // <-- ONLY image / video
          required: true
        },
        url: { type: String, required: true },
        publicId: String,
        filename: String,
        size: Number,
        caption: String
      }
    ],

    /* --- Publication --- */
    publishDate: {
      type: Date,
      default: Date.now
    },
    // ADDED: published field to match frontend
    published: {
      type: Boolean,
      default: false
    },
    // ADDED: featured field to match frontend
    featured: {
      type: Boolean,
      default: false
    },
    // KEEP: status for internal workflow
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

    /* --- Author --- */
    author: {
      name: { 
        type: String, 
        required: [true, 'Author name is required'],
        minlength: [2, 'Author name must be at least 2 characters'],
        maxlength: [100, 'Author name cannot exceed 100 characters']
      },
      title: { 
        type: String, 
        required: [true, 'Author title is required'],
        minlength: [2, 'Author title must be at least 2 characters'],
        maxlength: [100, 'Author title cannot exceed 100 characters']
      },
      email: String,
      phone: String
    },

    /* --- Location / Event --- */
    location: {
      venue: String,
      county: String,
      constituency: String,
      coordinates: { lat: Number, lng: Number }
    },
    eventDate: Date,

    /* --- Media contact --- */
    mediaContact: {
      name: String,
      title: String,
      phone: String,
      email: String
    },

    /* --- Analytics --- */
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    shares: {
      facebook: { type: Number, default: 0 },
      twitter: { type: Number, default: 0 },
      whatsapp: { type: Number, default: 0 },
      linkedin: { type: Number, default: 0 }
    },

    /* --- SEO --- */
    // UPDATED: SEO structure to match frontend
    seo: {
      title: {
        type: String,
        trim: true,
        maxlength: [60, 'SEO title cannot exceed 60 characters']
      },
      description: {
        type: String,
        trim: true,
        maxlength: [160, 'SEO description cannot exceed 160 characters']
      },
      keywords: [{
        type: String,
        trim: true,
        lowercase: true
      }]
    },
    // KEEP: Legacy fields for backward compatibility
    metaDescription: { type: String, maxlength: 160 },
    keywords: [{ type: String, lowercase: true }],
    language: { type: String, enum: ['en', 'sw'], default: 'en' },

    /* --- Relations --- */
    relatedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Press' }]
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

/* --- Virtuals & Hooks --- */
pressSchema.virtual('readingTime').get(function () {
  const wordCount = this.content.split(' ').length;
  return Math.ceil(wordCount / 200);
});

pressSchema.virtual('formattedDate').get(function () {
  return this.publishDate.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

pressSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Update metaDescription from excerpt (changed from summary)
  if (!this.metaDescription && this.excerpt) {
    this.metaDescription = this.excerpt.substring(0, 160);
  }
  
  // Auto-sync published status with status field
  if (this.published && this.status === 'draft') {
    this.status = 'published';
  } else if (!this.published && this.status === 'published') {
    this.status = 'draft';
  }
  
  // Initialize seo object if it doesn't exist
  if (!this.seo) {
    this.seo = {};
  }
  
  // Handle SEO defaults - truncate excerpt to fit 160 char limit
  if (!this.seo.title) {
    this.seo.title = this.title;
  }
  if (!this.seo.description && this.excerpt) {
    this.seo.description = this.excerpt.substring(0, 160);
  }
  
  next();
});

/* --- Indexes --- */
pressSchema.index({ status: 1, publishDate: -1 });
pressSchema.index({ published: 1, publishDate: -1 }); // ADDED for published field
pressSchema.index({ featured: 1 }); // ADDED for featured field
pressSchema.index({ category: 1, publishDate: -1 });
pressSchema.index({ tags: 1 });
pressSchema.index({ slug: 1 }, { unique: true });
// UPDATED: text index to use excerpt instead of summary
pressSchema.index({ title: 'text', excerpt: 'text', content: 'text' });

/* --- Statics --- */
pressSchema.statics.getRecent = function (limit = 10) {
  return this.find({ published: true }) // UPDATED to use published field
    .sort({ publishDate: -1 })
    .limit(limit)
    .select('title excerpt category publishDate featuredImage slug featured'); // UPDATED fields
};

pressSchema.statics.getByCategory = function (category, limit = 10) {
  return this.find({ published: true, category }) // UPDATED to use published field
    .sort({ publishDate: -1 })
    .limit(limit);
};

pressSchema.statics.getFeatured = function (limit = 5) {
  return this.find({ published: true, featured: true })
    .sort({ publishDate: -1 })
    .limit(limit)
    .select('title excerpt category publishDate featuredImage slug');
};

module.exports = mongoose.model('Press', pressSchema);