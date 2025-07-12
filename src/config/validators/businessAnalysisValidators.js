import { body } from 'express-validator';

// Validation for Google Business analysis
export const validateAnalyzeGoogleBusiness = [
  // Either business_name + location OR place_id must be provided
  body('business_name')
    .if(body('place_id').isEmpty())
    .notEmpty()
    .withMessage('Business name is required when place_id is not provided')
    .isString()
    .withMessage('Business name must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Business name must be between 1 and 100 characters'),

  body('location')
    .if(body('place_id').isEmpty())
    .notEmpty()
    .withMessage('Location is required when place_id is not provided')
    .isString()
    .withMessage('Location must be a string')
    .isLength({ min: 1, max: 200 })
    .withMessage('Location must be between 1 and 200 characters'),

  body('place_id')
    .if(body('business_name').isEmpty())
    .notEmpty()
    .withMessage('Place ID is required when business_name is not provided')
    .isString()
    .withMessage('Place ID must be a string')
    .matches(/^ChIJ[A-Za-z0-9_-]+$/)
    .withMessage('Place ID must be a valid Google Places ID'),

  body('keywords')
    .optional()
    .isArray()
    .withMessage('Keywords must be an array')
    .custom((value) => {
      if (value && value.length > 20) {
        throw new Error('Maximum 20 keywords allowed');
      }
      if (value && value.some((keyword) => typeof keyword !== 'string' || keyword.length > 50)) {
        throw new Error('Each keyword must be a string with maximum 50 characters');
      }
      return true;
    }),

  body('industry')
    .optional()
    .isString()
    .withMessage('Industry must be a string')
    .isLength({ min: 1, max: 50 })
    .withMessage('Industry must be between 1 and 50 characters'),

  // Custom validation to ensure at least one identification method is provided
  body().custom((value) => {
    const { business_name, location, place_id } = value;

    if (place_id) {
      return true; // place_id is sufficient
    }

    if (business_name && location) {
      return true; // business_name + location is sufficient
    }

    throw new Error('Either place_id or both business_name and location must be provided');
  }),
];
