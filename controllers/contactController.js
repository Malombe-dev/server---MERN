const Contact = require('../models/Contact');
const Newsletter = require('../models/Newsletter');
const { validationResult } = require('express-validator');
const emailService = require('../utils/emailService');

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Public
const submitContact = async (req, res) => {
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
      name,
      email,
      phone,
      subject,
      message,
      category,
      county,
      constituency,
      priority
    } = req.body;

    // Create contact record
    const contact = new Contact({
      name,
      email,
      phone: phone || '',
      subject,
      message,
      category: category || 'general',
      location: {
        county: county || '',
        constituency: constituency || ''
      },
      priority: priority || 'normal',
      source: 'website',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await contact.save();

    // Send confirmation email to user
    try {
      await emailService.sendContactConfirmation({
        to: email,
        name,
        subject,
        category
      });
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Send notification email to admin
    try {
      await emailService.sendContactNotification({
        contact: {
          id: contact._id,
          name,
          email,
          phone,
          subject,
          message,
          category,
          priority
        }
      });
    } catch (emailError) {
      console.error('Error sending admin notification:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.',
      data: {
        id: contact._id,
        name: contact.name,
        subject: contact.subject,
        category: contact.category,
        submittedAt: contact.createdAt
      }
    });
  } catch (error) {
    console.error('Submit contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting your message. Please try again.'
    });
  }
};

// @desc    Get all contact messages
// @route   GET /api/contact
// @access  Private (Admin only)
const getAllContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      priority,
      status,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Contact.countDocuments(query);
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = order === 'desc' ? -1 : 1;
    
    // Fetch contacts
    const contacts = await Contact.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('replies.repliedBy', 'name email')
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: contacts,
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
    console.error('Get all contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contact messages'
    });
  }
};

// @desc    Get single contact message
// @route   GET /api/contact/:id
// @access  Private (Admin only)
const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('replies.repliedBy', 'name email role')
      .lean();

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('Get contact by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contact message'
    });
  }
};

// @desc    Mark contact as read
// @route   PATCH /api/contact/:id/read
// @access  Private (Admin only)
const markAsRead = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    if (!contact.read) {
      contact.read = true;
      contact.readAt = new Date();
      contact.readBy = req.user.id;
      await contact.save();
    }

    res.json({
      success: true,
      message: 'Contact message marked as read',
      data: { read: contact.read, readAt: contact.readAt }
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating contact message'
    });
  }
};

// @desc    Reply to contact message
// @route   POST /api/contact/:id/reply
// @access  Private (Admin only)
const replyToContact = async (req, res) => {
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

    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    const { message, sendEmail = true } = req.body;

    // Add reply to contact
    const reply = {
      message,
      repliedBy: req.user.id,
      repliedAt: new Date()
    };

    contact.replies.push(reply);
    contact.status = 'replied';
    contact.lastReplyAt = new Date();
    
    // Mark as read if not already
    if (!contact.read) {
      contact.read = true;
      contact.readAt = new Date();
      contact.readBy = req.user.id;
    }

    await contact.save();
    await contact.populate('replies.repliedBy', 'name email');

    // Send email reply if requested
    if (sendEmail) {
      try {
        await emailService.sendContactReply({
          to: contact.email,
          name: contact.name,
          originalSubject: contact.subject,
          replyMessage: message,
          repliedBy: req.user.name
        });
      } catch (emailError) {
        console.error('Error sending reply email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      success: true,
      message: 'Reply sent successfully',
      data: contact
    });
  } catch (error) {
    console.error('Reply to contact error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while sending reply'
    });
  }
};

// @desc    Update contact status
// @route   PATCH /api/contact/:id/status
// @access  Private (Admin only)
const updateContactStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['new', 'in-progress', 'replied', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    contact.status = status;
    contact.updatedAt = new Date();
    
    // Set resolved/closed dates
    if (status === 'resolved' && !contact.resolvedAt) {
      contact.resolvedAt = new Date();
      contact.resolvedBy = req.user.id;
    } else if (status === 'closed' && !contact.closedAt) {
      contact.closedAt = new Date();
      contact.closedBy = req.user.id;
    }

    await contact.save();

    res.json({
      success: true,
      message: `Contact status updated to ${status}`,
      data: { status: contact.status }
    });
  } catch (error) {
    console.error('Update contact status error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating contact status'
    });
  }
};

// @desc    Delete contact message
// @route   DELETE /api/contact/:id
// @access  Private (Admin only)
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    await Contact.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Contact message deleted successfully'
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting contact message'
    });
  }
};

// @desc    Get unread messages count
// @route   GET /api/contact/unread/count
// @access  Private (Admin only)
const getUnreadCount = async (req, res) => {
  try {
    const count = await Contact.countDocuments({ read: false });

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread count'
    });
  }
};

// @desc    Search contact messages
// @route   GET /api/contact/search
// @access  Private (Admin only)
const searchContacts = async (req, res) => {
  try {
    const {
      search,
      category,
      priority,
      status,
      page = 1,
      limit = 20
    } = req.query;

    if (!search) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }

    // Build search query
    const query = {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ]
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Contact.countDocuments(query);

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: contacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Search contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching contact messages'
    });
  }
};

// @desc    Get contact statistics
// @route   GET /api/contact/stats
// @access  Private (Admin only)
const getContactStats = async (req, res) => {
  try {
    const totalContacts = await Contact.countDocuments();
    const unreadContacts = await Contact.countDocuments({ read: false });
    const newContacts = await Contact.countDocuments({ status: 'new' });
    const resolvedContacts = await Contact.countDocuments({ status: 'resolved' });

    // Get contacts by category
    const categoryCounts = await Contact.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get contacts by priority
    const priorityCounts = await Contact.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get contacts by status
    const statusCounts = await Contact.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get daily contact counts for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await Contact.aggregate([
      { 
        $match: { 
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Get response time averages
    const responseTimeStats = await Contact.aggregate([
      { 
        $match: { 
          status: 'replied',
          lastReplyAt: { $exists: true }
        }
      },
      {
        $project: {
          responseTime: {
            $divide: [
              { $subtract: ['$lastReplyAt', '$createdAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          total: totalContacts,
          unread: unreadContacts,
          new: newContacts,
          resolved: resolvedContacts
        },
        categories: categoryCounts,
        priorities: priorityCounts,
        statuses: statusCounts,
        dailyStats,
        responseTime: responseTimeStats[0] || {
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0
        }
      }
    });
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contact statistics'
    });
  }
};

// @desc    Subscribe to newsletter
// @route   POST /api/newsletter
// @access  Public
const subscribeNewsletter = async (req, res) => {
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

    const { email, name, preferences } = req.body;

    // Check if already subscribed
    const existingSubscription = await Newsletter.findOne({ email });
    
    if (existingSubscription) {
      if (existingSubscription.subscribed) {
        return res.status(400).json({
          success: false,
          message: 'This email is already subscribed to our newsletter'
        });
      } else {
        // Resubscribe if previously unsubscribed
        existingSubscription.subscribed = true;
        existingSubscription.subscribedAt = new Date();
        existingSubscription.unsubscribedAt = null;
        existingSubscription.preferences = preferences || existingSubscription.preferences;
        await existingSubscription.save();

        return res.json({
          success: true,
          message: 'Successfully resubscribed to our newsletter!'
        });
      }
    }

    // Create new subscription
    const subscription = new Newsletter({
      email,
      name: name || '',
      preferences: preferences || {
        campaignUpdates: true,
        eventNotifications: true,
        policyUpdates: true,
        pressReleases: false
      },
      source: 'website',
      ipAddress: req.ip
    });

    await subscription.save();

    // Send welcome email
    try {
      await emailService.sendNewsletterWelcome({
        to: email,
        name: name || 'Supporter'
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to our newsletter!'
    });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while subscribing to newsletter'
    });
  }
};

// @desc    Unsubscribe from newsletter
// @route   POST /api/newsletter/unsubscribe
// @access  Public
const unsubscribeNewsletter = async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const subscription = await Newsletter.findOne({ email });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Email not found in our newsletter list'
      });
    }

    // TODO: Verify unsubscribe token if provided
    // For now, allow unsubscribe without token verification

    subscription.subscribed = false;
    subscription.unsubscribedAt = new Date();
    await subscription.save();

    res.json({
      success: true,
      message: 'Successfully unsubscribed from our newsletter'
    });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while unsubscribing from newsletter'
    });
  }
};

module.exports = {
  submitContact,
  getAllContacts,
  getContactById,
  updateContactStatus,
  deleteContact,
  replyToContact,
  getContactStats,
  getUnreadCount,
  subscribeNewsletter
};