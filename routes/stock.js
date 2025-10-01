const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { getDashboardSummary } = require('../controllers/stockController');

// GET /dashboard/summary
router.get('/summary', auth, checkRole('admin'), getDashboardSummary);

module.exports = router;
