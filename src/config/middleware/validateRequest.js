const validateRequest = (schema) => {
  return (req, res, next) => {
    console.log('Raw request body:', req.body);
    console.log('Content-Type:', req.headers['content-type']);

    // Create a copy of the request body for validation
    const validationBody = { ...req.body };

    // Parse form data arrays if they exist
    if (validationBody && typeof validationBody === 'object') {
      Object.keys(validationBody).forEach((key) => {
        try {
          // Try to parse if it looks like a JSON string
          if (typeof validationBody[key] === 'string') {
            const trimmedValue = validationBody[key].trim();
            if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) {
              validationBody[key] = JSON.parse(trimmedValue);
            }
          }
        } catch (e) {
          console.log(`Failed to parse ${key}:`, e);
          // If parsing fails, keep the original value
        }
      });
    }

    // Remove file-related fields from validation if this is a multipart request
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      delete validationBody.attachments;
    }

    // Validate the processed body
    const { error } = schema.validate(validationBody);
    if (error) {
      return res.status(400).json({
        message: 'Validation Error',
        errors: error.details.map((detail) => detail.message),
      });
    }

    next();
  };
};

export default validateRequest;
