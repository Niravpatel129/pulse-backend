import Joi from 'joi';

export const sendEmail = Joi.object({
  to: Joi.array().items(Joi.string().email()).min(1).required().messages({
    'array.min': 'At least one recipient is required',
    'array.base': 'Recipients must be an array',
    'string.email': 'Please enter valid email addresses',
  }),
  cc: Joi.array().items(Joi.string().email()).allow(null, '').default([]).messages({
    'array.base': 'CC must be an array',
    'string.email': 'Please enter valid email addresses',
  }),
  bcc: Joi.array().items(Joi.string().email()).allow(null, '').default([]).messages({
    'array.base': 'BCC must be an array',
    'string.email': 'Please enter valid email addresses',
  }),
  subject: Joi.string().required().messages({
    'string.empty': 'Subject is required',
    'any.required': 'Subject is required',
  }),
  body: Joi.string().required().messages({
    'string.empty': 'Message body is required',
    'any.required': 'Message body is required',
  }),
  projectId: Joi.string().required().messages({
    'string.empty': 'Project ID is required',
    'any.required': 'Project ID is required',
  }),
  attachments: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        size: Joi.number().required(),
        type: Joi.string().required(),
        url: Joi.string().required(),
      }),
    )
    .allow(null, '')
    .default([]),
});

export const saveTemplate = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Template name is required',
    'any.required': 'Template name is required',
  }),
  subject: Joi.string().required().messages({
    'string.empty': 'Subject is required',
    'any.required': 'Subject is required',
  }),
  body: Joi.string().required().messages({
    'string.empty': 'Message body is required',
    'any.required': 'Message body is required',
  }),
  projectId: Joi.string().required().messages({
    'string.empty': 'Project ID is required',
    'any.required': 'Project ID is required',
  }),
  variables: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().required(),
        description: Joi.string(),
      }),
    )
    .allow(null, '')
    .default([]),
});
