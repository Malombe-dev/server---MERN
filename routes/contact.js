const express = require('express');
const router  = express.Router();
const { validateContact } = require('../middleware/validation');
const { generalLimiter: rateLimiter } = require('../middleware/rateLimiter');
const { authenticateAdmin } = require('../middleware/auth');
const contact = require('../controllers/contactController');

/* ---- PUBLIC ---- */
router.post('/',rateLimiter, validateContact, contact.submitContact);
router.post('/newsletter', rateLimiter, contact.subscribeNewsletter);

/* ---- ADMIN ---- */
router.get('/',                    authenticateAdmin, contact.getAllContacts);
router.get('/stats',               authenticateAdmin, contact.getContactStats);
router.get('/unread',              authenticateAdmin, contact.getUnreadCount);
router.get('/:id',                 authenticateAdmin, contact.getContactById);
router.put('/:id/status',          authenticateAdmin, contact.updateContactStatus);
router.delete('/:id',              authenticateAdmin, contact.deleteContact);
router.post('/:id/reply',          authenticateAdmin, contact.replyToContact);

/* ---- OPTIONAL / TODO ---- */
// router.patch('/:id/read', authenticateAdmin, contact.markAsRead);
// router.get('/search', authenticateAdmin, contact.searchContacts);
// router.get('/category/:category', authenticateAdmin, contact.getContactsByCategory);
// router.get('/offices/locations', contact.getOfficeLocations);

module.exports = router;