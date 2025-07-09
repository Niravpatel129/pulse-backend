import asyncHandler from '../../middleware/asyncHandler.js';
import NewsletterSignup from '../../models/NewsletterSignup.js';
import AppError from '../../utils/AppError.js';

/**
 * @desc    Unsubscribe from newsletter
 * @route   POST /api/newsletter/unsubscribe
 * @access  Public
 */
const unsubscribeNewsletter = asyncHandler(async (req, res, next) => {
  const { email, workspaceId } = req.body;

  // Validate required fields
  if (!email) {
    return next(new AppError('Email is required', 400));
  }

  if (!workspaceId) {
    return next(new AppError('Workspace ID is required', 400));
  }

  // Find the subscription
  const subscription = await NewsletterSignup.findOne({
    email: email.toLowerCase(),
    workspaceId,
  });

  if (!subscription) {
    return next(new AppError('Subscription not found', 404));
  }

  if (subscription.status === 'unsubscribed') {
    return res.status(200).json({
      success: true,
      message: 'You are already unsubscribed from this newsletter.',
    });
  }

  // Unsubscribe
  await subscription.unsubscribe();

  res.status(200).json({
    success: true,
    message: 'Successfully unsubscribed from newsletter.',
    data: {
      id: subscription._id,
      email: subscription.email,
      status: subscription.status,
      unsubscribedAt: subscription.unsubscribedAt,
    },
  });
});

export default unsubscribeNewsletter;
