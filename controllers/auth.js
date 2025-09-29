const crypto = require('crypto');
const User = require('../model/user'); // Make sure path is correct
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcrypt');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, phone, location, password, confirmPassword, role = 'user' } = req.body;

    if (!name || !email || !phone || !location || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    let user = await User.findOne({ email: email.trim().toLowerCase() });

    if (user && user.isVerified) {
      return res.status(400).json({ message: 'User already registered' });
    }

    if (!user) {
      user = new User({
        name,
        email: email.trim().toLowerCase(),
        phone,
        location,
        password,
        role,
        isVerified: false
      });
    } else {
      // If user exists but not verified, update fields and password
      user.name = name;
      user.phone = phone;
      user.location = location;
      user.password = password;
      user.role = role;
      user.isVerified = false;
    }

    // Generate OTP for verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    await user.save();

    console.log('Generated OTP:', otp);

    const subject = 'Verify your email - OTP';
    const text = `Hello ${name},\nYour OTP is ${otp}. It is valid for 10 minutes.\n\nThank you!`;

    await sendEmail(email, subject, null, text);

    return res.status(200).json({ message: 'OTP sent to email. Please verify.' });
  } catch (err) {
    console.error('Register Error:', err);
    return res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User already verified' });
    }

    if (user.otp !== String(otp) || user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;

    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Verify OTP Error:', err.message);
    return res.status(500).json({ message: 'OTP verification failed', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: 'Please verify your email first' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login Error:', err.message);
    return res.status(500).json({ message: 'Login failed', error: err.message });
  }
};
