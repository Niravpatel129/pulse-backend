import { validationResult } from 'express-validator';

/**
 * Middleware to handle express-validator validation results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location,
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: validationErrors,
      details: validationErrors.map((err) => `${err.field}: ${err.message}`).join(', '),
    });
  }

  next();
};
