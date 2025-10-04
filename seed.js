// routes/seedRoutes.js
const express = require('express');
const router = express.Router();
const Item = require('./model/item');

// Route to seed stock for an item
router.post('/seed-stock', async (req, res) => {
  try {
    const { itemName, branch, quantity, category, description } = req.body;

    if (!itemName || !branch || !quantity) {
      return res.status(400).json({ message: 'itemName, branch, and quantity are required' });
    }

    let item = await Item.findOne({ name: itemName });

    // If item doesn't exist, create one
    if (!item) {
      item = new Item({
        name: itemName,
        stock: []
      });
    }

    // Check if stock already exists for this branch
    let stockEntry = item.stock.find(s => s.branch === branch);

    if (!stockEntry) {
      // Add new stock entry
      stockEntry = {
        branch,
        category: category || 'default',
        description: description || '',
        quantity: Number(quantity)
      };
      item.stock.push(stockEntry);
    } else {
      // Update existing stock
      stockEntry.quantity += Number(quantity);
    }

    await item.save();

    res.status(200).json({
      message: 'Stock seeded/updated successfully',
      item
    });
  } catch (err) {
    console.error('Seed error:', err.message);
    res.status(500).json({ message: 'Failed to seed stock', error: err.message });
  }
});

module.exports = router;
