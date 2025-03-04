import User from '../../models/User.js';
import { ApiError } from '../../utils/apiError.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { getMe } from './getMeController.js';
import { login } from './loginController.js';
import { register } from './registerController.js';

export { getMe, login, register };

export const getAuthenticatedUser = async (req, res, next) => {
  try {
    // req.user should already be populated by the authenticate middleware
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return res.status(200).json(new ApiResponse(200, user));
  } catch (error) {
    next(error);
  }
};
