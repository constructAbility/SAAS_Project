const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // jisne sale ki
  customerName: String,
  customerEmail: String,
  customerAddress: String,

  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },        // per unit selling price
  totalAmount: Number,                            // auto-calculated

  saleDate: { type: Date, default: Date.now }
});

// Calculate total
saleSchema.pre('save', function(next) {
  this.totalAmount = this.quantity * this.price;
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
