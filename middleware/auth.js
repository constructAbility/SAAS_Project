const jwt = require('jsonwebtoken');
const User = require('../model/user');

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.IMS_JWT_SECRET);

    let user = null;

    if (decoded.id) {
      user = await User.findById(decoded.id).select('-password');
    }

    if (!user && decoded.email) {
      user = await User.findOne({ email: decoded.email }).select('-password');
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();

  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = auth;
