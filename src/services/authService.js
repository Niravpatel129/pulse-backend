const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

class AuthService {
  generateToken(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: process.env.JWT_EXPIRE || '30d',
    });
  }

  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = this.generateToken(user._id);

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(userData) {
    try {
      console.log('🚀 userData:', userData);
      const user = await User.create(userData);
      console.log('🚀 user:', user);
      const token = this.generateToken(user._id);

      return {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      console.log('🚀 error:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
