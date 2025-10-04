const Request = require('../model/Request');
const Item = require('../model/item');
const User = require('../model/user');
const Stock = require('../model/Stock');
const sendEmail = require('../utils/sendEmail');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
// Generate token like: REQ-2025-00001
const generateToken = (id) => {
  return `REQ-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
};


exports.createRequest = async (req, res) => {
  try {
    const { itemName, quantity, requiredDate, priority,Decofitem } = req.body;

    if (!itemName || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Item name and valid quantity are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const request = new Request({
      user: user._id,
      itemName,
      quantity,
      requiredDate,
      Decofitem,
      priority: priority || 'Medium',
      deliveryAddress: user.location
    });

    const saved = await request.save();

    res.status(201).json({ message: 'Request submitted', request: saved });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit request', error: err.message });
  }
};


exports.getAllRequests = async (req, res) => {
  try {
  
    let requests;
    if (req.user.role === 'admin') {
      requests = await Request.find()
        .populate('user', 'name email branch')
        // .populate('item', 'name');
    } else {
      requests = await Request.find({ user: req.user.userId })
        .populate('item', 'name');
    }
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching requests', error: err.message });
  }
};


exports.approveRequest = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can approve requests' });
    }

    const request = await Request.findById(req.params.id).populate('user');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'requested') return res.status(400).json({ message: 'Already processed' });

    request.status = 'approved';
    request.timestamps.approved = new Date();
    request.token = `REQ-${new Date().getFullYear()}-${String(request._id).slice(-5).toUpperCase()}`;
    await request.save();

    console.log('➡ Approving request and sending email...');

    // await sendEmail(
    //   request.user.email,
    //   `✅ Request Approved: ${request.token}`,
    //   `Hello ${request.user.name},\n\nYour request for item "${request.itemName}" has been approved.\n\nToken: ${request.token}\n\nThank you!`
    // );

    console.log('✅ Email sent via Nodemailer (Gmail)');

    res.json({ message: 'Request approved and email sent', request });

  } catch (err) {
    console.error('❌ Approval or Email failed:', err.message);
    res.status(500).json({ message: 'Approval failed', error: err.message });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ message: 'Only admin can reject requests' });

    const request = await Request.findById(req.params.id).populate('user');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'requested') return res.status(400).json({ message: 'Already processed' });

    const { reason } = req.body;

    request.status = 'rejected';
    request.rejectionReason = reason || 'No reason provided';
    await request.save();

    // await sendEmail(
    //   request.user.email,
    //   `Request Rejected`,
    //   `Hello ${request.user.name},\n\nYour request for item "${request.item.name}" has been rejected.\nReason: ${request.rejectionReason}\n\nThank you!`
    // );

    res.json({ message: 'Request rejected and email sent', request });
  } catch (err) {
    res.status(500).json({ message: 'Rejection failed', error: err.message });
  }
};
exports.dispatchRequest = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can dispatch' });
    }

    // 🔍 Find request
    const request = await Request.findById(req.params.id).populate('user', 'name email');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.status !== 'approved') {
      return res.status(400).json({ message: 'Request is not approved yet' });
    }

    const { quantity, itemName } = request;

    // 🔍 Get admin user (dispatcher)
    const adminUser = await User.findById(req.user.id);
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    // 🔍 Find item by normalized name
   const normalizedItemName = itemName.trim().toLowerCase();
const item = await Item.findOne({ name: normalizedItemName });

    if (!item) {
      return res.status(400).json({ message: `Item "${itemName}" not found` });
    }

    // 🔍 Check if admin has stock
    const adminStock = await Stock.findOne({
      item: item._id,
      ownerId: adminUser._id,
      ownerType: 'admin'
    });

    if (!adminStock) {
      return res.status(404).json({ message: `Admin stock not found for item: ${itemName}` });
    }

    if (adminStock.quantity < quantity) {
      return res.status(400).json({
        message: `Insufficient stock. Available: ${adminStock.quantity}, Required: ${quantity}`
      });
    }

    // ✅ Deduct quantity from admin
    adminStock.quantity -= quantity;
    await adminStock.save();

    // ✅ Add to user's stock
    let userStock = await Stock.findOne({
      item: item._id,
      ownerId: request.user._id,
      ownerType: 'user'
    });
if (userStock) {
  userStock.quantity += quantity;
} else {
  userStock = new Stock({
    item: item._id,
    quantity,
    rate: adminStock.rate,
    branch: adminStock.branch,  // ✅ IMPORTANT
    ownerId: request.user._id,
    ownerType: 'user'
  });
}


    await userStock.save();

    // ✅ Update request status
    request.status = 'dispatched';
    request.timestamps = request.timestamps || {};
    request.timestamps.dispatched = new Date();
    await request.save();

    return res.status(200).json({
      message: 'Request dispatched successfully',
      adminRemainingStock: adminStock.quantity,
      userTotalStock: userStock.quantity,
      request
    });

  } catch (err) {
    console.error('❌ Dispatch error:', err);
    return res.status(500).json({ message: 'Dispatch failed', error: err.message });
  }
};

// controllers/requestController.js

exports.getDispatchCount = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // 🔹 Count all requests with status 'dispatched'
    const dispatchCount = await Request.countDocuments({ status: 'dispatched' });

    res.status(200).json({
      message: 'Total number of dispatched requests',
      totalDispatched: dispatchCount
    });

  } catch (err) {
    console.error('❌ Error fetching dispatch count:', err);
    res.status(500).json({ message: 'Failed to fetch dispatch count', error: err.message });
  }
};


exports.getDispatchSummary = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // 🔹 Count all dispatched requests
    const dispatchedRequests = await Request.find({ status: 'dispatched' })
      .populate('user', 'name email branch') // user details
      .lean(); 

    const totalDispatched = dispatchedRequests.length;

    // 🔹 Map details for response
    const dispatchDetails = dispatchedRequests.map(req => ({
      requestId: req._id,
      token: req.token || null,
      itemName: req.itemName,
      quantity: req.quantity,
      priority: req.priority,
      requestedBy: req.user?.name || 'Unknown',
      userEmail: req.user?.email || '-',
      branch: req.user?.branch || '-',
      dispatchedAt: req.timestamps?.dispatched || null
    }));

    res.status(200).json({
      message: 'Dispatched requests summary',
      totalDispatched,
      dispatchDetails
    });

  } catch (err) {
    console.error('❌ Error fetching dispatch summary:', err);
    res.status(500).json({ message: 'Failed to fetch dispatch summary', error: err.message });
  }
};




exports.getDispatchSummaryPDF = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Fetch all stock with items and owners
    const stocks = await Stock.find()
      .populate('item')
      .populate('ownerId', 'name branch')
      .lean();

    if (!stocks.length) {
      return res.status(200).json({ message: 'No stock available' });
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const fileName = `StockSummary_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Header
    doc.fontSize(16).text('STORE STOCK RECORD', { align: 'center' });
    doc.fontSize(14).text(`Branch: All Branches`, { align: 'center' });
    doc.fontSize(12).text(`Generated On: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Table header
    doc.fontSize(10);
    const tableTop = doc.y;
    const itemX = 50;
    const quantityX = 300;
    const rateX = 370;
    const valueX = 440;
    const ownerX = 510;

    doc.text('Particulars', itemX, tableTop);
    doc.text('Quantity', quantityX, tableTop);
    doc.text('Rate', rateX, tableTop);
    doc.text('Value', valueX, tableTop);
    doc.text('Branch / Owner', ownerX, tableTop);
    doc.moveDown();

    // Draw line
    doc.moveTo(itemX, doc.y).lineTo(550, doc.y).stroke();

    // Table rows
    stocks.forEach(stock => {
      const y = doc.y + 5;

      // Safe fallback for undefined values
      const quantity = typeof stock.quantity === 'number' ? stock.quantity : 0;
      const rate = typeof stock.rate === 'number' ? stock.rate : 0;
      const value = typeof stock.value === 'number' ? stock.value : quantity * rate;

      doc.text(stock.item?.name || 'Unknown', itemX, y, { width: 240 });
      doc.text(`${quantity}`, quantityX, y);
      doc.text(`${rate.toFixed(2)}`, rateX, y);
      doc.text(`${value.toFixed(2)}`, valueX, y);
      doc.text(`${stock.branch || 'N/A'} / ${stock.ownerId?.name || 'Unknown'}`, ownerX, y);
      doc.moveDown();
    });

    doc.end();

    // Wait for PDF to finish
    writeStream.on('finish', () => {
      res.download(filePath, fileName, err => {
        if (err) console.error('❌ PDF download error:', err);
        fs.unlink(filePath, () => {}); // optional: delete temp file
      });
    });

  } catch (err) {
    console.error('❌ Error generating stock PDF:', err);
    res.status(500).json({ message: 'Failed to generate stock PDF', error: err.message });
  }
};
