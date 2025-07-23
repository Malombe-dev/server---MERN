// server/models/Newsletter.js
const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  
  // Subscription Preferences
  status: {
    type: String,
    enum: ['active', 'unsubscribed', 'bounced', 'complained'],
    default: 'active'
  },
  subscriptionDate: {
    type: Date,
    default: Date.now
  },
  unsubscribeDate: Date,
  
  // Demographics (optional)
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
  ageGroup: {
    type: String,
    enum: ['18-25', '26-35', '36-45', '46-55', '56-65', '65+']
  },
  interests: [{
    type: String,
    enum: [
      'policy-updates', 'campaign-events', 'press-releases', 'volunteer-opportunities',
      'fundraising', 'youth-programs', 'women-empowerment', 'economic-policy',
      'education', 'healthcare', 'agriculture', 'environment'
    ]
  }],
  
  // Email Preferences
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'major-updates'],
    default: 'weekly'
  },
  language: {
    type: String,
    enum: ['en', 'sw'],
    default: 'en'
  },
  
  // Subscription Source
  source: {
    type: String,
    enum: ['website', 'event', 'social-media', 'referral', 'volunteer-form'],
    default: 'website'
  },
  referrer: String,
  
  // Engagement Tracking
  emailsReceived: {
    type: Number,
    default: 0
  },
  emailsOpened: {
    type: Number,
    default: 0
  },
  linksClicked: {
    type: Number,
    default: 0
  },
  lastOpenDate: Date,
  lastClickDate: Date,
  
  // Email History
  emailHistory: [{
    campaignId: String,
    subject: String,
    sentDate: Date,
    opened: {
      type: Boolean,
      default: false
    },
    openDate: Date,
    clicked: {
      type: Boolean,
      default: false
    },
    clickDate: Date,
    bounced: {
      type: Boolean,
      default: false
    },
    complained: {
      type: Boolean,
      default: false
    }
  }],
  
  // Segmentation Tags
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Verification
  verified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationDate: Date,
  
  // Unsubscribe
  unsubscribeToken: {
    type: String,
    unique: true,
    sparse: true
  },
  unsubscribeReason: {
    type: String,
    enum: [
      'too-frequent', 'not-relevant', 'never-subscribed', 'spam',
      'changed-email', 'lost-interest', 'other'
    ]
  },
  unsubscribeFeedback: String,
  
  // IP and User Agent for tracking
  ipAddress: String,
  userAgent: String,
  
  // Double Opt-in
  doubleOptIn: {
    type: Boolean,
    default: false
  },
  confirmationDate: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
newsletterSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.email;
});

// Virtual for engagement rate
newsletterSchema.virtual('engagementRate').get(function() {
  if (this.emailsReceived === 0) return 0;
  return ((this.emailsOpened / this.emailsReceived) * 100).toFixed(1);
});

// Virtual for click-through rate
newsletterSchema.virtual('clickThroughRate').get(function() {
  if (this.emailsOpened === 0) return 0;
  return ((this.linksClicked / this.emailsOpened) * 100).toFixed(1);
});

// Pre-save middleware to generate unsubscribe token
newsletterSchema.pre('save', function(next) {
  if (this.isNew && !this.unsubscribeToken) {
    this.unsubscribeToken = require('crypto')
      .randomBytes(32)
      .toString('hex');
  }
  next();
});

// Indexes for efficient queries
newsletterSchema.index({ email: 1 }, { unique: true });
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ county: 1, status: 1 });
newsletterSchema.index({ interests: 1 });
newsletterSchema.index({ tags: 1 });
newsletterSchema.index({ unsubscribeToken: 1 });
newsletterSchema.index({ verificationToken: 1 });

// Static method to get active subscribers
newsletterSchema.statics.getActiveSubscribers = function(filters = {}) {
  const query = { status: 'active', ...filters };
  return this.find(query).sort({ subscriptionDate: -1 });
};

// Static method to get subscribers by county
newsletterSchema.statics.getByCounty = function(county) {
  return this.find({ 
    status: 'active', 
    county: county 
  });
};

// Static method to get subscribers by interests
newsletterSchema.statics.getByInterests = function(interests) {
  return this.find({ 
    status: 'active', 
    interests: { $in: interests } 
  });
};

// Method to record email sent
newsletterSchema.methods.recordEmailSent = function(campaignData) {
  this.emailsReceived += 1;
  this.emailHistory.push({
    campaignId: campaignData.id,
    subject: campaignData.subject,
    sentDate: new Date()
  });
  return this.save();
};

// Method to record email opened
newsletterSchema.methods.recordEmailOpened = function(campaignId) {
  this.emailsOpened += 1;
  this.lastOpenDate = new Date();
  
  const emailRecord = this.emailHistory.find(
    record => record.campaignId === campaignId
  );
  if (emailRecord && !emailRecord.opened) {
    emailRecord.opened = true;
    emailRecord.openDate = new Date();
  }
  
  return this.save();
};

// Method to record link clicked
newsletterSchema.methods.recordLinkClicked = function(campaignId) {
  this.linksClicked += 1;
  this.lastClickDate = new Date();
  
  const emailRecord = this.emailHistory.find(
    record => record.campaignId === campaignId
  );
  if (emailRecord && !emailRecord.clicked) {
    emailRecord.clicked = true;
    emailRecord.clickDate = new Date();
  }
  
  return this.save();
};

// Method to unsubscribe
newsletterSchema.methods.unsubscribe = function(reason = '', feedback = '') {
  this.status = 'unsubscribed';
  this.unsubscribeDate = new Date();
  this.unsubscribeReason = reason;
  this.unsubscribeFeedback = feedback;
  return this.save();
};

// Method to resubscribe
newsletterSchema.methods.resubscribe = function() {
  this.status = 'active';
  this.unsubscribeDate = undefined;
  this.unsubscribeReason = undefined;
  this.unsubscribeFeedback = undefined;
  return this.save();
};

module.exports = mongoose.model('Newsletter', newsletterSchema);