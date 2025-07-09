import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/expressValidatorMiddleware.js';

// Validation for creating newsletter signup
export const createNewsletterSignupValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('workspaceId').isMongoId().withMessage('Please provide a valid workspace ID'),
  body('workspaceName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Workspace name must be between 1 and 100 characters'),
  body('source')
    .optional()
    .isIn(['command_page', 'website', 'api', 'manual'])
    .withMessage('Invalid source value'),
  validateRequest,
];

// Validation for getting newsletter signups
export const getNewsletterSignupsValidation = [
  query('workspaceId').isMongoId().withMessage('Please provide a valid workspace ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['subscribed', 'unsubscribed', 'pending'])
    .withMessage('Invalid status value'),
  query('source')
    .optional()
    .isIn(['command_page', 'website', 'api', 'manual'])
    .withMessage('Invalid source value'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  validateRequest,
];

// Validation for getting newsletter stats
export const getNewsletterStatsValidation = [
  query('workspaceId').isMongoId().withMessage('Please provide a valid workspace ID'),
  validateRequest,
];

// Validation for unsubscribing from newsletter
export const unsubscribeNewsletterValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('workspaceId').isMongoId().withMessage('Please provide a valid workspace ID'),
  validateRequest,
];

// Validation for deleting newsletter signup
export const deleteNewsletterSignupValidation = [
  param('id').isMongoId().withMessage('Please provide a valid signup ID'),
  validateRequest,
];
