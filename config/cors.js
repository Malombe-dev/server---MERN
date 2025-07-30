// server/config/cors.js - Simplest version
const cors = require('cors');

module.exports = cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173',
    'https://malombe-4jn0e8kmj-malombes-projects.vercel.app'
  ],
  credentials: true
});