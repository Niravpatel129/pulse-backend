import StripeTerminalReader from '../../models/StripeTerminalReader.js';
import catchAsync from '../../utils/catchAsync.js';

// List all readers for a workspace
export const listReaders = catchAsync(async (req, res, next) => {
  const { status } = req.query;

  const query = { workspace: req.workspace._id };
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
