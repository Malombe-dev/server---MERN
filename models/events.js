// server/models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [500, 'Short description cannot exceed 500 characters']
  },
  
  // Event Details
  type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: [
      'rally', 'town-hall', 'fundraiser', 'meet-greet', 'debate',
      'interview', 'volunteer-training', 'community-visit', 'launch',
      'conference', 'workshop', 'prayer-meeting', 'youth-event'
    ]
  },
  category: {
    type: String,
    enum: ['public', 'private', 'media', 'volunteer', 'donor'],
    default: 'public'
  },
  
  // Date and Time
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  timezone: {
    type: String,
    default: 'Africa/Nairobi'
  },
  allDay: {
    type: Boolean,
    default: false
  },
  
  // Location
  venue: {
    name: {
      type: String,
      required: [true, 'Venue name is required']
    },
    address: {
      type: String,
      required: [true, 'Venue address is required']
    },
    county: {
      type: String,
      required: [true, 'County is required'],
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
    ward: String,
    coordinates: {
      lat: {
        type: Number,
        min: [-4.7, 'Invalid latitude for Kenya'],
        max: [5.5, 'Invalid latitude for Kenya']
      },
      lng: {
        type: Number,
        min: [33.9, 'Invalid longitude for Kenya'],
        max: [42.0, 'Invalid longitude for Kenya']
      }
    },
    capacity: Number,
    facilities: [{
      type: String,
      enum: ['parking', 'disabled-access', 'sound-system', 'stage', 'seating', 'catering', 'security']
    }]
  },
  
  // Registration and Attendance
  requiresRegistration: {
    type: Boolean,
    default: false
  },
  registrationDeadline: Date,
  maxAttendees: Number,
  currentAttendees: {
    type: Number,
    default: 0
  },
  waitlistEnabled: {
    type: Boolean,
    default: false
  },
  
  // Event Status
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'postponed', 'completed'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'invitation-only'],
    default: 'public'
  },
  
  // Speakers and Attendees
  speakers: [{
    name: {
      type: String,
      required: true
    },
    title: String,
    bio: String,
    photo: String,
    topic: String,
    duration: Number // in minutes
  }],
  specialGuests: [{
    name: String,
    title: String,
    organization: String
  }],
  
  // Event Organization
  organizer: {
    name: {
      type: String,
      required: [true, 'Organizer name is required']
    },
    email: String,
    phone: String,
    organization: String
  },
  coordinators: [{
    name: String,
    email: String,
    phone: String,
    role: String
  }],
  
  // Requirements and Resources
  volunteers: {
    required: {
      type: Number,
      default: 0
    },
    registered: {
      type: Number,
      default: 0
    },
    roles: [{
      name: String,
      count: Number,
      description: String
    }]
  },
  equipment: [{
    item: String,
    quantity: Number,
    status: {
      type: String,
      enum: ['needed', 'confirmed', 'delivered'],
      default: 'needed'
    }
  }],
  
  // Media and Promotion
  featuredImage: {
    url: String,
    publicId: String,
    alt: String
  },
  gallery: [{
    url: String,
    publicId: String,
    caption: String
  }],
  livestream: {
    enabled: {
      type: Boolean,
      default: false
    },
    platform: {
      type: String,
      enum: ['youtube', 'facebook', 'instagram', 'twitter', 'zoom']
    },
    url: String
  },
  
  // Social Media
  hashtags: [{
    type: String,
    lowercase: true
  }],
  socialLinks: {
    facebook: String,
    twitter: String,
    instagram: String,
    youtube: String
  },
  
  // RSVP and Registration
  rsvps: [{
    name: String,
    email: String,
    phone: String,
    status: {
      type: String,
      enum: ['confirmed', 'maybe', 'declined'],
      default: 'confirmed'
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    specialRequests: String
  }],
  
  // Follow-up
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpNotes: String,
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  registrations: {
    type: Number,
    default: 0
  },
  actualAttendance: Number,
  
  // Tags and Categorization
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Related Content
  relatedEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
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

// Virtual for event duration
eventSchema.virtual('duration').get(function() {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return diffHours;
  }
  return null;
});

// Virtual for formatted date range
eventSchema.virtual('formattedDateRange').get(function() {
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const start = this.startDate.toLocaleDateString('en-KE', options);
  const end = this.endDate.toLocaleDateString('en-KE', options);
  
  if (this.allDay) {
    return this.startDate.toLocaleDateString('en-KE', {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  }
  
  return `${start} - ${end}`;
});

// Virtual for registration status
eventSchema.virtual('registrationStatus').get(function() {
  if (!this.requiresRegistration) return 'open';
  if (this.registrationDeadline && new Date() > this.registrationDeadline) return 'closed';
  if (this.maxAttendees && this.currentAttendees >= this.maxAttendees) return 'full';
  return 'open';
});

// Create slug from title before saving
eventSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    const date = this.startDate.toISOString().split('T')[0];
    this.slug = `${this.title}-${date}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Validate end date is after start date
eventSchema.pre('save', function(next) {
  if (this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
  } else {
    next();
  }
});

// Indexes for efficient queries
eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ 'venue.county': 1, startDate: 1 });
eventSchema.index({ type: 1, startDate: 1 });
eventSchema.index({ slug: 1 }, { unique: true });
eventSchema.index({ tags: 1 });
eventSchema.index({ 
  title: 'text', 
  description: 'text', 
  'venue.name': 'text' 
});

// Static method to get upcoming events
eventSchema.statics.getUpcoming = function(limit = 10) {
  return this.find({ 
    status: 'published',
    startDate: { $gte: new Date() }
  })
    .sort({ startDate: 1 })
    .limit(limit);
};

// Static method to get events by county
eventSchema.statics.getByCounty = function(county, limit = 10) {
  return this.find({ 
    status: 'published',
    'venue.county': county
  })
    .sort({ startDate: 1 })
    .limit(limit);
};

// Method to register attendee
eventSchema.methods.registerAttendee = function(attendeeData) {
  if (this.registrationStatus === 'open') {
    this.rsvps.push(attendeeData);
    this.currentAttendees += 1;
    return this.save();
  } else {
    throw new Error('Registration is not available');
  }
};

module.exports = mongoose.model('Event', eventSchema);