// server/models/Volunteer.js
const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
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
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^(\+254|0)[17]\d{8}$/, 'Please enter a valid Kenyan phone number']
  },
  nationalId: {
    type: String,
    required: [true, 'National ID is required'],
    unique: true,
    match: [/^\d{8}$/, 'Please enter a valid 8-digit National ID']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function(v) {
        const age = new Date().getFullYear() - v.getFullYear();
        return age >= 18;
      },
      message: 'Volunteer must be at least 18 years old'
    }
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: ['male', 'female', 'other']
  },

  // Location Information
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
  constituency: {
    type: String,
    required: [true, 'Constituency is required']
  },
  ward: {
    type: String,
    required: [true, 'Ward is required']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    maxlength: [200, 'Address cannot exceed 200 characters']
  },

  // Professional Information
  occupation: {
    type: String,
    required: [true, 'Occupation is required'],
    maxlength: [100, 'Occupation cannot exceed 100 characters']
  },
  education: {
    type: String,
    required: [true, 'Education level is required'],
    enum: ['primary', 'secondary', 'certificate', 'diploma', 'degree', 'masters', 'phd']
  },
  skills: [{
    type: String,
    enum: [
      'social-media', 'graphic-design', 'writing', 'photography', 'videography',
      'event-planning', 'public-speaking', 'fundraising', 'data-entry',
      'community-outreach', 'translation', 'legal', 'accounting', 'marketing',
      'it-support', 'driving', 'security', 'catering', 'logistics'
    ]
  }],
  languages: [{
    type: String,
    enum: ['english', 'swahili', 'kikuyu', 'luo', 'kalenjin', 'kamba', 'kisii', 'luhya', 'other']
  }],

  // Availability
  availability: {
    weekdays: {
      type: Boolean,
      default: false
    },
    weekends: {
      type: Boolean,
      default: false
    },
    evenings: {
      type: Boolean,
      default: false
    },
    fullTime: {
      type: Boolean,
      default: false
    }
  },
  preferredActivities: [{
    type: String,
    enum: [
      'door-to-door', 'phone-calls', 'social-media', 'events', 'fundraising',
      'voter-registration', 'data-entry', 'transportation', 'security',
      'media-coverage', 'translation', 'youth-outreach', 'women-outreach'
    ]
  }],

  // Campaign Involvement
  previousExperience: {
    type: Boolean,
    default: false
  },
  experienceDetails: {
    type: String,
    maxlength: [500, 'Experience details cannot exceed 500 characters']
  },
  motivation: {
    type: String,
    required: [true, 'Motivation is required'],
    maxlength: [1000, 'Motivation cannot exceed 1000 characters']
  },

  // Status and Verification
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'active', 'inactive'],
    default: 'pending'
  },
  verified: {
    type: Boolean,
    default: false
  },
  verificationDate: {
    type: Date
  },
  
  // Activity Tracking
  joinDate: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  activitiesCompleted: {
    type: Number,
    default: 0
  },
  hoursContributed: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
volunteerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
volunteerSchema.virtual('age').get(function() {
  return new Date().getFullYear() - this.dateOfBirth.getFullYear();
});

// Index for efficient queries
volunteerSchema.index({ county: 1, constituency: 1, ward: 1 });
volunteerSchema.index({ email: 1 });
volunteerSchema.index({ status: 1 });
volunteerSchema.index({ skills: 1 });

// Pre-save middleware
volunteerSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});

module.exports = mongoose.model('Volunteer', volunteerSchema);