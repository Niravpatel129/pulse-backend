const User = require('../models/User');

class UserService {
  async getAllUsers() {
    return await User.find().select('-password');
  }

  async getUserById(id) {
    return await User.findById(id).select('-password');
  }

  async createUser(userData) {
    return await User.create(userData);
  }

  async updateUser(id, userData) {
    return await User.findByIdAndUpdate(id, userData, {
      new: true,
      runValidators: true,
    }).select('-password');
  }

  async deleteUser(id) {
    return await User.findByIdAndDelete(id);
  }
}

module.exports = new UserService();
