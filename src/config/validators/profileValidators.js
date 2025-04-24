import Joi from 'joi';

// Update profile validation schema
export const updateProfile = Joi.object({
  name: Joi.string().min(2).max(50),
  email: Joi.string().email(),
  phone: Joi.string().allow(''),
  jobTitle: Joi.string().max(100).allow(''),
  bio: Joi.string().max(500).allow(''),
  avatar: Joi.string().allow(''),
  createdAt: Joi.date().allow(''),
  notificationPreferences: Joi.object({
    'email-billing': Joi.boolean().required(),
    'email-calendar': Joi.boolean().required(),
    'email-projects': Joi.boolean().required(),
    'email-tasks': Joi.boolean().required(),
  }),
});

// Update password validation schema
export const updatePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});
