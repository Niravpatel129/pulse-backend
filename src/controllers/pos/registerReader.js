import Stripe from 'stripe';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import StripeTerminalReader from '../../models/StripeTerminalReader.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Register a new BBPOS reader
export const registerReader = catchAsync(async (req, res, next) => {
  const { registrationCode, label = 'New Reader' } = req.body;

  if (!registrationCode) {
    return next(new AppError('Registration code is required', 400));
  }

  // Get the Stripe Connect account for this workspace
  const stripeAccount = await StripeConnectAccount.findOne({ workspace: req.workspace._id });
  if (!stripeAccount) {
    return next(new AppError('No Stripe account found for this workspace', 404));
  }

  try {
    // Register the reader with Stripe
    const reader = await stripe.terminal.readers.create(
      {
        registration_code: registrationCode,
        label,
      },
      { stripeAccount: stripeAccount.accountId },
    );

    // Create reader in our database
    const terminalReader = await StripeTerminalReader.create({
      workspace: req.workspace._id,
      stripeAccount: stripeAccount.accountId,
      readerId: reader.id,
      label: reader.label,
      deviceType: reader.device_type,
      status: reader.status,
      serialNumber: reader.serial_number || '',
      ipAddress: reader.ip_address || '',
      locationId: reader.location || '',
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
