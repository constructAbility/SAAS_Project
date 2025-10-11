const Request = require('../model/Request');
const Item = require('../model/item');
const User = require('../model/user');
const Stock = require('../model/Stock');
const sendEmail = require('../utils/sendEmail');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Sale = require('../model/sales')

const multer = require('multer');


// Create upload directory if not exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'invoices');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `invoice_${req.params.id}_${Date.now()}${ext}`);
  }
});

// Filter only PDFs or images (if needed)
const fileFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only PDF, JPG, or PNG files are allowed'), false);
};

// Multer upload middleware (expecting field name "invoice")
const upload = multer({ storage, fileFilter });


exports.uploadInvoice = [
  upload.single('invoice'), // 👈 the field name must be 'invoice'
  async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admin can upload invoices' });
      }

      const request = await Request.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ message: 'Request not found' });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({ message: 'Invoice can only be uploaded after approval' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Use field name "invoice".' });
      }

      // Save invoice info
      request.invoice = {
        filePath: `/uploads/invoices/${req.file.filename}`,
        fileType: req.file.mimetype.includes('pdf') ? 'pdf' : 'image',
        uploadedBy: req.user._id,
      };

      request.status = 'invoice_uploaded';
      request.timestamps = request.timestamps || {};
      request.timestamps.invoiceUploaded = new Date();

      await request.save();

      res.status(200).json({
        message: 'Invoice uploaded successfully',
        invoicePath: request.invoice.filePath,
      });
    } catch (err) {
      console.error('❌ Upload Invoice Error:', err);
      res.status(500).json({ message: 'Failed to upload invoice', error: err.message });
    }
  }
];


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

    // if (request.status !== 'approved') {
    //   return res.status(400).json({ message: 'Request is not approved yet' });
    // }

    if (request.status !== 'invoice_uploaded') {
      return res.status(400).json({ message: 'Cannot dispatch. Invoice not uploaded yet.' });
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
      .populate('item', 'name rate')          // item details including rate/price
      .lean(); 

    const totalDispatched = dispatchedRequests.length;

    // 🔹 Map details for response
    const dispatchDetails = dispatchedRequests.map(req => {
      const quantity = typeof req.quantity === 'number' ? req.quantity : 0;
      const rate = typeof req.item?.rate === 'number' ? req.item.rate : 0;
      const value = quantity * rate;

      return {
        requestId: req._id,
        token: req.token || null,
        itemName: req.itemName || req.item?.name || 'Unknown',
        quantity,
        rate: rate.toFixed(2),
        value: value.toFixed(2),
        priority: req.priority,
        requestedBy: req.user?.name || 'Unknown',
        userEmail: req.user?.email || '-',
        branch: req.user?.branch || '-',
        dispatchedAt: req.timestamps?.dispatched || null
      };
    });

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


// make sure path is correct

exports.getDispatchSummaryPDF = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Fetch all dispatched requests with item and user info
    const dispatchedRequests = await Request.find({ status: 'dispatched' })
      .populate('item', 'name')      
      .populate('user', 'name branch') // get user info
      .lean();

    if (!dispatchedRequests.length) {
      return res.status(200).json({ message: 'No dispatched records available' });
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const fileName = `DispatchSummary_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Header
    doc.fontSize(16).text('DISPATCH SUMMARY REPORT', { align: 'center' });
    doc.fontSize(14).text(`Branch: All Branches`, { align: 'center' });
    doc.fontSize(12).text(`Generated On: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Table header
    doc.fontSize(10);
    const tableTop = doc.y;
    const itemX = 30;
    const qtyX = 150;
    const rateX = 200;
    const valueX = 260;
    const toX = 320;
    const branchX = 430;
    const issuedByX = 500;
    const dateX = 570;

    doc.text('Item', itemX, tableTop);
    doc.text('Qty', qtyX, tableTop);
    doc.text('Rate', rateX, tableTop);
    doc.text('Value', valueX, tableTop);
    doc.text('Dispatched To', toX, tableTop);
    doc.text('Branch', branchX, tableTop);
    doc.text('Requested By', issuedByX, tableTop);
    doc.text('Date', dateX, tableTop);
    doc.moveDown();

    // Draw line
    doc.moveTo(itemX, doc.y).lineTo(600, doc.y).stroke();

    for (const record of dispatchedRequests) {
      const y = doc.y + 5;
      const quantity = typeof record.quantity === 'number' ? record.quantity : 0;

      // 🔹 Fetch stock info for this item & branch
      const stock = await Stock.findOne({ item: record.item?._id, branch: record.user?.branch }).lean();
      const rate = stock?.rate || 0;
      const value = stock?.value || quantity * rate;

      const itemName = record.item?.name || record.itemName || 'Unknown';
      const requestedBy = record.user?.name || 'Unknown';
      const branch = record.user?.branch || '-';
      const date = record.timestamps?.dispatched
        ? new Date(record.timestamps.dispatched).toLocaleDateString()
        : 'N/A';

      doc.text(itemName, itemX, y, { width: 120 });
      doc.text(quantity, qtyX, y);
      doc.text(rate.toFixed(2), rateX, y);
      doc.text(value.toFixed(2), valueX, y);
      doc.text(record.token || '-', toX, y, { width: 100 });
      doc.text(branch, branchX, y, { width: 60 });
      doc.text(requestedBy, issuedByX, y, { width: 60 });
      doc.text(date, dateX, y);
      doc.moveDown();
    }

    doc.end();

    // Wait for PDF to finish
    writeStream.on('finish', () => {
      res.download(filePath, fileName, err => {
        if (err) console.error('❌ PDF download error:', err);
        fs.unlink(filePath, () => {}); // optional cleanup
      });
    });

  } catch (err) {
    console.error('❌ Error generating dispatch PDF:', err);
    res.status(500).json({ message: 'Failed to generate dispatch PDF', error: err.message });
  }
};

exports.getOrderStatusReport = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const requests = await Request.find()
      .populate('user', 'name branch')
      .lean();

    const reportData = requests.map(req => ({
      requestId: req._id,
      token: req.token || 'Not Assigned',
      itemName: req.itemName,
      quantity: req.quantity,
      requestedBy: req.user?.name || 'Unknown',
      branch: req.user?.branch || '-',
      status: req.status, // requested / approved / dispatched / rejected
      requestedAt: req.createdAt ? new Date(req.createdAt).toLocaleString() : '-',
      approvedAt: req.timestamps?.approved ? new Date(req.timestamps.approved).toLocaleString() : '-',
      dispatchedAt: req.timestamps?.dispatched ? new Date(req.timestamps.dispatched).toLocaleString() : '-',
      rejectedAt: req.rejectionReason ? (req.timestamps?.rejected || 'N/A') : '-',
      rejectionReason: req.rejectionReason || '-'
    }));

    res.status(200).json({
      message: "Order Status Report",
      total: reportData.length,
      report: reportData
    });

  } catch (err) {
    console.error('❌ Error in Order Status Report:', err);
    res.status(500).json({ message: 'Failed to fetch order status report', error: err.message });
  }
};


exports.addSale = async (req, res) => {
  try {
    const { customerName, customerEmail, customerAddress, item, quantity, price } = req.body;

   
    const userStock = await Stock.findOne({
      item,
      ownerId: req.user.id,
      ownerType: 'user'
    });

    if (!userStock || userStock.quantity < quantity) {
      return res.status(400).json({ message: `Insufficient stock. Available: ${userStock?.quantity || 0}` });
    }

    
    const sale = new Sale({
      userId: req.user.id,
      customerName,
      customerEmail,
      customerAddress,
      item,
      quantity,
      price
    });
    await sale.save();


    userStock.quantity -= quantity;
    await userStock.save();

    res.status(201).json({
      message: 'Sale added successfully & stock updated',
      sale,
      remainingStock: userStock.quantity
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to add sale', error: err.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.find({ userId: req.user.id })
      .populate('item') // Optional: to show item details
      .sort({ saleDate: -1 }); // Latest first

    res.status(200).json({
      
      message: 'Sales fetched successfully',
      count: sales.length,
      sales
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sales', error: err.message });
  }
};


exports.downloadSalesPdf = async (req, res) => {
  try {
    const sales = await Sale.find({ userId: req.user.id }).populate('item');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');

    doc.pipe(res);

    // Title
    doc.font('Helvetica-Bold').fontSize(18).text('Sales Report', { align: 'center' });
    doc.moveDown();

    doc.font('Helvetica').fontSize(10).fillColor('#444')
      .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.moveDown();

    // Define column widths
    const columnWidths = {
      customer: 100,
      item: 100,
      qty: 40,
      price: 60,
      total: 70,   // wider to make room
      gap: 20,     // spacing between total and date
      date: 100
    };

    const startX = 40;
    const tableTop = doc.y + 10;

    // Calculate column X positions
    const customerX = startX;
    const itemX = customerX + columnWidths.customer;
    const qtyX = itemX + columnWidths.item;
    const priceX = qtyX + columnWidths.qty;
    const totalX = priceX + columnWidths.price;
    const dateX = totalX + columnWidths.total + columnWidths.gap;

    // Table header
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000');
    doc.text('Customer', customerX, tableTop, { width: columnWidths.customer });
    doc.text('Item', itemX, tableTop, { width: columnWidths.item });
    doc.text('Qty', qtyX, tableTop, { width: columnWidths.qty, align: 'right' });
    doc.text('Price', priceX, tableTop, { width: columnWidths.price, align: 'right' });
    doc.text('Total', totalX, tableTop, { width: columnWidths.total, align: 'right' });
    doc.text('Date', dateX, tableTop, { width: columnWidths.date });
    doc.moveTo(startX, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    doc.font('Helvetica').fontSize(11).fillColor('#000');
    let y = tableTop + 25;
    let grandTotal = 0;

    sales.forEach((sale) => {
      doc.text(sale.customerName, customerX, y, { width: columnWidths.customer });
      doc.text(sale.item?.name || 'N/A', itemX, y, { width: columnWidths.item });
      doc.text(sale.quantity.toString(), qtyX, y, { width: columnWidths.qty, align: 'right' });
      doc.text(`${sale.price.toFixed(2)}`, priceX, y, { width: columnWidths.price, align: 'right' });
      doc.text(`${sale.totalAmount.toFixed(2)}`, totalX, y, { width: columnWidths.total, align: 'right' });
      doc.text(new Date(sale.saleDate).toLocaleDateString(), dateX, y, { width: columnWidths.date });

      y += 20;
      grandTotal += sale.totalAmount;
    });

    // Line before total
    doc.moveTo(startX, y + 5).lineTo(550, y + 5).stroke();


    // Grand total
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text(`Grand Total(RS): ${grandTotal.toFixed(2)}`, startX, y + 15, { align: 'right' });

    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate PDF', error: err.message });
  }
};
exports.getInvoice = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (!request.invoice || !request.invoice.filePath)
      return res.status(404).json({ message: 'Invoice not uploaded yet' });

    // Only admin or the user who made the request can access it
    if (req.user.role !== 'admin' && request.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const filePath = path.join(__dirname, '..', request.invoice.filePath);
    res.download(filePath);
  } catch (err) {
    console.error('❌ Get Invoice Error:', err);
    res.status(500).json({ message: 'Failed to fetch invoice', error: err.message });
  }
};
exports.getInvoice = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (!request.invoice || !request.invoice.filePath)
      return res.status(404).json({ message: 'Invoice not uploaded yet' });

    // Only admin or the user who made the request can access it
    if (req.user.role !== 'admin' && request.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const filePath = path.join(__dirname, '..', request.invoice.filePath);
    res.download(filePath);
  } catch (err) {
    console.error('❌ Get Invoice Error:', err);
    res.status(500).json({ message: 'Failed to fetch invoice', error: err.message });
  }
};
