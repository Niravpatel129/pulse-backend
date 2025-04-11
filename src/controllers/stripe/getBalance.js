import asyncHandler from '../../middleware/asyncHandler.js';
import StripeService from '../../services/stripeService.js';

// @desc    Get account balance
// @route   GET /api/stripe/balance
// @access  Private
export const getBalance = asyncHandler(async (req, res) => {
  const balance = await StripeService.getBalance();

  res.status(200).json({
    success: true,
    data: balance,
  });
});
