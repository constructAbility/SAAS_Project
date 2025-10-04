const Request = require('../model/Request');
const Item = require('../model/item');
const User = require('../model/user');
const sendEmail = require('../utils/sendEmail');

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

    const request = await Request.findById(req.params.id).populate('user');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'approved') {
      return res.status(400).json({ message: 'Request is not approved yet' });
    }

    const quantity = request.quantity;
    const itemName = request.itemName;
    const userBranch = request.user.branch;
    const adminBranch = req.user.branch;

    // ✅ Auto-create item if not exists
    let item = await Item.findOne({ name: itemName });
    if (!item) {
      item = new Item({
        name: itemName,
        stock: []
      });
    }

    // ✅ Find or create admin stock
    let adminStock = item.stock.find(s => s.branch === adminBranch);
    if (!adminStock) {
      adminStock = {
        branch: adminBranch,
        category: "Default",
        description: "Auto-created by dispatch",
        quantity: 0
      };
      item.stock.push(adminStock);
    }

    // ✅ Check if admin has enough stock
    if (adminStock.quantity < quantity) {
      return res.status(400).json({
        message: `Insufficient stock at admin branch (${adminBranch}). Available: ${adminStock.quantity}`
      });
    }

    // ✅ Deduct from admin branch
    adminStock.quantity -= quantity;

    // ✅ Find or create user stock
    let userStock = item.stock.find(s => s.branch === userBranch);
    if (!userStock) {
      userStock = {
        branch: userBranch,
        category: adminStock.category,
        description: adminStock.description,
        quantity: 0
      };
      item.stock.push(userStock);
    }

    // ✅ Add to user branch stock
    userStock.quantity += quantity;

    await item.save();

    // ✅ Update request
    request.status = 'dispatched';
    request.timestamps = request.timestamps || {};
    request.timestamps.dispatched = new Date();
    await request.save();

    res.status(200).json({
      message: '✅ Request dispatched successfully.',
      itemName: item.name,
      dispatchedTo: request.user.name,
      quantityDispatched: quantity,
      adminStockRemaining: adminStock.quantity,
      userStockTotal: userStock.quantity,
      request
    });

  } catch (err) {
    console.error('Dispatch failed:', err);
    res.status(500).json({ message: 'Dispatch failed', error: err.message });
  }
};
