const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth'); // if needed

router.get('/dashboard-summary', authMiddleware, dashboardController.getDashboardData);

module.exports = router;
