import passport from 'passport';
import AppError from '../../utils/AppError.js';

export const protect = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return next(new AppError('Not authorized to access this route', 401));
    }
    req.user = user;
    next();
  })(req, res, next);
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};
