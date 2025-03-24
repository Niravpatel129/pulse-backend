const validateRequest = (schema) => {
  return (req, res, next) => {
    console.log('Raw request body:', req.body);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request method:', req.method);
    console.log('Request path:', req.path);
    console.log('Request headers:', req.headers);

    // Create a copy of the request body for validation
    const validationBody = { ...req.body };
    console.log('Validation body (initial):', validationBody);

    // Parse form data arrays if they exist
    if (validationBody && typeof validationBody === 'object') {
      Object.keys(validationBody).forEach((key) => {
        try {
          // Try to parse if it looks like a JSON string
          if (typeof validationBody[key] === 'string') {
            const trimmedValue = validationBody[key].trim();
            if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) {
              validationBody[key] = JSON.parse(trimmedValue);
              console.log(`Successfully parsed ${key} as JSON:`, validationBody[key]);
            }
          }
        } catch (e) {
          console.log(`Failed to parse ${key}:`, e);
          console.log(`Original value for ${key}:`, validationBody[key]);
          // If parsing fails, keep the original value
        }
      });
    }

    console.log('Validation body (after parsing):', validationBody);

    // Remove file-related fields from validation if this is a multipart request
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      delete validationBody.attachments;
      console.log('Removed attachments field for multipart request');
      console.log('Files in request:', req.files);
    }

    console.log('Validation body (final):', validationBody);
    console.log('Schema to validate against:', schema);

    // Validate the processed body
    const { error } = schema.validate(validationBody);
    if (error) {
      console.log('Validation error:', error);
      return res.status(400).json({
        message: 'Validation Error',
        errors: error.details.map((detail) => detail.message),
      });
    }

    console.log('Validation successful, proceeding to next middleware');
    next();
  };
};

export default validateRequest;
