// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto');
const { AppError, catchAsync } = require('./errorHandler');

// Simple admin user model (you might want to create a proper User model)
const adminUsers = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@campaign2027.ke',
    password: '$2a$12$k1gZ/wtmYRp.BqCOLoOvnui.9Iu2j3fsJ9s0ZZp2QBOgZz/taZ2RC', // hashed 'admin123'
    role: 'super-admin',
    permissions: ['all']
  },
  {
    id: '2',
    username: 'communications',
    email: 'comms@campaign2027.ke',
    password: '$2a$12$8k2WcGN1OaOtlL4/gNhOFu7Q6sZxELGj8d9wKl2pMn3oVbCxFyZq6', // hashed 'comms2027'
    role: 'communications',
    permissions: ['press', 'media', 'newsletter']
  },
  {
    id: '3',
    username: 'volunteer-coordinator',
    email: 'volunteers@campaign2027.ke',
    password: '$2a$12$Rm8k3lL5xN2pQ7wKj9yF8O4cVdEhGf6tYu1zXs0aBn7mL9pC2kI5e', // hashed 'volunteers2027'
    role: 'volunteer-coordinator',
    permissions: ['volunteers', 'events']
  }
];

// Generate JWT token
const signToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};


// Create and send token response
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user);
  const cookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.cookie('jwt', token, cookieOptions);

  const { password, ...userWithoutPassword } = user;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: userWithoutPassword,
    },
  });
};


// Middleware to protect routes (require authentication)
const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification of token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if admin user still exists
  const currentUser = adminUsers.find(user => user.id === decoded.id);
  if (!currentUser) {
    return next(
      new AppError('The user belonging to this token does no longer exist.', 401)
    );
  }

  // 4) Check if user changed password after the token was issued
  // (In a real application, you'd check this against a database field)

  // Grant access to protected route
  req.user = currentUser;
  next();
});

// Middleware to restrict to certain roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

// Middleware to check specific permissions
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    const userPermissions = req.user.permissions;
    
    // Super admin has all permissions
    if (userPermissions.includes('all')) {
      return next();
    }

    // Check if user has any of the required permissions
    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

// Login function
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists && password is correct
  const bcrypt = require('bcryptjs');
  const user = adminUsers.find(user => user.email === email);
  
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) If everything ok, send token to client
  createSendToken(user, 200, res);
});

// Logout function
const logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

// Middleware to check if user is logged in (for rendered pages)
const isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify the token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = adminUsers.find(user => user.id === decoded.id);
      if (!currentUser) {
        return next();
      }

      // There is a logged in user
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

// Generate secure random token
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// API key authentication for external services
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return next(new AppError('API key is required', 401));
  }

  // Check against valid API keys (store these in environment variables)
  const validApiKeys = [
    process.env.INTERNAL_API_KEY,
    process.env.WEBHOOK_API_KEY,
    process.env.MEDIA_API_KEY
  ].filter(Boolean);

  if (!validApiKeys.includes(apiKey)) {
    return next(new AppError('Invalid API key', 401));
  }

  next();
};

// Rate limiting by user role
const rateLimitByRole = (req, res, next) => {
  if (!req.user) {
    return next();
  }

  // Set different rate limits based on user role
  const roleLimits = {
    'super-admin': 1000,
    'communications': 500,
    'volunteer-coordinator': 300,
    'default': 100
  };

  const userLimit = roleLimits[req.user.role] || roleLimits.default;
  req.rateLimit = { max: userLimit };
  
  next();
};

// Middleware to log admin actions
const logAdminAction = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log successful admin actions
      if (res.statusCode < 400 && req.user) {
        console.log(`Admin Action: ${action} by ${req.user.email} at ${new Date().toISOString()}`);
        
        // In production, you'd want to store this in a database
        // AdminLog.create({
        //   action,
        //   userId: req.user.id,
        //   userEmail: req.user.email,
        //   ip: req.ip,
        //   userAgent: req.get('User-Agent'),
        //   timestamp: new Date()
        // });
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware to handle concurrent sessions
const handleConcurrentSessions = (req, res, next) => {
  // In a real application, you'd check against active sessions in database
  // For now, we'll just allow multiple sessions
  next();
};

// Password strength validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);

  if (password.length < minLength) {
    return 'Password must be at least 8 characters long';
  }
  if (!hasUpperCase) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!hasLowerCase) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!hasNumbers) {
    return 'Password must contain at least one number';
  }
  if (!hasNonalphas) {
    return 'Password must contain at least one special character';
  }
  
  return null; // Password is valid
};

// Middleware to check session timeout
const checkSessionTimeout = (req, res, next) => {
  if (req.user) {
    const tokenIat = req.user.iat;
    const sessionTimeout = 8 * 60 * 60; // 8 hours in seconds
    
    if (Date.now() / 1000 - tokenIat > sessionTimeout) {
      return next(new AppError('Session expired. Please log in again.', 401));
    }
  }
  
  next();
};

// Generate password reset token
const generatePasswordResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  return { resetToken, hashedToken };
};
const authenticateAdmin = [protect, restrictTo('super-admin', 'communications')];

module.exports = {
  signToken,
  createSendToken,
  protect,
  restrictTo,
  requirePermission,
  login,
  logout,
  isLoggedIn,
  generateSecureToken,
  apiKeyAuth,
  rateLimitByRole,
  logAdminAction,
  handleConcurrentSessions,
  validatePassword,
  checkSessionTimeout,
  generatePasswordResetToken,
  authenticateAdmin,
  adminUsers // Export for testing purposes
};