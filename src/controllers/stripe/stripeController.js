import asyncHandler from '../../middleware/asyncHandler.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import User from '../../models/User.js';
import StripeService from '../../services/stripeService.js';

// Helper function to format URL
const formatUrl = (url) => {
  if (!url) {
    throw new Error('Frontend URL is required');
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
};

// Helper function to get workspace URL
const getWorkspaceUrl = (req) => {
  // Get the host from the request
  const host = req.headers.host;
  const protocol = req.protocol || 'https';

  // If we have a subdomain in the host, use it
  if (host && host.includes('.')) {
    return `${protocol}://${host}`;
  }

  // Fallback to workspace subdomain if available
  if (req.workspace?.subdomain) {
    const baseUrl = formatUrl(process.env.FRONTEND_URL);
    const domain = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${req.workspace.subdomain}.${domain}`;
  }

  throw new Error('Could not determine workspace URL');
};

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
  const refreshUrl = `${workspaceUrl}/stripe/refresh`;
  const returnUrl = `${workspaceUrl}/stripe/onboard`;

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

  // Create account link using the service
  const accountLink = await StripeService.createAccountLink(
    connectAccount.accountId,
    `${process.env.FRONTEND_URL}/invoices/refresh`,
    `${process.env.FRONTEND_URL}/invoices/return`,
  );

  res.status(200).json({
    success: true,
    data: accountLink,
  });
});

// @desc    Get Stripe Connect account status
// @route   GET /api/stripe/connect/account-status
// @access  Private
export const getStripeAccountStatus = asyncHandler(async (req, res) => {
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

  // Get latest account details from Stripe using the service
  const accountDetails = await StripeService.getAccountDetails(connectAccount.accountId);

  // Update local account status
  connectAccount.chargesEnabled = accountDetails.charges_enabled;
  connectAccount.payoutsEnabled = accountDetails.payouts_enabled;
  connectAccount.detailsSubmitted = accountDetails.details_submitted;
  connectAccount.requirements = accountDetails.requirements.currently_due;
  connectAccount.status = accountDetails.requirements.disabled_reason || 'active';
  await connectAccount.save();

  res.status(200).json({
    success: true,
    data: connectAccount,
  });
});

// @desc    Create a payment intent
// @route   POST /api/stripe/payment-intent
// @access  Private
export const createPaymentIntent = asyncHandler(async (req, res) => {
  const { amount, currency, connectedAccountId } = req.body;
  const userId = req.user.userId;
  const workspaceId = req.workspace._id;

  // Verify the connected account exists and belongs to the user
  const connectAccount = await StripeConnectAccount.findOne({
    user: userId,
    workspace: workspaceId,
    accountId: connectedAccountId,
  });

  if (!connectAccount) {
    return res.status(404).json({
      success: false,
      message: 'No valid Stripe Connect account found',
    });
  }

  // Create payment intent using the service
  const paymentIntent = await StripeService.createPaymentIntent(
    amount,
    currency,
    connectedAccountId,
  );

  res.status(201).json({
    success: true,
    data: paymentIntent,
  });
});

// @desc    Get account balance
// @route   GET /api/stripe/balance
// @access  Private
export const getBalance = asyncHandler(async (req, res) => {
  const balance = await StripeService.getBalance();

  res.status(200).json({
    success: true,
    data: balance,
  });
});
