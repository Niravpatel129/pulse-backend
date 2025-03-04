import authService from '../../services/authService.js';
import AppError from '../../utils/AppError.js';

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(new AppError(error.message, 401));
  }
};
