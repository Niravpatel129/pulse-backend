import Joi from 'joi';

export const sendInboxEmail = Joi.object({
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
  threadId: Joi.string().allow(null, ''),
  inReplyTo: Joi.string().allow(null, ''),
  references: Joi.array().items(Joi.string()).allow(null, ''),
}).unknown(true);
