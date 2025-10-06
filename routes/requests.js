const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const {
 createRequest,
 getAllRequests,
//   getMyRequests,
  approveRequest,
  rejectRequest,
   dispatchRequest,getDispatchCount,getDispatchSummary,getDispatchSummaryPDF,getOrderStatusReport,addSale,getSales,downloadSalesPdf 
} = require('../controllers/requestController');

// 🟢 USER ROUTES
router.post('/R-M', auth, checkRole('user'), createRequest);
// router.get('/my', auth, checkRole('user'), getMyRequests);

// 🔴 ADMIN ROUTES
router.get('/R-Me', auth, checkRole('admin'), getAllRequests);
router.put('/:id/approve', auth, checkRole('admin'), approveRequest);
router.put('/:id/reject', auth, checkRole('admin'), rejectRequest);
router.put('/:id/dispatch', auth, checkRole('admin'), dispatchRequest);
router.get('/sales',auth, checkRole('admin'),getDispatchCount)
router.get('/sales-summary',auth, checkRole('admin'),getDispatchSummary)
router.get('/sales-summary-pdf',auth, checkRole('admin'),getDispatchSummaryPDF)
router.post('/add-sales',auth,checkRole('user'),addSale)

router.get('/orders/status-report',auth, checkRole('user'),getOrderStatusReport)
router.get('/get-sales',auth,checkRole('user'),getSales)
router.get('/get-sales-pdf',auth,checkRole('user'),downloadSalesPdf )
// GET /items/user-stock
router.get('/items/user-stock', auth, async (req, res) => {
  try {
    const userBranch = req.user.branch;
    // Find all items with stock entry for user's branch
    const items = await Item.find({
      'stock.branch': userBranch
    }).select('name description stock');


    const filteredItems = items.map(item => {
      const userStock = item.stock.find(s => s.branch === userBranch);
      return {
        _id: item._id,
        name: item.name,
        description: item.description,
        quantity: userStock ? userStock.quantity : 0
      };
    });

    res.json(filteredItems);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user stock', error: err.message });
  }
});

module.exports = router;
