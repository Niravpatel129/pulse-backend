import Joi from 'joi';

export const createProjectSchema = Joi.object({
  name: Joi.string().required().trim().min(3).max(100),
  stage: Joi.string().required(),
  status: Joi.string().required(),
  lead: Joi.string().required(),
  client: Joi.array().items(Joi.string()).required(),
  startDate: Joi.date().required(),
  targetDate: Joi.date().min(Joi.ref('startDate')).required(),
  attachments: Joi.array().items(Joi.string()).default([]),
});

export const updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100),
  description: Joi.string().min(10).max(1000),
  status: Joi.string().valid('planning', 'in-progress', 'completed', 'on-hold'),
  startDate: Joi.date(),
  endDate: Joi.date().min(Joi.ref('startDate')).allow(null),
  isActive: Joi.boolean(),
});

export const projectSharingSchema = Joi.object({
  accessType: Joi.string().valid('public', 'signup_required', 'email_restricted').required(),
  passwordProtected: Joi.boolean().required(),
  password: Joi.when('passwordProtected', {
    is: true,
    then: Joi.string().required().min(1),
    otherwise: Joi.string().allow(null, ''),
  }),
});
