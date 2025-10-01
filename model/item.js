const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  branch: { type: String, required: true },
   category: { type: String, required: true }, // <-- NEW
  quantity: { type: Number, required: true, default: 0 },
    description: String
});

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stock: [stockSchema]
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
