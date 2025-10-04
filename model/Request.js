const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // 🔥 Add this field to support .populate('item')
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },

  itemName: { type: String, required: true },
  Decofitem: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  requiredDate: { type: Date },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  deliveryAddress: { type: String },

  status: {
    type: String,
    enum: ['requested', 'approved', 'rejected', 'dispatched'],
    default: 'requested'
  },

  token: { type: String, unique: true, sparse: true },

  timestamps: {
    requested: { type: Date, default: Date.now },
    approved: { type: Date },
    dispatched: { type: Date }
  },

  rejectionReason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);
