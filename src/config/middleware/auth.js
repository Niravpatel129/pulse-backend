import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

// Protect routes
export const protect = async (req, res, next) => {
  try {
    // 1) Get token and check if it exists
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Don't use 'undefined' string as a token
      const authToken = req.headers.authorization.split(' ')[1];
      if (authToken && authToken !== 'undefined') {
        token = authToken;
      }
    }

    // Check for token in cookies as fallback
    if (!token && req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // 2) Verify token
    try {
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

      // 3) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next(new AppError('The user belonging to this token no longer exists.', 401));
      }

      // 4) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppError('User recently changed password. Please log in again.', 401));
      }

      // GRANT ACCESS TO PROTECTED ROUTE
      req.user = currentUser;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token. Please log in again.', 401));
      }
      if (jwtError.name === 'TokenExpiredError') {
        return next(new AppError('Your token has expired. Please log in again.', 401));
      }
      return next(new AppError('Authentication failed', 401));
    }
  } catch (error) {
    return next(new AppError('Authentication failed', 401));
  }
};

// Restrict to certain roles
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};
