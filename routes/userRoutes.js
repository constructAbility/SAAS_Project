// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');  // ✅ your existing auth
const { getProfile } = require('../controllers/userController');

router.get('/profile', auth, getProfile);

module.exports = router;
