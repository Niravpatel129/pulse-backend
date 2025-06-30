/**
 * Middleware to validate request data against Joi schemas
 * @param {Object|Function} schemas - Joi schema object with body/query/params properties, or direct schema for body
 * @returns {Function} Express middleware function
 */
export const validateRequest = (schemas) => {
  return (req, res, next) => {
    try {
      const validationErrors = [];

      // Handle both old format (direct schema) and new format (object with body/query/params)
      const schemaConfig =
        typeof schemas.validate === 'function'
          ? { body: schemas } // Old format - direct schema for body validation
          : schemas; // New format - object with body/query/params

      // Validate body if schema provided
      if (schemaConfig.body) {
        const { error, value } = schemaConfig.body.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          const bodyErrors = error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            type: 'body',
          }));
          validationErrors.push(...bodyErrors);
        } else {
          req.body = value; // Replace with validated and sanitized data
        }
      }

      // Validate query parameters if schema provided
      if (schemaConfig.query) {
        const { error, value } = schemaConfig.query.validate(req.query, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          const queryErrors = error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            type: 'query',
          }));
          validationErrors.push(...queryErrors);
        } else {
          req.query = value;
        }
      }

      // Validate path parameters if schema provided
      if (schemaConfig.params) {
        const { error, value } = schemaConfig.params.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          const paramErrors = error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            type: 'params',
          }));
          validationErrors.push(...paramErrors);
        } else {
          req.params = value;
        }
      }

      // If there are validation errors, return them in a structured format
      if (validationErrors.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: validationErrors,
          // Also provide a simple error message for backwards compatibility
          details: validationErrors
            .map((err) => `${err.type}.${err.field}: ${err.message}`)
            .join(', '),
        });
      }

      next();
    } catch (err) {
      console.error('Validation middleware error:', err);

      // Provide more specific error information
      return res.status(500).json({
        status: 'error',
        message: 'Internal validation error',
        details:
          process.env.NODE_ENV === 'development'
            ? err.message
            : 'Please contact support if this issue persists',
      });
    }
  };
};
