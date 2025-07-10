import { body, param, query } from 'express-validator';

// Validation for tracking blog read
export const validateTrackBlogRead = [
  body('postId').isMongoId().withMessage('Invalid postId format'),

  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isString()
    .withMessage('Session ID must be a string'),

  body('readDuration')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Read duration must be a non-negative number'),

  body('scrollDepth')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Scroll depth must be between 0 and 100'),

  body('timeOnPage')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Time on page must be a non-negative number'),

  body('userAgent')
    .notEmpty()
    .withMessage('User agent is required')
    .isString()
    .withMessage('User agent must be a string'),

  body('referrer').optional().isString().withMessage('Referrer must be a string'),

  body('ipAddress').optional().isString().withMessage('IP address must be a string'),

  body('country').optional().isString().withMessage('Country must be a string'),

  body('deviceType')
    .optional()
    .isIn(['desktop', 'mobile', 'tablet'])
    .withMessage('Device type must be one of: desktop, mobile, tablet'),

  body('browser').optional().isString().withMessage('Browser must be a string'),

  body('os').optional().isString().withMessage('Operating system must be a string'),

  body('readerId').optional().isMongoId().withMessage('Invalid readerId format'),

  body('postTitle').optional().isString().withMessage('Post title must be a string'),
];

// Validation for analytics summary query
export const validateAnalyticsSummary = [
  query('workspaceId').isMongoId().withMessage('Invalid workspaceId format'),

  query('start').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),

  query('end').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
];

// Validation for blog post analytics
export const validateBlogPostAnalytics = [
  param('postId').isMongoId().withMessage('Invalid postId format'),

  query('workspaceId').isMongoId().withMessage('Invalid workspaceId format'),
];

// Validation for reader engagement
export const validateReaderEngagement = [
  query('workspaceId').isMongoId().withMessage('Invalid workspaceId format'),

  query('start').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),

  query('end').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
];
