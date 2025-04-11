import asyncHandler from '../../middleware/asyncHandler.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import StripeService from '../../services/stripeService.js';

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
