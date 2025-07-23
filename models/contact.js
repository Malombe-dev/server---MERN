// server/models/Contact.js
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    match: [/^(\+254|0)[17]\d{8}$/, 'Please enter a valid Kenyan phone number']
  },
  
  // Contact Details
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'general-inquiry', 'volunteer', 'media', 'support', 'complaint',
      'suggestion', 'partnership', 'donation', 'speaking-request', 'interview'
    ]
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Location Information
  county: {
    type: String,
    enum: [
      'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu',
      'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho',
      'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui',
      'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera',
      'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang\'a', 'Nairobi',
      'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
      'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi',
      'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
    ]
  },
  constituency: String,
  
  // Organization/Affiliation
  organization: {
    type: String,
    maxlength: [100, 'Organization name cannot exceed 100 characters']
  },
  title: {
    type: String,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  // Status and Processing
  status: {
    type: String,
    enum: ['new', 'in-progress', 'resolved', 'closed', 'spam'],
    default: 'new'
  },
  assignedTo: {
    name: String,
    email: String,
    department: {
      type: String,
      enum: ['communications', 'volunteer-coordination', 'media', 'policy', 'operations']
    }
  },
  
  // Response Information
  responseRequired: {
    type: Boolean,
    default: true
  },
  responseMethod: {
    type: String,
    enum: ['email', 'phone', 'both'],
    default: 'email'
  },
  responded: {
    type: Boolean,
    default: false
  },
  responseDate: Date,
  responseNotes: String,
  
  // Follow-up
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: Date,
  followUpNotes: String,
  
  // Metadata
  source: {
    type: String,
    enum: ['website', 'social-media', 'phone', 'email', 'event', 'referral'],
    default: 'website'
  },
  ipAddress: String,
  userAgent: String,
  referrer: String,
  
  // Tags for organization
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Internal notes (not visible to sender)
  internalNotes: String,
  
  // Attachments
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mimeType: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
contactSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for days since submission
contactSchema.virtual('daysSinceSubmission').get(function() {
  const diffTime = Math.abs(new Date() - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Indexes for efficient queries
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ category: 1, createdAt: -1 });
contactSchema.index({ priority: 1, status: 1 });
contactSchema.index({ email: 1 });
contactSchema.index({ assignedTo: 1 });
contactSchema.index({ 
  firstName: 'text', 
  lastName: 'text', 
  subject: 'text', 
  message: 'text' 
});

// Static method to get pending contacts
contactSchema.statics.getPending = function(limit = 20) {
  return this.find({ 
    status: { $in: ['new', 'in-progress'] } 
  })
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit);
};

// Static method to get by category
contactSchema.statics.getByCategory = function(category, limit = 20) {
  return this.find({ category: category })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Method to mark as responded
contactSchema.methods.markAsResponded = function(notes = '') {
  this.responded = true;
  this.responseDate = new Date();
  this.responseNotes = notes;
  this.status = 'resolved';
  return this.save();
};

module.exports = mongoose.model('Contact', contactSchema);