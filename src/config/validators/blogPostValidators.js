import { body, param, query } from 'express-validator';

// Common validation rules
const titleValidation = body('title')
  .notEmpty()
  .withMessage('Title is required')
  .isLength({ min: 1, max: 200 })
  .withMessage('Title must be between 1 and 200 characters')
  .trim();

const slugValidation = body('slug')
  .notEmpty()
  .withMessage('Slug is required')
  .isLength({ min: 1, max: 200 })
  .withMessage('Slug must be between 1 and 200 characters')
  .matches(/^[a-z0-9-]+$/)
  .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
  .trim();

const excerptValidation = body('excerpt')
  .notEmpty()
  .withMessage('Excerpt is required')
  .isLength({ min: 1, max: 500 })
  .withMessage('Excerpt must be between 1 and 500 characters')
  .trim();

const contentValidation = body('content').notEmpty().withMessage('Content is required').trim();

const statusValidation = body('status')
  .optional()
  .isIn(['draft', 'published', 'scheduled'])
  .withMessage('Status must be one of: draft, published, scheduled');

const tagsValidation = body('tags')
  .optional()
  .isString()
  .withMessage('Tags must be a string')
  .trim();

const featuredImageValidation = body('featuredImage')
  .optional()
  .isString()
  .withMessage('Featured image must be a string')
  .trim();

const seoTitleValidation = body('seoTitle')
  .optional()
  .isLength({ max: 60 })
  .withMessage('SEO title cannot exceed 60 characters')
  .trim();

const seoDescriptionValidation = body('seoDescription')
  .optional()
  .isLength({ max: 160 })
  .withMessage('SEO description cannot exceed 160 characters')
  .trim();

const publishDateValidation = body('publishDate')
  .optional({ checkFalsy: true })
  .if((value, { req }) => {
    // Only validate if status is not draft and value exists
    return req.body.status !== 'draft' && value && value.trim() !== '';
  })
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .withMessage('Publish date must be in YYYY-MM-DD format')
  .trim();

const publishTimeValidation = body('publishTime')
  .optional({ checkFalsy: true })
  .if((value, { req }) => {
    // Only validate if status is not draft and value exists
    return req.body.status !== 'draft' && value && value.trim() !== '';
  })
  .matches(/^\d{2}:\d{2}$/)
  .withMessage('Publish time must be in HH:MM format')
  .trim();

const categoriesValidation = body('categories')
  .optional()
  .isString()
  .withMessage('Categories must be a string')
  .trim();

const authorValidation = body('author').notEmpty().withMessage('Author is required').trim();

// Validation for creating a blog post
export const validateCreateBlogPost = [
  titleValidation,
  slugValidation,
  excerptValidation,
  contentValidation,
  statusValidation,
  tagsValidation,
  featuredImageValidation,
  seoTitleValidation,
  seoDescriptionValidation,
  publishDateValidation,
  publishTimeValidation,
  categoriesValidation,
  authorValidation,
];

// Validation for updating a blog post (all fields optional except ID)
export const validateUpdateBlogPost = [
  param('id').isMongoId().withMessage('Invalid blog post ID'),

  body('title')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .trim(),

  body('slug')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Slug must be between 1 and 200 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    .trim(),

  body('excerpt')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('Excerpt must be between 1 and 500 characters')
    .trim(),

  body('content').optional().isString().withMessage('Content must be a string').trim(),

  statusValidation,
  tagsValidation,
  featuredImageValidation,
  seoTitleValidation,
  seoDescriptionValidation,
  publishDateValidation,
  publishTimeValidation,
  categoriesValidation,

  body('author').optional().isString().withMessage('Author must be a string').trim(),
];

// Validation for blog post ID parameter
export const validateBlogPostId = [param('id').isMongoId().withMessage('Invalid blog post ID')];

// Validation for query parameters
export const validateBlogPostQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),

  query('status')
    .optional()
    .isIn(['draft', 'published', 'scheduled'])
    .withMessage('Status must be one of: draft, published, scheduled'),

  query('search').optional().isString().withMessage('Search must be a string').trim(),

  query('category').optional().isString().withMessage('Category must be a string').trim(),

  query('tag').optional().isString().withMessage('Tag must be a string').trim(),

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'publishedAt', 'title', 'author'])
    .withMessage('Sort by must be one of: createdAt, updatedAt, publishedAt, title, author'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc'),
];
