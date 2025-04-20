import multer from 'multer';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function - allow all file types
const fileFilter = (req, file, cb) => {
  console.log('Processing file upload:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    fieldname: file.fieldname,
  });

  // Allow all file types
  cb(null, true);
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
    // Handle lead form submissions with dynamic file field names
    if (field === 'file') {
      const dynamicUpload = upload.any();
      dynamicUpload(req, res, (err) => {
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
    } else {
      // Standard upload for specific field
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
    }
  };
};

export default uploadWithErrorHandling;
