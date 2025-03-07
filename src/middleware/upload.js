import multer from 'multer';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  console.log('Processing file upload:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });

  // Add or modify allowed types as needed
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];

  if (!file.mimetype) {
    console.error('File upload rejected: No mimetype specified');
    cb(new Error('No mimetype specified'), false);
    return;
  }

  if (allowedTypes.includes(file.mimetype)) {
    console.log('File type accepted:', file.mimetype);
    cb(null, true);
  } else {
    console.error('File upload rejected: Invalid file type:', file.mimetype);
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5, // Maximum 5 files per request
  },
});

// Add error handling wrapper
const uploadWithErrorHandling = (field) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.array(field);

    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        return res.status(400).json({
          error: true,
          message: `File upload error: ${err.message}`,
          code: err.code,
        });
      } else if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
          error: true,
          message: err.message,
        });
      }
      next();
    });
  };
};

export default uploadWithErrorHandling;
