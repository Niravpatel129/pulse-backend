import Stripe from 'stripe';
import StripeTerminalReader from '../../models/StripeTerminalReader.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
