// server/config/cors.js - Simplest version
const cors = require('cors');

module.exports = cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173',
    'https://malombe-iq37fl8pc-malombes-projects.vercel.app',
    'https://malombe.vercel.app'
  ],
  credentials: true
});