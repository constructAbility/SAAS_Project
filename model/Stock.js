const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  branch: String,
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  quantity: Number,
  rate: Number,   // ✅ New field
  value: Number,  // ✅ New field (auto calculated)
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ownerType: { type: String, enum: ['admin', 'user'], default: 'user' }
});

// 🔁 Auto-calculate value before saving
stockSchema.pre('save', function (next) {
  this.value = this.quantity * this.rate;
  next();
});

module.exports = mongoose.model('Stock', stockSchema);
