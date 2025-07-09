import asyncHandler from '../../middleware/asyncHandler.js';
import NewsletterSignup from '../../models/NewsletterSignup.js';
import AppError from '../../utils/AppError.js';

/**
 * @desc    Create a new newsletter signup
 * @route   POST /api/newsletter/signup
 * @access  Public
 */
const createNewsletterSignup = asyncHandler(async (req, res, next) => {
  console.log('Newsletter signup request received:', {
    email: req.body.email,
    workspaceId: req.body.workspaceId,
    workspaceName: req.body.workspaceName,
    source: req.body.source,
  });

  const { email, workspaceId, workspaceName, source = 'command_page' } = req.body;

  // Validate required fields
  if (!email) {
    console.log('Validation failed: Email is required');
    return next(new AppError('Email is required', 400));
  }

  if (!workspaceId) {
    console.log('Validation failed: Workspace ID is required');
    return next(new AppError('Workspace ID is required', 400));
  }

  if (!workspaceName) {
    console.log('Validation failed: Workspace name is required');
    return next(new AppError('Workspace name is required', 400));
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log('Validation failed: Invalid email format');
    return next(new AppError('Please provide a valid email address', 400));
  }

  console.log('Checking for existing signup...');

  // Check if email is already subscribed to this workspace
  const existingSignup = await NewsletterSignup.findOne({
    email: email.toLowerCase(),
    workspaceId,
  });

  if (existingSignup) {
    console.log('Existing signup found:', {
      id: existingSignup._id,
      status: existingSignup.status,
    });

    if (existingSignup.status === 'unsubscribed') {
      console.log('Reactivating unsubscribed signup...');
      // Reactivate subscription
      existingSignup.status = 'subscribed';
      existingSignup.unsubscribedAt = undefined;
      existingSignup.source = source;
      existingSignup.metadata = {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        referrer: req.get('Referrer'),
        utmSource: req.query.utm_source,
        utmMedium: req.query.utm_medium,
        utmCampaign: req.query.utm_campaign,
      };
      await existingSignup.save();

      console.log('Signup reactivated successfully');

      return res.status(200).json({
        success: true,
        message: 'Welcome back! Your subscription has been reactivated.',
        data: {
          id: existingSignup._id,
          email: existingSignup.email,
          status: existingSignup.status,
          subscribedAt: existingSignup.subscribedAt,
        },
      });
    }

    console.log('Email already subscribed');
    return next(new AppError('Email is already subscribed to this newsletter', 400));
  }

  console.log('Creating new newsletter signup...');

  // Create new newsletter signup
  const newsletterSignup = new NewsletterSignup({
    email: email.toLowerCase(),
    workspaceId,
    workspaceName,
    source,
    metadata: {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      referrer: req.get('Referrer'),
      utmSource: req.query.utm_source,
      utmMedium: req.query.utm_medium,
      utmCampaign: req.query.utm_campaign,
    },
  });

  await newsletterSignup.save();

  console.log('Newsletter signup created successfully:', {
    id: newsletterSignup._id,
    email: newsletterSignup.email,
    status: newsletterSignup.status,
  });

  res.status(201).json({
    success: true,
    message: 'Successfully subscribed to newsletter!',
    data: {
      id: newsletterSignup._id,
      email: newsletterSignup.email,
      status: newsletterSignup.status,
      subscribedAt: newsletterSignup.subscribedAt,
    },
  });
});

export default createNewsletterSignup;
