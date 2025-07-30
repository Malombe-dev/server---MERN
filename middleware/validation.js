// server/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

// Helper function to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return next(new AppError(errorMessages.join('. '), 400));
  }
  next();
};

// Kenya counties for validation
const kenyanCounties = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu',
  'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho',
  'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui',
  'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera',
  'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang\'a', 'Nairobi',
  'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
  'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi',
  'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
];
// Add this before your validation rules
(req, res, next) => {
  console.log('Validating author:', req.body.author);
  console.log('Author name:', req.body.author?.name);
  console.log('Author title:', req.body.author?.title);
  next();
}
// Volunteer validation rules
const validateVolunteer = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Please provide a valid Kenyan phone number'),
  
  body('nationalId')
    .matches(/^\d{8}$/)
    .withMessage('National ID must be exactly 8 digits'),
  
  body('dateOfBirth')
    .isISO8601()
    .toDate()
    .custom((value) => {
      const age = new Date().getFullYear() - value.getFullYear();
      if (age < 18) {
        throw new Error('You must be at least 18 years old to volunteer');
      }
      return true;
    }),
  
  body('gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  
  body('county')
    .isIn(kenyanCounties)
    .withMessage('Please select a valid Kenyan county'),
  
  body('constituency')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Constituency must be between 2 and 100 characters'),
  
  body('ward')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Ward must be between 2 and 100 characters'),
  
  body('address')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Address must be between 10 and 200 characters'),
  
  body('occupation')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Occupation must be between 2 and 100 characters'),
  
  body('education')
    .isIn(['primary', 'secondary', 'certificate', 'diploma', 'degree', 'masters', 'phd'])
    .withMessage('Please select a valid education level'),
  
  body('motivation')
    .trim()
    .isLength({ min: 50, max: 1000 })
    .withMessage('Motivation must be between 50 and 1000 characters'),
  
  handleValidationErrors
];

// Press release validation rules - UPDATED
const validatePressRelease = [
  body('title')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Title must be between 10 and 200 characters'),
  
  // CHANGED: 'summary' to 'excerpt' to match frontend
  body('excerpt')
    .trim()
    .isLength({ min: 50, max: 500 })
    .withMessage('Excerpt must be between 50 and 500 characters'),
  
  body('content')
    .trim()
    .isLength({ min: 100 })
    .withMessage('Content must be at least 100 characters long'),
  
  body('category')
    .isIn(['statement', 'policy', 'campaign-update', 'response', 'announcement', 'speech', 'interview', 'endorsement', 'rally', 'debate'])
    .withMessage('Please select a valid category'),
  
  body('publishDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Please provide a valid publish date'),
  
  // Replace the author validation in validatePressRelease with:

  body('author.name')
  .isLength({ min: 2, max: 100 })
  .withMessage('Author name must be between 2 and 100 characters')
  .customSanitizer(value => value?.trim()),

  body('author.title')
  .isLength({ min: 2, max: 100 })
  .withMessage('Author title must be between 2 and 100 characters')
  .customSanitizer(value => value?.trim()),
  
  body('author.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid author email'),
  
  handleValidationErrors
];

// Contact form validation rules
const validateContact = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .optional()
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Please provide a valid Kenyan phone number'),
  
  body('subject')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  
  body('message')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Message must be between 20 and 2000 characters'),
  
  body('category')
    .isIn(['general-inquiry', 'volunteer', 'media', 'support', 'complaint', 'suggestion', 'partnership', 'donation', 'speaking-request', 'interview'])
    .withMessage('Please select a valid category'),
  
  body('county')
    .optional()
    .isIn(kenyanCounties)
    .withMessage('Please select a valid Kenyan county'),
  
  handleValidationErrors
];

// Event validation rules
const validateEvent = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Event title must be between 5 and 200 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 50, max: 2000 })
    .withMessage('Event description must be between 50 and 2000 characters'),
  
  body('type')
    .isIn(['rally', 'town-hall', 'fundraiser', 'meet-greet', 'debate', 'interview', 'volunteer-training', 'community-visit', 'launch', 'conference', 'workshop', 'prayer-meeting', 'youth-event'])
    .withMessage('Please select a valid event type'),
  
  body('startDate')
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (value < new Date()) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),
  
  body('endDate')
    .isISO8601()
    .toDate()
    .custom((value, { req }) => {
      if (value <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  body('venue.name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Venue name must be between 2 and 200 characters'),
  
  body('venue.address')
    .trim()
    .isLength({ min: 10, max: 300 })
    .withMessage('Venue address must be between 10 and 300 characters'),
  
  body('venue.county')
    .isIn(kenyanCounties)
    .withMessage('Please select a valid Kenyan county'),
  
  body('organizer.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Organizer name must be between 2 and 100 characters'),
  
  body('organizer.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid organizer email'),
  
  handleValidationErrors
];

// Newsletter subscription validation rules
const validateNewsletter = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('county')
    .optional()
    .isIn(kenyanCounties)
    .withMessage('Please select a valid Kenyan county'),
  
  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array'),
  
  body('interests.*')
    .optional()
    .isIn(['policy-updates', 'campaign-events', 'press-releases', 'volunteer-opportunities', 'fundraising', 'youth-programs', 'women-empowerment', 'economic-policy', 'education', 'healthcare', 'agriculture', 'environment'])
    .withMessage('Invalid interest selected'),
  
  handleValidationErrors
];

// Media upload validation rules
const validateMedia = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Media title must be between 5 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('category')
    .isIn(['campaign-events', 'rallies', 'meetings', 'interviews', 'speeches', 'behind-scenes', 'community-visits', 'endorsements', 'debates', 'promotional', 'press-conference', 'social-moments'])
    .withMessage('Please select a valid media category'),
  
  body('altText')
    .optional()
    .trim()
    .isLength({ max: 125 })
    .withMessage('Alt text cannot exceed 125 characters'),
  
  handleValidationErrors
];

// Parameter validation for routes
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  
  handleValidationErrors
];

// Query parameter validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

// Sanitize HTML content
const sanitizeHtml = require('sanitize-html');

const sanitizeContent = (req, res, next) => {
  // Fields that may contain HTML content
  const htmlFields = ['content', 'description', 'message', 'bio'];
  
  htmlFields.forEach(field => {
    if (req.body[field]) {
      req.body[field] = sanitizeHtml(req.body[field], {
        allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h3', 'h4'],
        allowedAttributes: {
          'a': ['href', 'target']
        },
        allowedSchemes: ['http', 'https', 'mailto']
      });
    }
  });
  
  next();
};

module.exports = {
  validateVolunteer,
  validatePressRelease,
  validateContact,
  validateEvent,
  validateNewsletter,
  validateMedia,
  validateObjectId,
  validatePagination,
  sanitizeContent,
  handleValidationErrors
};