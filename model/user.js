const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Full Name is required'], trim: true },
    email: { type: String, required: [true, 'Email is required'], unique: true, trim: true, lowercase: true },
    phone: { type: String, required: [true, 'Phone number is required'] },
    location: { type: String, required: [true, 'Location is required'] },
    password: { type: String, required: [true, 'Password is required'], minlength: 6 },
    role: { type: String, enum: ['admin','user'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpiry: Date
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function(next){
  if(!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function(enteredPassword){
  return await bcrypt.compare(enteredPassword, this.password);
}

module.exports = mongoose.model('User', userSchema);
