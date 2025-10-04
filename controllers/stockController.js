const Item = require('../model/item');
const Stock = require('../model/Stock');
const Request = require('../model/Request');
const User = require('../model/user'); 
exports.createOrUpdateStock = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can add stock' });
    }

    const { itemName, description, category, quantity, rate } = req.body;
    const branch = req.user.branch;

    if (!itemName || quantity == null || rate == null) {
      return res.status(400).json({ message: 'Item name, quantity and rate are required.' });
    }

    // Normalize name
    const normalizedItemName = itemName.trim().toLowerCase();

    // Check if item exists, otherwise create it
    let item = await Item.findOne({ name: normalizedItemName });

    if (!item) {
      item = new Item({
        name: normalizedItemName,
        description: description || 'No description provided',
        category: category || 'Uncategorized'
      });
      await item.save();
    } else {
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

    // 🔐 Add/update stock ONLY for the admin themself
    let stock = await Stock.findOne({
      item: item._id,
      ownerId: req.user._id,
      ownerType: 'admin',
      branch
    });

    if (stock) {
      stock.quantity += quantity;
      stock.rate = rate; // update rate if needed
    } else {
      stock = new Stock({
        item: item._id,
        quantity,
        rate,
        branch,
        ownerId: req.user._id,
        ownerType: 'admin'
      });
    }

    await stock.save(); // value auto-calculated in schema

    return res.status(200).json({
      message: 'Stock successfully added/updated for admin',
      item: {
        name: item.name,
        category: item.category,
        description: item.description
      },
      updatedStock: {
        quantity: stock.quantity,
        rate: stock.rate,
        value: stock.value,
        branch: stock.branch
      }
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
// controllers/stockController.js


// ✅ ADMIN: Get all stock summary
exports.getAdminStockSummary = async (req, res) => {
  try {
    // Fetch all items with all stock entries
    const items = await Item.find().lean();

    const stock = items.map(item => {
      const totalQty = item.stock?.reduce((sum, s) => sum + (s.quantity || 0), 0);
      const avgRate = item.stock?.length
        ? item.stock.reduce((sum, s) => sum + (s.rate || 0), 0) / item.stock.length
        : 0;

      return {
        _id: item._id,
        itemName: item.name,
        hsnCode: item.hsnCode || "-",
        category: item.category || "Other",
        description: item.description || "",
        availableQuantity: totalQty || 0,
        rate: avgRate || 0,
        value: (avgRate || 0) * (totalQty || 0),
      };
    });

    res.json({
      message: "Admin Stock Summary",
      stock,
      totalItems: stock.length,
    });
  } catch (err) {
    console.error("❌ Error fetching admin stock summary:", err);
    res.status(500).json({ message: "Failed to load stock summary" });
  }
};
exports.getUserStockSummary = async (req, res) => {
  try {
    const branch = req.user.branch;

    // ✅ Fetch ONLY stock created for this user
const stocks = await Stock.find({
  branch,
  ownerId: req.user._id,
  ownerType: 'user'
}).populate('item');


    // ✅ Fetch requests dispatched to this user
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
  userReceivedQuantity: received,
  rate: stock.rate,
  value: stock.value
};

    });

    res.status(200).json({
      user: req.user.name,
      branch,
      stock: response
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Error fetching user stock summary',
      error: err.message
    });
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


exports.getAllStockForAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const stocks = await Stock.find().populate('item').populate('ownerId', 'name role'); // show item and owner

    const grouped = {};

    stocks.forEach(stock => {
      const itemId = stock.item._id.toString();
      if (!grouped[itemId]) {
        grouped[itemId] = {
          itemName: stock.item.name,
          category: stock.item.category,
          description: stock.item.description,
          totalQuantity: 0,
          stockDetails: []
        };
      }

      grouped[itemId].totalQuantity += stock.quantity;
     grouped[itemId].stockDetails.push({
  quantity: stock.quantity,
  rate: stock.rate,
  value: stock.value,
  branch: stock.branch,
  ownerName: stock.ownerId?.name || 'Unknown',
  ownerRole: stock.ownerType
});

    });

    res.status(200).json({
      totalItems: Object.keys(grouped).length,
      stocks: Object.values(grouped)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching all stock', error: err.message });
  }
};
