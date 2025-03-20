const validateRequest = (schema) => {
  return (req, res, next) => {
    console.log('Raw request body:', req.body);
    console.log('Content-Type:', req.headers['content-type']);

    // Parse form data arrays if they exist
    if (req.body && typeof req.body === 'object') {
      Object.keys(req.body).forEach((key) => {
        console.log(`Processing key: ${key}, value:`, req.body[key]);
        try {
          // Try to parse if it looks like a JSON string
          if (typeof req.body[key] === 'string') {
            // Remove any whitespace and try to parse
            const trimmedValue = req.body[key].trim();
            if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) {
              req.body[key] = JSON.parse(trimmedValue);
              console.log(`Parsed ${key}:`, req.body[key]);
            }
          }
        } catch (e) {
          console.log(`Failed to parse ${key}:`, e);
          // If parsing fails, keep the original value
        }
      });
    }

    const { error } = schema.validate(req.body);
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
