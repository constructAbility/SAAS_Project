const Item = require('../model/item');
const Stock = require('../model/Stock');
const Request = require('../model/Request');
const User = require('../model/user'); 



exports.createOrUpdateStock = async (req, res) => {
  try {
    const { itemName, description, category, quantity } = req.body;
    const branch = req.user.branch;  // Admin's branch

    if (!itemName || quantity == null) {
      return res.status(400).json({ message: 'Item name and quantity are required.' });
    }

    // Step 1: Find if item exists
    let item = await Item.findOne({ name: itemName });

    if (!item) {
      // Create new item
      item = new Item({
        name: itemName,
        description: description || 'No description provided',
        category: category || 'Uncategorized'
      });
      await item.save();
    } else {
      // Optional: update description/category if provided and changed
      let changed = false;
      if (description && description !== item.description) {
        item.description = description;
        changed = true;
      }
      if (category && category !== item.category) {
        item.category = category;
        changed = true;
      }
      if (changed) await item.save();
    }

    // Step 2: Find stock for this item & branch
    let stock = await Stock.findOne({ item: item._id, branch });

    if (stock) {
      // Update quantity
      stock.quantity += quantity;
      await stock.save();
    } else {
      // Create new stock record for this branch and item
      stock = new Stock({
        item: item._id,
        branch,
        quantity
      });
      await stock.save();
    }

    return res.status(200).json({
      message: 'Item and Stock successfully created/updated',
      item,
      stock
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create/update item and stock', error: error.message });
  }
};


exports.getDashboardSummary = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const items = await Item.find();
    const stocks = await Stock.find().populate('item');

    const itemMap = {};

    // Group stocks by item
    stocks.forEach(stock => {
      const itemId = stock.item._id.toString();
      if (!itemMap[itemId]) {
        itemMap[itemId] = {
          name: stock.item.name,
          totalQuantity: 0,
          branches: []
        };
      }

      itemMap[itemId].totalQuantity += stock.quantity;
      itemMap[itemId].branches.push({
        branch: stock.branch,
        quantity: stock.quantity
      });
    });

    const itemSummaries = Object.values(itemMap);

    // Request stats
    const total = await Request.countDocuments({ createdAt: { $gte: currentMonthStart } });
    const approved = await Request.countDocuments({ status: 'approved', createdAt: { $gte: currentMonthStart } });
    const dispatched = await Request.countDocuments({ status: 'dispatched', createdAt: { $gte: currentMonthStart } });
    const pending = await Request.countDocuments({ status: 'requested', createdAt: { $gte: currentMonthStart } });

    res.json({
      totalItems: items.length,
      totalQuantity: itemSummaries.reduce((sum, item) => sum + item.totalQuantity, 0),
      items: itemSummaries,
      requests: { total, approved, dispatched, pending }
    });

  } catch (err) {
    res.status(500).json({ message: 'Dashboard failed', error: err.message });
  }
};
exports.getAdminStockSummary = async (req, res) => {
  try {
    const adminBranch = req.user.branch;

    const stocks = await Stock.find({ branch: adminBranch }).populate('item');
    const requests = await Request.find({
      status: 'dispatched',
      deliveryAddress: adminBranch
    }).populate('item');

    const response = [];

    for (const stock of stocks) {
      if (!stock.item) continue;

      const totalDispatched = requests
        .filter(r => r.item && r.item._id.toString() === stock.item._id.toString())
        .reduce((sum, r) => sum + r.quantity, 0);

      response.push({
        itemName: stock.item.name,
        category: stock.item.category || 'N/A',
        description: stock.item.description || 'N/A',
        availableQuantity: stock.quantity,
        dispatchedQuantity: totalDispatched
      });
    }

    res.json({ branch: adminBranch, stock: response });

  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch admin stock', error: err.message });
  }
};

exports.getUserStockSummary = async (req, res) => {
  try {
    const userBranch = req.user.branch;

    const stocks = await Stock.find({ branch: userBranch }).populate('item');
    const requests = await Request.find({
      user: req.user._id,
      status: 'dispatched'
    }).populate('item');

    const response = [];

    for (const stock of stocks) {
      const totalUserDispatched = requests
        .filter(r => r.item._id.toString() === stock.item._id.toString())
        .reduce((sum, r) => sum + r.quantity, 0);

      response.push({
        itemName: stock.item.name,
        category: stock.item.category || 'N/A',
        description: stock.item.description || 'N/A',
        availableQuantity: stock.quantity,
        userReceivedQuantity: totalUserDispatched
      });
    }

    res.json({ branch: userBranch, stock: response });

  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user stock', error: err.message });
  }
};

 // ensure path is correct

exports.getAllUsers = async (req, res) => {
  try {
    // Sirf admin hi access kar sakta hai
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const users = await User.find().select('-password'); // password hata ke sab details laao
    const totalUsers = users.length;

    res.status(200).json({
      totalUsers,
      users
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch users', error: err.message });
  }
};
