const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  branch: String,
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  quantity: Number
});

module.exports = mongoose.model('Stock', stockSchema);
