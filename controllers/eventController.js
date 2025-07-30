const Event = require('../models/Event');
const { validationResult } = require('express-validator');
const emailService = require('../utils/emailService');

// @desc    Get all events
// @route   GET /api/events
// @access  Public
const getAllEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      location,
      upcoming = 'false',
      featured = 'false',
      search,
      startDate,
      endDate,
      sortBy = 'date',
      order = 'asc'
    } = req.query;

    // Build query
    const query = { published: true };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (location) {
      query.$or = [
        { 'location.county': { $regex: location, $options: 'i' } },
        { 'location.constituency': { $regex: location, $options: 'i' } },
        { 'location.venue': { $regex: location, $options: 'i' } }
      ];
    }
    
    if (upcoming === 'true') {
      query.date = { $gte: new Date() };
    }
    
    if (featured === 'true') {
      query.featured = true;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.venue': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate || endDate) {
      if (!query.date) query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Event.countDocuments(query);
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = order === 'desc' ? -1 : 1;
    
    // Fetch events
    const events = await Event.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: events,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching events'
    });
  }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if published (unless admin)
    if (!event.published && req.user?.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Increment view count
    await Event.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 }
    });

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Get event by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching event'
    });
  }
};

// @desc    Create new event
// @route   POST /api/events
// @access  Private (Admin only)
const createEvent = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      title,
      description,
      category,
      date,
      endDate,
      location,
      capacity,
      requiresRegistration,
      registrationDeadline,
      isVirtual,
      virtualLink,
      agenda,
      speakers,
      tags,
      featured,
      published,
      ticketPrice,
      contactInfo
    } = req.body;

    // Create event
    const event = new Event({
      title,
      description,
      category,
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      location: {
        venue: location?.venue || '',
        address: location?.address || '',
        county: location?.county || '',
        constituency: location?.constituency || '',
        coordinates: location?.coordinates || null
      },
      capacity: capacity || null,
      requiresRegistration: requiresRegistration === 'true',
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      isVirtual: isVirtual === 'true',
      virtualLink: virtualLink || '',
      agenda: agenda || [],
      speakers: speakers || [],
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      featured: featured === 'true',
      published: published === 'true',
      ticketPrice: ticketPrice || 0,
      contactInfo: contactInfo || {},
      createdBy: req.user.id
    });

    await event.save();

    // Populate creator info before sending response
    await event.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating event'
    });
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Admin only)
const updateEvent = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const {
      title,
      description,
      category,
      date,
      endDate,
      location,
      capacity,
      requiresRegistration,
      registrationDeadline,
      isVirtual,
      virtualLink,
      agenda,
      speakers,
      tags,
      featured,
      published,
      ticketPrice,
      contactInfo
    } = req.body;

    // Update fields
    event.title = title || event.title;
    event.description = description || event.description;
    event.category = category || event.category;

    event.date = date ? new Date(date) : event.date;
    event.endDate = endDate ? new Date(endDate) : event.endDate;
    
    if (location) {
        event.location = {
        venue: location.venue || event.location.venue,
        address: location.address || event.location.address,
        county: location.county || event.location.county,
        constituency: location.constituency || event.location.constituency,
        coordinates: location.coordinates || event.location.coordinates
        };
    }
    
    event.capacity = capacity || event.capacity;
    event.requiresRegistration = requiresRegistration !== undefined ? requiresRegistration === 'true' : event.requiresRegistration;
    event.registrationDeadline = registrationDeadline ? new Date(registrationDeadline) : event.registrationDeadline;
    event.isVirtual = isVirtual !== undefined ? isVirtual === 'true' : event.isVirtual;
    event.virtualLink = virtualLink || event.virtualLink;
    event.agenda = agenda || event.agenda;
    event.speakers = speakers || event.speakers;
    event.tags = tags ? tags.split(',').map(tag => tag.trim()) : event.tags;
    event.featured = featured !== undefined ? featured === 'true' : event.featured;
    event.published = published !== undefined ? published === 'true' : event.published;
    event.ticketPrice = ticketPrice || event.ticketPrice;
    event.contactInfo = contactInfo || event.contactInfo;
    event.updatedAt = new Date();

    await event.save();
    await event.populate('createdBy', 'name email');

    res.json({
        success: true,
        message: 'Event updated successfully',
        data: event
    });
    } catch (error) {
    console.error('Update event error:', error);
    
    if (error.name === 'CastError') {
        return res.status(404).json({
        success: false,
        message: 'Event not found'
        });
    }
    
    res.status(500).json({
        success: false,
        message: 'Server error while updating event'
    });
    }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Admin only)
const deleteEvent = async (req, res) => {
    try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
        return res.status(404).json({
        success: false,
        message: 'Event not found'
        });
    }

    // Check if event has any associated media
    const Media = require('../models/Media');
    const mediaCount = await Media.countDocuments({ event: req.params.id });
    
    if (mediaCount > 0) {
        return res.status(400).json({
        success: false,
        message: 'Cannot delete event with associated media. Please delete media first.'
        });
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({
        success: true,
        message: 'Event deleted successfully'
    });
    } catch (error) {
    console.error('Delete event error:', error);
    
    if (error.name === 'CastError') {
        return res.status(404).json({
        success: false,
        message: 'Event not found'
        });
    }
    
    res.status(500).json({
        success: false,
        message: 'Server error while deleting event'
    });
    }
};

// @desc    Get upcoming events
// @route   GET /api/events/upcoming
// @access  Public
const getUpcomingEvents = async (req, res) => {
    try {
    const { limit = 10, category } = req.query;

    const query = {
        date: { $gte: new Date() },
        published: true
    };

    if (category && category !== 'all') {
        query.category = category;
    }

    const events = await Event.find(query)
        .sort({ date: 1 })
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .lean();

    res.json({
        success: true,
        count: events.length,
        data: events
    });
    } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({
        success: false,
        message: 'Server error while fetching upcoming events'
    });
    }
};

// @desc    Get past events
// @route   GET /api/events/past
// @access  Public
const getPastEvents = async (req, res) => {
    try {
    const { limit = 10, category } = req.query;

    const query = {
        date: { $lt: new Date() },
        published: true
    };

    if (category && category !== 'all') {
        query.category = category;
    }

    const events = await Event.find(query)
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .lean();

    res.json({
        success: true,
        count: events.length,
        data: events
    });
    } catch (error) {
    console.error('Get past events error:', error);
    res.status(500).json({
        success: false,
        message: 'Server error while fetching past events'
    });
    }
};

// @desc    Get featured events
// @route   GET /api/events/featured
// @access  Public
const getFeaturedEvents = async (req, res) => {
    try {
    const { limit = 6 } = req.query;

    const events = await Event.find({
        featured: true,
        published: true,
        date: { $gte: new Date() }
    })
        .sort({ date: 1 })
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .lean();

    res.json({
        success: true,
        count: events.length,
        data: events
    });
    } catch (error) {
    console.error('Get featured events error:', error);
    res.status(500).json({
        success: false,
        message: 'Server error while fetching featured events'
    });
    }
};

// @desc    Get event categories
// @route   GET /api/events/categories
// @access  Public
const getEventCategories = async (req, res) => {
    try {
    const categories = await Event.distinct('category', { published: true });
    
    res.json({
        success: true,
        data: categories
    });
    } catch (error) {
    console.error('Get event categories error:', error);
    res.status(500).json({
        success: false,
        message: 'Server error while fetching event categories'
    });
    }
};

// @desc    Get event stats
// @route   GET /api/events/stats
// @access  Private (Admin only)
const getEventStats = async (req, res) => {
    try {
    const today = new Date();
    
    const stats = await Event.aggregate([
        {
        $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            upcomingEvents: {
            $sum: {
                $cond: [{ $gte: ['$date', today] }, 1, 0]
            }
            },
            pastEvents: {
            $sum: {
                $cond: [{ $lt: ['$date', today] }, 1, 0]
            }
            },
            featuredEvents: {
            $sum: {
                $cond: ['$featured', 1, 0]
            }
            },
            publishedEvents: {
            $sum: {
                $cond: ['$published', 1, 0]
            }
            },
            totalViews: { $sum: '$views' }
        }
        }
    ]);

    const categoryStats = await Event.aggregate([
        {
        $match: { published: true }
        },
        {
        $group: {
            _id: '$category',
            count: { $sum: 1 }
        }
        },
        {
        $sort: { count: -1 }
        }
    ]);

    const monthlyStats = await Event.aggregate([
        {
        $match: {
            date: { $gte: new Date(today.getFullYear(), 0, 1) }
        }
        },
        {
        $group: {
            _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
            },
            count: { $sum: 1 }
        }
        },
        {
        $sort: { '_id.year': 1, '_id.month': 1 }
        }
    ]);

    res.json({
        success: true,
        data: {
        overall: stats[0] || {
            totalEvents: 0,
            upcomingEvents: 0,
            pastEvents: 0,
            featuredEvents: 0,
            publishedEvents: 0,
            totalViews: 0
        },
        byCategory: categoryStats,
        monthly: monthlyStats
        }
    });
    } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({
        success: false,
        message: 'Server error while fetching event statistics'
    });
    }
};
// ... existing code above ...

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getUpcomingEvents,
  getPastEvents,
  getFeaturedEvents,
  getEventCategories,
  getEventStats
};