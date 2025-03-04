import Joi from 'joi';

export const createProductSchema = Joi.object({
  name: Joi.string().required().trim().min(3).max(100),
  description: Joi.string().required().min(10).max(1000),
  price: Joi.number().required().min(0),
  category: Joi.string().required().trim(),
  stock: Joi.number().min(0).default(0),
  isActive: Joi.boolean().default(true),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100),
  description: Joi.string().min(10).max(1000),
  price: Joi.number().min(0),
  category: Joi.string().trim(),
  stock: Joi.number().min(0),
  isActive: Joi.boolean(),
});
