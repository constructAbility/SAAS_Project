const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  branch: { type: String, required: true },
   category: { type: String, required: true }, // <-- NEW
  quantity: { type: Number, required: true, default: 0 },
    description: String,
    HNBC:{type:String,}
});

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
   description: String,
    HNBC:{type:String,},
  stock: [stockSchema]
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
