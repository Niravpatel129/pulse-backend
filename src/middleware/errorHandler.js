import ApiResponse from '../utils/apiResponse.js';

export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((error) => error.message);
    return res.status(400).json(new ApiResponse(400, null, errors.join(', ')));
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json(new ApiResponse(400, null, 'Duplicate field value entered'));
  }

  // Default error
  return res.status(500).json(new ApiResponse(500, null, 'Internal server error'));
};
