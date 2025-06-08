import Stripe from 'stripe';
import StripeTerminalReader from '../../models/StripeTerminalReader.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Delete a reader
export const deleteReader = catchAsync(async (req, res, next) => {
  const { readerId } = req.params;

  const reader = await StripeTerminalReader.findOne({
    workspace: req.workspace._id,
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
