const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  branch: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 }
});

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stock: [stockSchema]
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
