const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const Item = require('../model/item'); // <- make sure this import was missing

const {
  createRequest,
  getAllRequests,
  approveRequest,
  rejectRequest,
  dispatchRequest,
  getDispatchCount,
  getDispatchSummary,
  getDispatchSummaryPDF,
  getOrderStatusReport,
  addSale,
  getSales,
  downloadSalesPdf,
  getInvoice,
  uploadInvoice,
   getMyRequests
} = require('../controllers/requestController');


// 🟢 USER ROUTES
router.post('/R-M', auth, checkRole('user'), createRequest);
router.post('/add-sales', auth, checkRole('user'), addSale);
router.get('/orders/status-report', auth, checkRole('user'), getOrderStatusReport);
router.get('/get-sales', auth, checkRole('user'), getSales);
router.get('/get-sales-pdf', auth, checkRole('user'), downloadSalesPdf);


// 🟢 ADMIN ROUTES
router.get('/R-Me', auth, checkRole('admin'), getAllRequests);
router.put('/:id/approve', auth, checkRole('admin'), approveRequest);
router.put('/:id/reject', auth, checkRole('admin'), rejectRequest);
router.put('/:id/dispatch', auth, checkRole('admin'), dispatchRequest);
router.get('/sales', auth, checkRole('admin'), getDispatchCount);
router.get('/sales-summary', auth, checkRole('admin'), getDispatchSummary);
router.get('/sales-summary-pdf', auth, checkRole('admin'), getDispatchSummaryPDF);
router.post('/requests/:id/upload-invoice', auth, checkRole('admin'), uploadInvoice);

router.get('/requests/my', auth, checkRole('user'), getMyRequests);

// 🟢 INVOICE ROUTES (for both admin & user)
// ✅ If user/admin wants a specific request’s invoice:
router.get('/requests/:id/invoice', auth, getInvoice);

// ✅ If user/admin wants their latest invoice automatically:
router.get('/requests/invoice', auth, getInvoice);

router.get('/requests/:id/invoice', auth, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;

    const request = await Request.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // If user, check ownership
    if (userRole === 'user' && request.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!request.invoiceFile) {
      return res.status(404).json({ message: 'Invoice file missing on server.' });
    }

    // Send invoice file logic here...
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});




module.exports = router;
