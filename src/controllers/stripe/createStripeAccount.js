import asyncHandler from '../../middleware/asyncHandler.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import User from '../../models/User.js';
import StripeService from '../../services/stripeService.js';
import { getWorkspaceUrl } from './helpers/urlHelpers.js';

// @desc    Create a Stripe Connect account and return onboarding URL
// @route   POST /api/stripe/connect/create-account
// @access  Private
export const createStripeAccount = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const workspaceId = req.workspace._id;

  // find user
  const type = 'express';
  const user = await User.findById(userId);
  const email = user.email;

  // Get workspace URL from request host
  const workspaceUrl = getWorkspaceUrl(req);
  const refreshUrl = `${workspaceUrl}/invoices/refresh`;
  const returnUrl = `${workspaceUrl}/invoices/return`;

  console.log('Request Host:', req.headers.host);
  console.log('Workspace URL:', workspaceUrl);
  console.log('Return URL:', returnUrl);
  console.log('Refresh URL:', refreshUrl);

  // Check if user already has a Stripe Connect account
  const existingAccount = await StripeConnectAccount.findOne({
    user: userId,
    workspace: workspaceId,
  });

  if (existingAccount) {
    // If account exists, create a new account link for onboarding
    const accountLink = await StripeService.createAccountLink(
      existingAccount.accountId,
      refreshUrl,
      returnUrl,
    );

    return res.status(200).json({
      success: true,
      data: {
        account: existingAccount,
        onboardingUrl: accountLink.url,
      },
    });
  }

  // Create Stripe Connect account using the service
  const stripeAccount = await StripeService.createConnectAccount(email);

  // Save account details to database
  const connectAccount = await StripeConnectAccount.create({
    user: userId,
    workspace: workspaceId,
    accountId: stripeAccount.id,
    email,
    type,
  });

  // Create account link for onboarding
  const accountLink = await StripeService.createAccountLink(
    connectAccount.accountId,
    refreshUrl,
    returnUrl,
  );

  res.status(201).json({
    success: true,
    data: {
      account: connectAccount,
      onboardingUrl: accountLink.url,
    },
  });
});
