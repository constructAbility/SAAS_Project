const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  branch: { type: String, required: true },
  location: { type: String, required: true },
  password: { type: String, required: true },

  
  role: {
    type: String,
    enum: ['admin', 'user'], 
    default: 'user'
  },

  isVerified: { type: Boolean, default: true }
});


userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
