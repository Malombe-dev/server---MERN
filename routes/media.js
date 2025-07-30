const express = require('express');
const router  = express.Router();
const media   = require('../controllers/mediaController');
const { validateMedia } = require('../middleware/validation');
const { generalLimiter: rateLimiter } = require('../middleware/rateLimiter');
const { authenticateAdmin } = require('../middleware/auth');
const multer = require('multer');
const path   = require('path');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|mp4|avi|mov/.test(path.extname(file.originalname).toLowerCase()) &&
               /image|video/.test(file.mimetype);
    cb(null, ok || new Error('Only images & videos'));
  }
});

/* ----  PUBLIC ROUTES  ---- */
router.get('/',                   media.getAllMedia);
router.get('/event/:eventId',     media.getMediaByEvent);
router.get('/featured',           media.getFeaturedMedia);
router.get('/:id',                media.getMediaById);

/* ----  ADMIN ROUTES  ---- */
router.post('/',            rateLimiter, authenticateAdmin, upload.array('file', 1), validateMedia, media.uploadMedia);
router.post('/bulk-upload',            authenticateAdmin, upload.array('files', 20),                media.uploadMedia); // reuse uploadMedia
router.put('/:id',                     authenticateAdmin, validateMedia,                            media.updateMedia);
router.delete('/:id',                  authenticateAdmin,                                           media.deleteMedia);
router.get('/stats/analytics',         authenticateAdmin,                                           media.getMediaStats);

module.exports = router;