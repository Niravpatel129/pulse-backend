import Stripe from 'stripe';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get connection token for device
export const getConnectionToken = catchAsync(async (req, res, next) => {
  const { workspaceId } = req.params;

  const stripeAccount = await StripeConnectAccount.findOne({ workspace: workspaceId });
  if (!stripeAccount) {
    return next(new AppError('No Stripe account found for this workspace', 404));
  }

  try {
    const connectionToken = await stripe.terminal.connectionTokens.create({
      stripeAccount: stripeAccount.accountId,
    });

    res.status(200).json({
      status: 'success',
      data: {
        secret: connectionToken.secret,
      },
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});
