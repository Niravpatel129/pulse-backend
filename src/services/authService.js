import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

class AuthService {
  generateToken(id, email) {
    return jwt.sign({ id, userId: id, email }, process.env.JWT_SECRET || 'your-secret-key');
  }

  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Skip password validation in local environment
    const isLocal = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local';
    const isMatch = isLocal || (await user.matchPassword(password));

    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = this.generateToken(user._id, user.email);

    return {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(userData) {
    try {
      const user = await User.create(userData);
      const token = this.generateToken(user._id, user.email);

      return {
        token,
        user: {
          _id: user._id,
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

export default new AuthService();
