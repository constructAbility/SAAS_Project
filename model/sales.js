const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  customerName: String,
  customerEmail: String,
  customerAddress: String,

  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },        
  totalAmount: Number,                            

  saleDate: { type: Date, default: Date.now }
});


saleSchema.pre('save', function(next) {
  this.totalAmount = this.quantity * this.price;
  next();
});

module.exports = mongoose.model('Sale', saleSchema);

exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.find({ userId: req.user.id })
      .populate('item') 
      .sort({ saleDate: -1 }); 

    res.status(200).json({
      message: 'Sales fetched successfully',
      count: sales.length,
      sales
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sales', error: err.message });
  }
};
