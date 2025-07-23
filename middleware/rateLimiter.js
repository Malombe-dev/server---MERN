// server/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const MongoStore = require('rate-limit-mongo');

// MongoDB connection string for rate limiting store
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/campaign2027';

// General API rate limiter
const generalLimiter = rateLimit({
  store: new MongoStore({
    uri: mongoUrl,
    collectionName: 'rate_limits',
    expireTimeMs: 15 * 60 * 1000 // 15 minutes
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

// Strict rate limiter for sensitive endpoints
const strictLimiter = rateLimit({
  store: new MongoStore({
    uri: mongoUrl,
    collectionName: 'strict_rate_limits',
    expireTimeMs: 60 * 60 * 1000 // 1 hour
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per hour
  message: {
    error: 'Too many attempts from this IP, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Contact form rate limiter
const contactLimiter = rateLimit({
  store: new MongoStore({
    uri: mongoUrl,
    collectionName: 'contact_rate_limits',
    expireTimeMs: 60 * 60 * 1000 // 1 hour
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 contact form submissions per hour
  message: {
    error: 'Too many contact form submissions from this IP. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + email combination for more precise limiting
    return `${req.ip}-${req.body.email || 'anonymous'}`;
  }
});

// Volunteer registration rate limiter
const volunteerLimiter = rateLimit({
  store: new MongoStore({
    uri: mongoUrl,
    collectionName: 'volunteer_rate_limits',
    expireTimeMs: 24 * 60 * 60 * 1000 // 24 hours
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // Limit each IP to 3 volunteer registrations per day
  message: {
    error: 'Too many volunteer registrations from this IP. Please try again tomorrow.',
    retryAfter: '24 hours'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + email combination for volunteer registrations
    return `${req.ip}-${req.body.email || 'anonymous'}`;
  }
});

// Newsletter subscription rate limiter
const newsletterLimiter = rateLimit({
  store: new MongoStore({
    uri: mongoUrl,
    collectionName: 'newsletter_rate_limits',
    expireTimeMs: 60 * 60 * 1000 // 1 hour
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 newsletter subscriptions per hour
  message: {
    error: 'Too many newsletter subscription attempts from this IP.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// File upload rate limiter
const uploadLimiter = rateLimit({
  store: new MongoStore({
    uri: mongoUrl,
    collectionName: 'upload_rate_limits',
    expireTimeMs: 60 * 60 * 1000 // 1 hour
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 file uploads per hour
  message: {
    error: 'Too many file uploads from this IP. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Speed limiter to slow down requests after certain threshold
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  headers: true, // Send custom rate limit header with delay info
  onLimitReached: (req, res, options) => {
    console.log(`Speed limit reached for IP: ${req.ip}`);
  }
});

// Dynamic rate limiter based on user behavior
const createDynamicLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
  };

  const config = { ...defaultOptions, ...options };

  return rateLimit({
    ...config,
    keyGenerator: (req) => {
      // Use different strategies based on request type
      if (req.user && req.user.id) {
        return `user-${req.user.id}`;
      }
      if (req.body && req.body.email) {
        return `email-${req.body.email}`;
      }
      return req.ip;
    },
    skip: (req) => {
      // Skip rate limiting for certain conditions
      if (req.method === 'GET' && req.path.startsWith('/api/public')) {
        return true;
      }
      return false;
    }
  });
};

// Rate limiter for search endpoints
const searchLimiter = rateLimit({
  store: new MongoStore({
    uri: mongoUrl,
    collectionName: 'search_rate_limits',
    expireTimeMs: 5 * 60 * 1000 // 5 minutes
  }),
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 searches per 5 minutes
  message: {
    error: 'Too many search requests. Please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Media download rate limiter
const downloadLimiter = rateLimit({
  store: new MongoStore({
    uri: mongoUrl,
    collectionName: 'download_rate_limits',
    expireTimeMs: 60 * 60 * 1000 // 1 hour
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 100 downloads per hour
  message: {
    error: 'Download limit exceeded. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware to log rate limit hits
const logRateLimit = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 429) {
      console.log(`Rate limit hit: ${req.method} ${req.path} from IP: ${req.ip} at ${new Date().toISOString()}`);
    }
    originalSend.call(this, data);
  };
  
  next();
};

// Whitelist certain IPs from rate limiting
const createWhitelistLimiter = (whitelist = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check if IP is in whitelist
    if (whitelist.includes(clientIP)) {
      return next();
    }
    
    // Apply rate limiting
    return generalLimiter(req, res, next);
  };
};

// Gradual backoff for repeated violations
const createBackoffLimiter = () => {
  const violations = new Map();
  
  return rateLimit({
    store: new MongoStore({
      uri: mongoUrl,
      collectionName: 'backoff_rate_limits',
      expireTimeMs: 60 * 60 * 1000
    }),
    windowMs: 15 * 60 * 1000,
    max: (req) => {
      const ip = req.ip;
      const violationCount = violations.get(ip) || 0;
      
      // Reduce max requests for repeat offenders
      return Math.max(10, 100 - (violationCount * 10));
    },
    onLimitReached: (req) => {
      const ip = req.ip;
      const currentViolations = violations.get(ip) || 0;
      violations.set(ip, currentViolations + 1);
      
      // Clean up old violations every hour
      setTimeout(() => {
        if (violations.has(ip)) {
          violations.delete(ip);
        }
      }, 60 * 60 * 1000);
    }
  });
};

module.exports = {
  generalLimiter,
  strictLimiter,
  contactLimiter,
  volunteerLimiter,
  newsletterLimiter,
  uploadLimiter,
  speedLimiter,
  searchLimiter,
  downloadLimiter,
  createDynamicLimiter,
  createWhitelistLimiter,
  createBackoffLimiter,
  logRateLimit
};