// server/routes/volunteers.js

const express = require('express');
const router = express.Router();

const volunteerController = require('../controllers/volunteersController');
const { validateVolunteer } = require('../middleware/validation');
const { volunteerLimiter } = require('../middleware/rateLimiter');

// Create new volunteer
router.post('/', volunteerLimiter, validateVolunteer, volunteerController.createVolunteer);

// Get all volunteers (admin)
router.get('/', volunteerController.getAllVolunteers);

// Get single volunteer by ID
router.get('/:id', volunteerController.getVolunteer);

// Update volunteer status (admin)
router.patch('/:id/status', volunteerController.updateVolunteerStatus);

// Update volunteer activity
router.patch('/:id/activity', volunteerController.updateVolunteerActivity);

// Delete volunteer (admin)
router.delete('/:id', volunteerController.deleteVolunteer);

// Volunteer statistics (admin)
router.get('/stats/overview', volunteerController.getVolunteerStats);

// Search volunteers
router.get('/search', volunteerController.searchVolunteers);

// Get volunteers by location
router.get('/filter/location', volunteerController.getVolunteersByLocation);

// Export volunteers
router.get('/export', volunteerController.exportVolunteers);

module.exports = router;
