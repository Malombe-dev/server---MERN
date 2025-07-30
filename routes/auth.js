// server/routes/auth.js   (or inside server/routes/index.js)
const express = require('express');
const { login } = require('../middleware/auth');
const router  = express.Router();

router.post('/login', login);   // <-- this line
module.exports = router;