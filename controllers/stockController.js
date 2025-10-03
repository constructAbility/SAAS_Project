const Item = require('../model/item');
const Stock = require('../model/Stock');
const Request = require('../model/Request');
const User = require('../model/user'); 




exports.createOrUpdateStock = async (req, res) => {
  try {
    const { itemName, description, category, quantity } = req.body;
    const branch = req.user.branch;

    if (!itemName || quantity == null) {
      return res.status(400).json({ message: 'Item name and quantity are required.' });
    }

    // 1. Find or create item
    let item = await Item.findOne({ name: itemName });
    if (!item) {
      item = new Item({
        name: itemName,
        description: description || 'No description provided',
        category: category || 'Uncategorized'
      });
      await item.save();
    } else {
      // optionally update metadata if changed
      let changed = false;
      if (description && description !== item.description) {
        item.description = description;
        changed = true;
      }
      if (category && category !== item.category) {
        item.category = category;
        changed = true;
      }
      if (changed) {
        await item.save();
      }
    }

    // 2. Find or create stock record for this branch & item
    let stock = await Stock.findOne({ item: item._id, branch });
    if (stock) {
      stock.quantity += quantity;
      await stock.save();
    } else {
      stock = new Stock({
        item: item._id,
        branch,
        quantity
      });
      await stock.save();
    }

    return res.status(200).json({
      message: 'Item & stock added/updated successfully',
      item,
      stock
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error adding/updating stock', error: error.message });
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
    const branch = req.user.branch;

    // get all items
    const items = await Item.find();

    // get all stocks in this branch
    const stocks = await Stock.find({ branch });

    // get all dispatched requests to this branch
    const requests = await Request.find({ 
      status: 'dispatched',
      deliveryAddress: branch
    }).populate('item');

    const response = items.map(item => {
      // find stock record
      const stockRec = stocks.find(s => s.item.toString() === item._id.toString());
      const available = stockRec ? stockRec.quantity : 0;

      // dispatched sum of that item to this branch
      const dispatchedSum = requests
        .filter(r => r.item && r.item._id.toString() === item._id.toString())
        .reduce((sum, r) => sum + r.quantity, 0);

      return {
        itemName: item.name,
        category: item.category,
        description: item.description,
        availableQuantity: available,
        dispatchedQuantity: dispatchedSum
      };
    });

    res.status(200).json({ branch, stock: response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching admin stock summary', error: err.message });
  }
};

exports.getUserStockSummary = async (req, res) => {
  try {
    const branch = req.user.branch;

    // fetch stock records in this branch (only items for which stock exists)
    const stocks = await Stock.find({ branch }).populate('item');

    // fetch dispatched requests for this user
    const userRequests = await Request.find({
      user: req.user._id,
      status: 'dispatched'
    }).populate('item');

    const response = stocks.map(stock => {
      const item = stock.item;
      const received = userRequests
        .filter(r => r.item && r.item._id.toString() === item._id.toString())
        .reduce((sum, r) => sum + r.quantity, 0);

      return {
        itemName: item.name,
        category: item.category,
        description: item.description,
        availableQuantity: stock.quantity,
        userReceivedQuantity: received
      };
    });

    res.status(200).json({ branch, stock: response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching user stock summary', error: err.message });
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
