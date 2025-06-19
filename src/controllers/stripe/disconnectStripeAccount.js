import asyncHandler from '../../middleware/asyncHandler.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';

// @desc    Disconnect Stripe Connect account
// @route   DELETE /api/stripe/connect/disconnect
// @access  Private
export const disconnectStripeAccount = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const workspaceId = req.workspace._id;

  // Find the Stripe Connect account
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

  try {
    // Optionally deactivate the account on Stripe's side
    // Note: Express accounts cannot be deleted, only deactivated
    // We'll keep the account on Stripe but remove it from our database

    // Remove the account from our database
    await StripeConnectAccount.findByIdAndDelete(connectAccount._id);

    res.status(200).json({
      success: true,
      message: 'Stripe Connect account disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Stripe account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect Stripe account',
      error: error.message,
    });
  }
});
