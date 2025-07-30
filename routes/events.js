const express = require('express');
const router  = express.Router();
const event   = require('../controllers/eventController');
const { validateEvent } = require('../middleware/validation');
const { generalLimiter: rateLimiter } = require('../middleware/rateLimiter');

const { authenticateAdmin } = require('../middleware/auth');

/* ---- PUBLIC ROUTES ---- */
router.get('/',               event.getAllEvents);
router.get('/upcoming',       event.getUpcomingEvents);
router.get('/past',           event.getPastEvents);
router.get('/featured',       event.getFeaturedEvents);
router.get('/:id',            event.getEventById);

/* ---- ADMIN ROUTES ---- */
router.post('/',        rateLimiter, authenticateAdmin, validateEvent, event.createEvent);
router.put('/:id',                  authenticateAdmin, validateEvent, event.updateEvent);
router.delete('/:id',               authenticateAdmin,               event.deleteEvent);
router.get('/stats/analytics',      authenticateAdmin,               event.getEventStats);

/* ---- OPTIONAL / TODO: implement later ---- */
// router.get('/categories',        event.getEventCategories);   // already exported
// router.get('/county/:county',    event.getEventsByCounty);    // needs controller
// router.get('/category/:category',event.getEventsByCategory);  // needs controller
// router.post('/:id/register',     rateLimiter, event.registerForEvent);
// router.get('/:id/attendees',     authenticateAdmin, event.getEventAttendees);
// router.post('/:id/checkin',      rateLimiter, event.checkInToEvent);

module.exports = router;