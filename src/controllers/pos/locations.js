import stripe from '../../config/stripe.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const createLocation = catchAsync(async (req, res, next) => {
  const { displayName, address } = req.body;

  if (!displayName || !address) {
    return next(new AppError('Display name and address are required', 400));
  }

  // Get the Stripe Connect account for this workspace
  const stripeAccount = await StripeConnectAccount.findOne({ workspace: req.workspace._id });
  if (!stripeAccount) {
    return next(new AppError('No Stripe account found for this workspace', 404));
  }

  try {
    const location = await stripe.terminal.locations.create(
      {
        display_name: displayName,
        address: address,
      },
      { stripeAccount: stripeAccount.accountId },
    );

    res.status(201).json({
      success: true,
      data: location,
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

export const listLocations = catchAsync(async (req, res, next) => {
  // Get the Stripe Connect account for this workspace
  const stripeAccount = await StripeConnectAccount.findOne({ workspace: req.workspace._id });
  if (!stripeAccount) {
    return next(new AppError('No Stripe account found for this workspace', 404));
  }

  try {
    const locations = await stripe.terminal.locations.list(
      { limit: 100 },
      { stripeAccount: stripeAccount.accountId },
    );

    res.status(200).json({
      success: true,
      data: locations.data,
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});
