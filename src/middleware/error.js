export const errorHandler = (err, req, res, next) => {
  // Default error
  let error = {
    statusCode: err.statusCode || 500,
    message: err.message || 'Something went wrong',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };

  // Handle custom errors
  if (
    err.name === 'BadRequestError' ||
    err.name === 'NotFoundError' ||
    err.name === 'UnauthorizedError' ||
    err.name === 'ForbiddenError' ||
    err.name === 'ConflictError'
  ) {
    error = {
      statusCode: err.statusCode,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    error = {
      statusCode: 400,
      message: messages.join(', '),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    error = {
      statusCode: 409,
      message: 'Duplicate field value entered',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };
  }

  // Handle Mongoose cast errors
  if (err.name === 'CastError') {
    error = {
      statusCode: 400,
      message: `Invalid ${err.path}: ${err.value}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };
  }

  // Send error response
  res.status(error.statusCode).json({
    success: false,
    error: error.message,
    stack: error.stack,
  });
};
