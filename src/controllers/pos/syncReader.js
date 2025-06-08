import Stripe from 'stripe';
import StripeTerminalReader from '../../models/StripeTerminalReader.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Sync a single reader with Stripe
export const syncReader = catchAsync(async (req, res, next) => {
  const { workspaceId, readerId } = req.params;

  const reader = await StripeTerminalReader.findOne({
    workspace: workspaceId,
    readerId,
  });

  if (!reader) {
    return next(new AppError('Reader not found', 404));
  }

  try {
    // Get latest reader data from Stripe
    const stripeReader = await stripe.terminal.readers.retrieve(readerId, {
      stripeAccount: reader.accountId,
    });

    // Update our database
    reader.status = stripeReader.status;
    reader.lastSeenAt = new Date();
    reader.batteryLevel = stripeReader.battery_level;
    reader.firmwareVersion = stripeReader.firmware_version;
    await reader.save();

    res.status(200).json({
      status: 'success',
      data: reader,
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});
