import ApiError from '../utils/apiError.js';

/**
 * Middleware to validate request data against a Joi schema
 * @param {Object} schema - Joi schema to validate against
 * @returns {Function} Express middleware function
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false, // Return all errors, not just the first one
        stripUnknown: true, // Remove unknown keys from the validated data
      });

      if (error) {
        const errorMessage = error.details.map((detail) => detail.message).join(', ');
        return next(new ApiError(400, errorMessage));
      }

      // Replace request body with validated and sanitized data
      req.body = value;
      next();
    } catch (err) {
      next(new ApiError(500, 'Validation middleware error'));
    }
  };
};
