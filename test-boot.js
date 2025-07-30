require('dotenv').config();
const express = require('express');
const app = express();

// Import ONLY the route files one-by-one
const contactRoutes   = require('./routes/contact');
const eventRoutes     = require('./routes/events');
const mediaRoutes     = require('./routes/media');
const pressRoutes     = require('./routes/press');
const volunteerRoutes = require('./routes/volunteers');

app.use('/api/contact',   contactRoutes);
app.use('/api/events',    eventRoutes);
app.use('/api/media',     mediaRoutes);
app.use('/api/press',     pressRoutes);
app.use('/api/volunteers',volunteerRoutes);

app.listen(4000, () => console.log('Test server on :4000'));
