import asyncHandler from '../../middleware/asyncHandler.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import StripeService from '../../services/stripeService.js';

// @desc    Create account link for onboarding
// @route   POST /api/stripe/connect/create-account-link
// @access  Private
export const createStripeAccountLink = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const workspaceId = req.workspace._id;

  // Get the Stripe Connect account
  const connectAccount = await StripeConnectAccount.findOne({
    user: userId,
    workspace: workspaceId,
  });

  if (!connectAccount) {
    return res.status(404).json({
      success: false,
      message: 'No Stripe Connect account found',
    });
  }

  // Use URLs from frontend if provided, otherwise use environment variables
  const refreshUrl = req.query.refreshUrl || `https://${process.env.FRONTEND_URL}/invoices/refresh`;
  const returnUrl =
    req.query.redirectUrl ||
    req.query.returnUrl ||
    `https://${process.env.FRONTEND_URL}/invoices/return`;

  // Create account link using the service
  const accountLink = await StripeService.createAccountLink(
    connectAccount.accountId,
    refreshUrl,
    returnUrl,
  );

  res.status(200).json({
    success: true,
    data: accountLink,
  });
});
