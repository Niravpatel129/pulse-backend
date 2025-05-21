import asyncHandler from '../../middleware/asyncHandler.js';
import Invoice from '../../models/invoiceModel.js';
import Payment from '../../models/paymentModel.js';

// @desc    Get timeline data for a specific payment
// @route   GET /api/stripe/payments/:paymentId/timeline
// @access  Private
export const getPaymentTimeline = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  try {
    // Find the payment
    const payment = await Payment.findOne({
      'stripePaymentDetails.id': paymentId,
      workspace: req.workspace._id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    // Find the invoice associated with this payment
    const invoice = await Invoice.findById(payment.invoice).select('timeline invoiceNumber');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found for this payment',
      });
    }

    // Filter timeline entries related to this payment
    const paymentTimeline = invoice.timeline.filter(
      (entry) =>
        (entry.type === 'payment_succeeded' ||
          entry.type === 'payment_failed' ||
          entry.type === 'payment_attempted') &&
        entry.metadata &&
        entry.metadata.paymentId === paymentId,
    );

    // Add the status change entries that happened right after payment
    const relevantStatusChanges = invoice.timeline.filter(
      (entry) =>
        entry.type === 'status_change' &&
        entry.timestamp >= (paymentTimeline[0]?.timestamp || new Date(0)),
    );

    // Combine and sort by timestamp
    const combinedTimeline = [...paymentTimeline, ...relevantStatusChanges].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );

    res.status(200).json({
      success: true,
      data: {
        payment: {
          id: payment._id,
          stripePaymentId: paymentId,
          amount: payment.amount,
          date: payment.date,
          method: payment.method,
          status: payment.status,
        },
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
        },
        timeline: combinedTimeline,
      },
    });
  } catch (error) {
    console.error('Error fetching payment timeline:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment timeline',
      error: error.message,
    });
  }
});
