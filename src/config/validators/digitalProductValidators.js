import Joi from 'joi';

// Validation schema for creating payment intent
export const createPaymentIntentSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    'number.base': 'Amount must be a number',
    'number.positive': 'Amount must be positive',
    'any.required': 'Amount is required',
  }),
  product: Joi.object({
    id: Joi.string().required().messages({
      'string.base': 'Product ID must be a string',
      'any.required': 'Product ID is required',
    }),
  })
    .required()
    .messages({
      'object.base': 'Product must be an object',
      'any.required': 'Product is required',
    }),
  customer: Joi.object({
    firstName: Joi.string().trim().min(1).max(50).required().messages({
      'string.base': 'First name must be a string',
      'string.empty': 'First name cannot be empty',
      'string.min': 'First name must be at least 1 character',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required',
    }),
    lastName: Joi.string().trim().min(1).max(50).required().messages({
      'string.base': 'Last name must be a string',
      'string.empty': 'Last name cannot be empty',
      'string.min': 'Last name must be at least 1 character',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required',
    }),
    email: Joi.string().email().required().messages({
      'string.base': 'Email must be a string',
      'string.email': 'Email must be a valid email address',
      'any.required': 'Email is required',
    }),
    phone: Joi.string().allow('', null).optional(),
    company: Joi.string().allow('', null).optional(),
    country: Joi.string().min(2).max(3).default('US').messages({
      'string.base': 'Country must be a string',
      'string.min': 'Country must be at least 2 characters',
      'string.max': 'Country cannot exceed 3 characters',
    }),
    acceptsMarketing: Joi.boolean().default(false),
  })
    .required()
    .messages({
      'object.base': 'Customer must be an object',
      'any.required': 'Customer information is required',
    }),
  workspaceId: Joi.string().optional().allow('', null),
});

// Validation schema for confirming payment
export const confirmPaymentSchema = Joi.object({
  paymentIntentId: Joi.string().required().messages({
    'string.base': 'Payment intent ID must be a string',
    'any.required': 'Payment intent ID is required',
  }),
  orderId: Joi.string().required().messages({
    'string.base': 'Order ID must be a string',
    'any.required': 'Order ID is required',
  }),
});

// Validation schema for payment complete
export const paymentCompleteSchema = Joi.object({
  paymentIntentId: Joi.string().required().messages({
    'string.base': 'Payment intent ID must be a string',
    'any.required': 'Payment intent ID is required',
  }),
  amount: Joi.number().positive().optional(),
  currency: Joi.string().optional(),
  product: Joi.object({
    id: Joi.string().optional(),
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    price: Joi.number().optional(),
  }).optional(),
  customer: Joi.object({
    firstName: Joi.string().trim().min(1).max(50).optional(),
    lastName: Joi.string().trim().min(1).max(50).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().allow('', null).optional(),
    company: Joi.string().allow('', null).optional(),
    country: Joi.string().min(2).max(3).optional(),
    acceptsMarketing: Joi.boolean().optional(),
  }).optional(),
  workspaceId: Joi.string().optional().allow('', null),
  paymentMethod: Joi.string().optional().allow('', null),
});

// Validation schema for creating digital product
export const createDigitalProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required().messages({
    'string.base': 'Product name must be a string',
    'string.empty': 'Product name cannot be empty',
    'string.min': 'Product name must be at least 1 character',
    'string.max': 'Product name cannot exceed 200 characters',
    'any.required': 'Product name is required',
  }),
  description: Joi.string().trim().min(1).max(2000).required().messages({
    'string.base': 'Description must be a string',
    'string.empty': 'Description cannot be empty',
    'string.min': 'Description must be at least 1 character',
    'string.max': 'Description cannot exceed 2000 characters',
    'any.required': 'Description is required',
  }),
  price: Joi.number().positive().required().messages({
    'number.base': 'Price must be a number',
    'number.positive': 'Price must be positive',
    'any.required': 'Price is required',
  }),
  originalPrice: Joi.number().positive().optional().allow(null),
  features: Joi.array().items(Joi.string().trim().min(1)).min(1).required().messages({
    'array.base': 'Features must be an array',
    'array.min': 'At least one feature is required',
    'any.required': 'Features are required',
  }),
  category: Joi.string().trim().min(1).max(100).required().messages({
    'string.base': 'Category must be a string',
    'string.empty': 'Category cannot be empty',
    'string.min': 'Category must be at least 1 character',
    'string.max': 'Category cannot exceed 100 characters',
    'any.required': 'Category is required',
  }),
  image: Joi.string().uri().optional().allow(null, ''),
  fileUrl: Joi.string().optional().allow(null, ''),
  fileSize: Joi.string().optional().allow(null, ''),
  fileType: Joi.string().optional().allow(null, ''),
  downloadLimit: Joi.number().positive().optional().allow(null),
  popular: Joi.boolean().default(false),
  workspace: Joi.string().required().messages({
    'string.base': 'Workspace ID must be a string',
    'any.required': 'Workspace ID is required',
  }),
});

// Validation schema for updating digital product
export const updateDigitalProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().min(1).max(2000).optional(),
  price: Joi.number().positive().optional(),
  originalPrice: Joi.number().positive().optional().allow(null),
  features: Joi.array().items(Joi.string().trim().min(1)).min(1).optional(),
  category: Joi.string().trim().min(1).max(100).optional(),
  image: Joi.string().uri().optional().allow(null, ''),
  fileUrl: Joi.string().optional().allow(null, ''),
  fileSize: Joi.string().optional().allow(null, ''),
  fileType: Joi.string().optional().allow(null, ''),
  downloadLimit: Joi.number().positive().optional().allow(null),
  popular: Joi.boolean().optional(),
  active: Joi.boolean().optional(),
});

// Validation schema for query parameters
export const getDigitalProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  category: Joi.string().optional(),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(0).optional(),
  popular: Joi.string().valid('true', 'false').optional(),
  search: Joi.string().max(200).optional(),
  workspaceId: Joi.string().optional(),
  active: Joi.string().valid('true', 'false').optional(),
  status: Joi.string().valid('pending', 'completed', 'refunded', 'failed').optional(),
  paymentStatus: Joi.string().valid('pending', 'succeeded', 'failed', 'canceled').optional(),
  email: Joi.string().email().optional(),
  orderId: Joi.string().optional(),
});
