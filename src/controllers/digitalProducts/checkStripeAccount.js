import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import AppError from '../../utils/AppError.js';

// Check if workspace can sell digital products
export const checkStripeAccountStatus = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return next(new AppError('Workspace ID is required', 400));
    }

    // Find the connected account for the workspace
    const stripeAccount = await StripeConnectAccount.findOne({
      workspace: workspaceId,
    }).populate('workspace', 'name subdomain');

    if (!stripeAccount) {
      return res.status(200).json({
        success: true,
        data: {
          canSellDigitalProducts: false,
          reason: 'No Stripe account connected',
          requirements: ['Connect a Stripe account to start selling digital products'],
        },
      });
    }

    const canSell = stripeAccount.chargesEnabled && stripeAccount.detailsSubmitted;

    let requirements = [];
    if (!stripeAccount.detailsSubmitted) {
      requirements.push('Complete Stripe account setup');
    }
    if (!stripeAccount.chargesEnabled) {
      requirements.push('Enable charges on your Stripe account');
    }

    res.status(200).json({
      success: true,
      data: {
        canSellDigitalProducts: canSell,
        stripeAccount: {
          id: stripeAccount._id,
          accountId: stripeAccount.accountId,
          status: stripeAccount.status,
          chargesEnabled: stripeAccount.chargesEnabled,
          payoutsEnabled: stripeAccount.payoutsEnabled,
          detailsSubmitted: stripeAccount.detailsSubmitted,
        },
        requirements: requirements,
        workspace: stripeAccount.workspace,
      },
    });
  } catch (error) {
    console.error('Error checking Stripe account status:', error);
    next(new AppError('Failed to check account status', 500));
  }
};
