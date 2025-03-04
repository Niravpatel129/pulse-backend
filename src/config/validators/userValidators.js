import Joi from 'joi';

export const createUser = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Name is required',
    'any.required': 'Name is required',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email',
    'string.empty': 'Email is required',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
});

export const updateUser = Joi.object({
  name: Joi.string().messages({
    'string.empty': 'Name cannot be empty',
  }),
  email: Joi.string().email().messages({
    'string.email': 'Please enter a valid email',
    'string.empty': 'Email cannot be empty',
  }),
  password: Joi.string().min(6).messages({
    'string.min': 'Password must be at least 6 characters long',
    'string.empty': 'Password cannot be empty',
  }),
});
