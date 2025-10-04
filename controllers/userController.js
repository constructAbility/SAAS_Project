// controllers/userController.js
// controllers/userController.js

const User = require('../model/user');

// ✅ Get Profile (from auth middleware)
exports.getProfile = async (req, res) => {
  try {
    return res.status(200).json({
      message: 'Profile fetched successfully',
      user: req.user
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
  }
};

// ✅ Get All Users (Admin Only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    return res.status(200).json({ users });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch users', error: err.message });
  }
};

// ✅ Update User (Except name, email, password)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { name, email, password, ...updatableData } = req.body; // ❌ Block name, email & password

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updatableData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ message: 'User updated successfully', user: updatedUser });

  } catch (err) {
    return res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
};

// ✅ Delete User
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
};
