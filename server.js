// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
require('dotenv').config();

const connectDB = require('./config/database');
const { globalErrorHandler, notFound } = require('./middleware/errorHandler');

// Import route files
const volunteerRoutes = require('./routes/volunteers');
const pressRoutes     = require('./routes/press');
const mediaRoutes     = require('./routes/media');
const contactRoutes   = require('./routes/contact');
const eventRoutes     = require('./routes/events');
const authRoutes      = require('./routes/auth'); // ← NEW: /api/auth/** routes

const app = express();
connectDB();

/* ───────────────────────────────────────────────
   1️⃣  ESSENTIAL BODY PARSERS (fixes 500 “req.body undefined”)
───────────────────────────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ───────────────────────────────────────────────
   2️⃣  SECURITY / PERFORMANCE MIDDLEWARE
───────────────────────────────────────────────── */
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      scriptSrc: ["'self'"],
      mediaSrc: ["'self'", "https://res.cloudinary.com"],
    },
  },
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use(mongoSanitize());
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://localhost:5000',
    'https://malombe-4jn0e8kmj-malombes-projects.vercel.app',
    'https://server-mern-zc6l.onrender.com',
    'https://malombe-mupsvlud3-malombes-projects.vercel.app'
     ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(compression());
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

/* ───────────────────────────────────────────────
   3️⃣  ROUTES
───────────────────────────────────────────────── */
app.use('/api/auth',    authRoutes);      //  /api/auth/login
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/press',       pressRoutes);
app.use('/api/media',       mediaRoutes);
app.use('/api/contact',     contactRoutes);
app.use('/api/events',      eventRoutes);

// Health & status endpoints
app.get('/health', (req, res) =>
  res.status(200).json({ success: true, message: 'Server is healthy', timestamp: new Date().toISOString() })
);
app.get('/api/status', (req, res) =>
  res.status(200).json({ success: true, message: '2027 Campaign API running', slogan: 'Reset. Restore. Rebuild.' })
);

/* ───────────────────────────────────────────────
   4️⃣  404 & GLOBAL ERROR HANDLER
───────────────────────────────────────────────── */
app.use('/api/*', notFound);
app.use(globalErrorHandler);

/* ───────────────────────────────────────────────
   5️⃣  START SERVER
───────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`
🚀 2027 Campaign Server ready!
📍 Environment: ${process.env.NODE_ENV}
🌐 Port: ${PORT}
🎯 Slogan: Reset. Restore. Rebuild.
  `)
);
/* ⏱️  Allow long uploads (10 min) */
server.timeout = 10 * 60 * 1000;   // 600 000 ms
module.exports = app;