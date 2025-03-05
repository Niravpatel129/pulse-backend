import AppError from './AppError.js';

export const handleError = (res, error) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
  }

  // Handle mongoose validation errors
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((err) => err.message);
    return res.status(400).json({
      status: 'error',
      message: 'Validation Error',
      errors,
    });
  }

  // Handle mongoose duplicate key errors
  if (error.code === 11000) {
    return res.status(400).json({
      status: 'error',
      message: 'Duplicate field value entered',
    });
  }

  // Handle mongoose cast errors
  if (error.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid ID format',
    });
  }

  // Default error
  console.error('Error:', error);
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};
