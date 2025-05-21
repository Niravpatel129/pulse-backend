import asyncHandler from '../../middleware/asyncHandler.js';
import Invoice from '../../models/invoiceModel.js';

// @desc    Track payment failure
// @route   POST /api/stripe/payment-failed
// @access  Public
export const paymentFailed = asyncHandler(async (req, res) => {
  const { paymentIntentId, error } = req.body;

  if (!paymentIntentId) {
    return res.status(400).json({
      success: false,
      message: 'Payment intent ID is required',
    });
  }

  try {
    // Find the invoice with this payment intent
    const invoice = await Invoice.findOne({ paymentIntentId });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found for this payment intent',
      });
    }

    // Add a timeline entry for the failed payment
    const failureEntry = {
      type: 'payment_failed',
      timestamp: new Date(),
      description: `Payment attempt failed: ${error?.message || 'Unknown error'}`,
      metadata: {
        paymentId: paymentIntentId,
        errorCode: error?.code || 'unknown',
        errorMessage: error?.message || 'Unknown error',
        declineCode: error?.decline_code || null,
        clientIp: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    };

    invoice.timeline.push(failureEntry);
    await invoice.save();

    res.status(200).json({
      success: true,
      message: 'Payment failure tracked successfully',
    });
  } catch (error) {
    console.error('Error tracking payment failure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track payment failure',
      error: error.message,
    });
  }
});
