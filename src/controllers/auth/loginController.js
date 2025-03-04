import authService from '../../services/authService.js';
import AppError from '../../utils/AppError.js';

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    // Set JWT token as HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    res.cookie('jwt', result.token, cookieOptions);

    // Remove password from output
    if (result.user && result.user.password) {
      result.user.password = undefined;
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    next(new AppError(error.message, 401));
  }
};
