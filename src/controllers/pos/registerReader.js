import Stripe from 'stripe';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import StripeTerminalReader from '../../models/StripeTerminalReader.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Register a new BBPOS reader
export const registerReader = catchAsync(async (req, res, next) => {
  const { workspaceId } = req.params;
  const { registrationCode } = req.body;

  if (!registrationCode) {
    return next(new AppError('Registration code is required', 400));
  }

  // Get the Stripe Connect account for this workspace
  const stripeAccount = await StripeConnectAccount.findOne({ workspace: workspaceId });
  if (!stripeAccount) {
    return next(new AppError('No Stripe account found for this workspace', 404));
  }

  try {
    // Register the reader with Stripe
    const reader = await stripe.terminal.readers.create(
      {
        registration_code: registrationCode,
        label: req.body.label || 'New Reader',
      },
      { stripeAccount: stripeAccount.accountId },
    );

    // Create reader in our database
    const terminalReader = await StripeTerminalReader.create({
      workspace: workspaceId,
      stripeAccount: stripeAccount._id,
      accountId: stripeAccount.accountId,
      readerId: reader.id,
      label: reader.label,
      deviceType: reader.device_type,
      status: reader.status,
      serialNumber: reader.serial_number,
      lastSeenAt: new Date(),
    });

    res.status(201).json({
      status: 'success',
      data: terminalReader,
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});
