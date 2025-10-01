const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { getDashboardSummary,getAdminStockSummary,getUserStockSummary,createOrUpdateStock,getAllUsers } = require('../controllers/stockController');

// GET /dashboard/summary
router.get('/stock-summary', auth,checkRole('admin'), getAdminStockSummary);
router.post('/stock-add', auth,checkRole('admin'), createOrUpdateStock);
router.get('/stock-user-summary', auth,checkRole('admin'), getUserStockSummary);
router.get('/get-user', auth,checkRole('admin'), getAllUsers);
module.exports = router;
