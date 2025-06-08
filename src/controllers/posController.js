import Stripe from 'stripe';
import StripeConnectAccount from '../models/StripeConnectAccount.js';
import StripeTerminalReader from '../models/StripeTerminalReader.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

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

// List all readers for a workspace
export const listReaders = catchAsync(async (req, res, next) => {
  const { workspaceId } = req.params;
  const { status } = req.query;

  const query = { workspace: workspaceId };
  if (status) {
    query.status = status;
  }

  const readers = await StripeTerminalReader.find(query)
    .sort({ lastSeenAt: -1 })
    .populate('stripeAccount', 'accountId');

  res.status(200).json({
    status: 'success',
    results: readers.length,
    data: readers,
  });
});

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

// Update reader label
export const updateReader = catchAsync(async (req, res, next) => {
  const { workspaceId, readerId } = req.params;
  const { label } = req.body;

  if (!label) {
    return next(new AppError('Label is required', 400));
  }

  const reader = await StripeTerminalReader.findOne({
    workspace: workspaceId,
    readerId,
  });

  if (!reader) {
    return next(new AppError('Reader not found', 404));
  }

  try {
    // Update label in Stripe
    await stripe.terminal.readers.update(
      readerId,
      { label },
      {
        stripeAccount: reader.accountId,
      },
    );

    // Update our database
    reader.label = label;
    await reader.save();

    res.status(200).json({
      status: 'success',
      data: reader,
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

// Delete a reader
export const deleteReader = catchAsync(async (req, res, next) => {
  const { workspaceId, readerId } = req.params;

  const reader = await StripeTerminalReader.findOne({
    workspace: workspaceId,
    readerId,
  });

  if (!reader) {
    return next(new AppError('Reader not found', 404));
  }

  try {
    // Delete from Stripe
    await stripe.terminal.readers.del(readerId, {
      stripeAccount: reader.accountId,
    });

    // Delete from our database
    await reader.deleteOne();

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

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
