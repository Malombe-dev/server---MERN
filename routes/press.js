const express = require('express');
const router = express.Router();

const press = require('../controllers/pressController');
const { validatePressRelease: validatePress } = require('../middleware/validation');
const { generalLimiter: rateLimiter } = require('../middleware/rateLimiter');
const { protect, restrictTo } = require('../middleware/auth');
const { uploadMiddleware, handleUploadError } = require('../middleware/upload');

// Enhanced middleware validator with debug logging
const validateMiddlewareChain = (middlewares, routeName) => {
  return middlewares.map((middleware, index) => {
    if (typeof middleware !== 'function') {
      console.error(`⚠️ Invalid middleware at position ${index} in ${routeName} route`);
      console.error('Middleware should be a function but got:', typeof middleware);
      return (req, res, next) => next();
    }
    return middleware;
  });
};

// Debug the validatePress middleware
console.log('validatePress length:', validatePress.length);
validatePress.forEach((mw, i) => {
  console.log(`Middleware ${i}:`, typeof mw === 'function' ? '[Function]' : mw);
});

// Admin route builder with error handling
const buildAdminRoute = (method, path, ...middlewares) => {
  const validatedMiddlewares = validateMiddlewareChain(middlewares, path);
  return router[method](path, ...validatedMiddlewares);
};

// Public routes
router.get('/latest', press.getLatestPress);
router.get('/search', press.searchPress);
router.get('/stats/analytics', protect, restrictTo('super-admin'), press.getPressStats);
router.get('/type/:type', press.getPressByType);
router.get('/:id', press.getPressById);
router.get('/', press.getAllPress);

// Admin routes with enhanced error handling
buildAdminRoute(
  'post',
  '/',
  rateLimiter,
  protect,
  restrictTo('super-admin', 'communications'),
  uploadMiddleware.fields,
  handleUploadError,
  ...validatePress,
  (req, res, next) => {
    try {
      if (!press.createPress) throw new Error('createPress controller missing');
      return press.createPress(req, res, next);
    } catch (err) {
      console.error('POST / error:', err);
      return res.status(500).json({ 
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

buildAdminRoute(
  'put',
  '/:id',
  protect,
  restrictTo('super-admin', 'communications'),
  uploadMiddleware.fields,
  handleUploadError,
  ...validatePress,
  (req, res, next) => {
    try {
      if (!press.updatePress) throw new Error('updatePress controller missing');
      return press.updatePress(req, res, next);
    } catch (err) {
      console.error('PUT /:id error:', err);
      return res.status(500).json({ 
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Other admin routes
router.delete('/:id', protect, restrictTo('super-admin', 'communications'), press.deletePress);
router.patch('/:id/featured', protect, restrictTo('super-admin', 'communications'), press.toggleFeatured);
router.delete('/:id/attachments/:attachmentId', protect, restrictTo('super-admin', 'communications'), press.deleteAttachment);

// Media upload route
router.post(
  '/upload-media',
  protect,
  restrictTo('super-admin', 'communications'),
  uploadMiddleware.multiple,
  handleUploadError,
  (req, res, next) => {
    try {
      if (!press.uploadMedia) throw new Error('uploadMedia controller missing');
      return press.uploadMedia(req, res, next);
    } catch (err) {
      console.error('POST /upload-media error:', err);
      return res.status(500).json({ 
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Central error handler
router.use((err, req, res, next) => {
  console.error('Route error:', err);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;