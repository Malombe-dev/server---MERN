// server/controllers/volunteerController.js
const Volunteer = require('../models/Volunteer');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const emailService = require('../utils/emailService');

// Create new volunteer registration
const createVolunteer = catchAsync(async (req, res, next) => {
  // Check if volunteer already exists
  const existingVolunteer = await Volunteer.findOne({
    $or: [
      { email: req.body.email },
      { nationalId: req.body.nationalId }
    ]
  });

  if (existingVolunteer) {
    return next(new AppError('A volunteer with this email or National ID already exists', 400));
  }

  // Create new volunteer
  const volunteer = await Volunteer.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    phone: req.body.phone,
    nationalId: req.body.nationalId,
    dateOfBirth: req.body.dateOfBirth,
    gender: req.body.gender,
    county: req.body.county,
    constituency: req.body.constituency,
    ward: req.body.ward,
    address: req.body.address,
    occupation: req.body.occupation,
    education: req.body.education,
    skills: req.body.skills || [],
    languages: req.body.languages || [],
    availability: req.body.availability || {},
    preferredActivities: req.body.preferredActivities || [],
    previousExperience: req.body.previousExperience || false,
    experienceDetails: req.body.experienceDetails,
    motivation: req.body.motivation
  });

  // Send welcome email
  try {
    await emailService.sendVolunteerWelcome(volunteer);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't fail the registration if email fails
  }

  // Remove sensitive information from response
  volunteer.nationalId = undefined;
  volunteer.phone = undefined;
  volunteer.dateOfBirth = undefined;

  res.status(201).json({
    status: 'success',
    message: 'Thank you for volunteering! We will contact you soon.',
    data: {
      volunteer
    }
  });
});

// Get all volunteers (admin only)
const getAllVolunteers = catchAsync(async (req, res, next) => {
  // Build query
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(el => delete queryObj[el]);

  // Advanced filtering
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

  let query = Volunteer.find(JSON.parse(queryStr));

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Field limiting
  if (req.query.fields) {
    const fields = req.query.fields.split(',').join(' ');
    query = query.select(fields);
  } else {
    query = query.select('-nationalId -__v');
  }

  // Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 20;
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  // Execute query
  const volunteers = await query;
  const total = await Volunteer.countDocuments(JSON.parse(queryStr));

  res.status(200).json({
    status: 'success',
    results: volunteers.length,
    totalResults: total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: {
      volunteers
    }
  });
});

// Get volunteer by ID
const getVolunteer = catchAsync(async (req, res, next) => {
  const volunteer = await Volunteer.findById(req.params.id);

  if (!volunteer) {
    return next(new AppError('No volunteer found with that ID', 404));
  }

  // Remove sensitive information for non-admin users
  if (req.user.role !== 'super-admin') {
    volunteer.nationalId = undefined;
    volunteer.phone = undefined;
    volunteer.dateOfBirth = undefined;
  }

  res.status(200).json({
    status: 'success',
    data: {
      volunteer
    }
  });
});

// Update volunteer status (admin only)
const updateVolunteerStatus = catchAsync(async (req, res, next) => {
  const { status, verificationNotes } = req.body;

  const volunteer = await Volunteer.findById(req.params.id);

  if (!volunteer) {
    return next(new AppError('No volunteer found with that ID', 404));
  }

  // Update status
  volunteer.status = status;
  
  if (status === 'approved') {
    volunteer.verified = true;
    volunteer.verificationDate = new Date();
  }

  await volunteer.save();

  // Send status update email
  try {
    await emailService.sendVolunteerStatusUpdate(volunteer, status, verificationNotes);
  } catch (error) {
    console.error('Failed to send status update email:', error);
  }

  res.status(200).json({
    status: 'success',
    message: 'Volunteer status updated successfully',
    data: {
      volunteer: {
        _id: volunteer._id,
        fullName: volunteer.fullName,
        email: volunteer.email,
        status: volunteer.status,
        verified: volunteer.verified
      }
    }
  });
});

// Get volunteer statistics
const getVolunteerStats = catchAsync(async (req, res, next) => {
  const stats = await Volunteer.aggregate([
    {
      $group: {
        _id: null,
        totalVolunteers: { $sum: 1 },
        pendingVolunteers: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        approvedVolunteers: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        activeVolunteers: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        }
      }
    }
  ]);

  // County distribution
  const countyStats = await Volunteer.aggregate([
    {
      $group: {
        _id: '$county',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ]);

  // Skills distribution
  const skillsStats = await Volunteer.aggregate([
    { $unwind: '$skills' },
    {
      $group: {
        _id: '$skills',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // Age distribution
  const ageStats = await Volunteer.aggregate([
    {
      $addFields: {
        age: {
          $subtract: [
            { $year: new Date() },
            { $year: '$dateOfBirth' }
          ]
        }
      }
    },
    {
      $bucket: {
        groupBy: '$age',
        boundaries: [18, 25, 35, 45, 55, 65, 100],
        default: 'Other',
        output: {
          count: { $sum: 1 }
        }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      overview: stats[0] || {
        totalVolunteers: 0,
        pendingVolunteers: 0,
        approvedVolunteers: 0,
        activeVolunteers: 0
      },
      countyDistribution: countyStats,
      skillsDistribution: skillsStats,
      ageDistribution: ageStats
    }
  });
});

// Search volunteers
const searchVolunteers = catchAsync(async (req, res, next) => {
  const { q, county, skills, status } = req.query;

  // Build search query
  let searchQuery = {};

  if (q) {
    searchQuery.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { occupation: { $regex: q, $options: 'i' } }
    ];
  }

  if (county) {
    searchQuery.county = county;
  }

  if (skills) {
    const skillsArray = skills.split(',');
    searchQuery.skills = { $in: skillsArray };
  }

  if (status) {
    searchQuery.status = status;
  }

  const volunteers = await Volunteer.find(searchQuery)
    .select('-nationalId -dateOfBirth -__v')
    .sort('-createdAt')
    .limit(50);

  res.status(200).json({
    status: 'success',
    results: volunteers.length,
    data: {
      volunteers
    }
  });
});

// Get volunteers by location
const getVolunteersByLocation = catchAsync(async (req, res, next) => {
  const { county, constituency, ward } = req.query;

  let locationQuery = {};
  
  if (county) locationQuery.county = county;
  if (constituency) locationQuery.constituency = constituency;
  if (ward) locationQuery.ward = ward;

  const volunteers = await Volunteer.find({
    ...locationQuery,
    status: { $in: ['approved', 'active'] }
  })
    .select('firstName lastName email county constituency ward skills availability')
    .sort('lastName firstName');

  res.status(200).json({
    status: 'success',
    results: volunteers.length,
    data: {
      volunteers
    }
  });
});

// Update volunteer activity
const updateVolunteerActivity = catchAsync(async (req, res, next) => {
  const { activityType, hoursSpent, description } = req.body;

  const volunteer = await Volunteer.findById(req.params.id);

  if (!volunteer) {
    return next(new AppError('No volunteer found with that ID', 404));
  }

  // Update activity counters
  volunteer.activitiesCompleted += 1;
  volunteer.hoursContributed += hoursSpent || 0;
  volunteer.lastActive = new Date();

  await volunteer.save();

  // Log activity (in a real app, you'd have an Activity model)
  console.log(`Activity logged for ${volunteer.fullName}: ${activityType} - ${hoursSpent}h`);

  res.status(200).json({
    status: 'success',
    message: 'Volunteer activity updated successfully',
    data: {
      volunteer: {
        _id: volunteer._id,
        fullName: volunteer.fullName,
        activitiesCompleted: volunteer.activitiesCompleted,
        hoursContributed: volunteer.hoursContributed
      }
    }
  });
});

// Delete volunteer (admin only)
const deleteVolunteer = catchAsync(async (req, res, next) => {
  const volunteer = await Volunteer.findByIdAndDelete(req.params.id);

  if (!volunteer) {
    return next(new AppError('No volunteer found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Export volunteer data (admin only)
const exportVolunteers = catchAsync(async (req, res, next) => {
  const { format = 'json', county, status } = req.query;

  let query = {};
  if (county) query.county = county;
  if (status) query.status = status;

  const volunteers = await Volunteer.find(query)
    .select('-nationalId -__v')
    .sort('county constituency ward lastName firstName');

  if (format === 'csv') {
    // Convert to CSV format
    const csvHeader = 'Name,Email,Phone,County,Constituency,Ward,Skills,Status,Join Date\n';
    const csvData = volunteers.map(v => 
      `"${v.fullName}","${v.email}","${v.phone}","${v.county}","${v.constituency}","${v.ward}","${v.skills.join(';')}","${v.status}","${v.joinDate}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=volunteers.csv');
    res.send(csvHeader + csvData);
  } else {
    res.status(200).json({
      status: 'success',
      results: volunteers.length,
      data: {
        volunteers
      }
    });
  }
});

module.exports = {
  createVolunteer,
  getAllVolunteers,
  getVolunteer,
  updateVolunteerStatus,
  getVolunteerStats,
  searchVolunteers,
  getVolunteersByLocation,
  updateVolunteerActivity,
  deleteVolunteer,
  exportVolunteers
};