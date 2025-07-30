// server/middleware/errorHandler.js
const mongoose = require('mongoose');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle Mongoose Cast Error (Invalid ObjectId)
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Handle Mongoose Duplicate Field Error
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists. Please use another value.`;
  return new AppError(message, 400);
};

// Handle Mongoose Validation Error
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle JWT Invalid Token Error
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

// Handle JWT Expired Token Error
const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

// Send error response in development
const sendErrorDev = (err, req, res) => {
  // API Error
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  }

  // Rendered website error
  console.error('ERROR 💥', err);
  return res.status(err.statusCode).json({
    success: false,
    message: err.message
  });
};

// Send error response in production
const sendErrorProd = (err, req, res) => {
  // API Error
  if (req.originalUrl.startsWith('/api')) {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        success: false,
        status: err.status,
        message: err.message
      });
    }
    
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: 'Something went wrong!'
    });
  }

  // Non-API errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }
  
  // Programming or other unknown error: don't leak error details
  console.error('ERROR 💥', err);
  return res.status(err.statusCode || 500).json({
    success: false,
    message: 'Please try again later.'
  });
};

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  console.log('=== ERROR HANDLER TRIGGERED ===');
  console.log('Error name:', err.name);
  console.log('Error message:', err.message);
  console.log('Error stack:', err.stack);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};

// Async error wrapper for route handlers
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// 404 Not Found middleware
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `🔍 API route not found: ${req.originalUrl}`
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! 💥', reason.stack || reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥', err.stack);
  process.exit(1);
});

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync,
  notFound
};