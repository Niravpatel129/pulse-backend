import DigitalProduct from '../../models/DigitalProduct.js';
import DigitalProductPurchase from '../../models/DigitalProductPurchase.js';
import StripeService from '../../services/stripeService.js';
import AppError from '../../utils/AppError.js';

export const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId, orderId } = req.body;

    if (!paymentIntentId || !orderId) {
      return next(new AppError('Missing payment intent ID or order ID', 400));
    }

    // Find the purchase record
    const purchase = await DigitalProductPurchase.findOne({ orderId }).populate('product');
    if (!purchase) {
      return next(new AppError('Purchase not found', 404));
    }

    // Verify the payment intent matches
    if (purchase.paymentInfo.stripePaymentIntentId !== paymentIntentId) {
      return next(new AppError('Payment intent mismatch', 400));
    }

    // Verify the payment with Stripe
    const paymentIntent = await StripeService.verifyPaymentIntent(
      paymentIntentId,
      purchase.paymentInfo.stripeClientSecret,
    );

    // Update purchase status based on payment status
    if (paymentIntent.status === 'succeeded') {
      purchase.paymentInfo.paymentStatus = 'succeeded';
      purchase.status = 'completed';
      purchase.paymentInfo.paymentMethod = paymentIntent.payment_method || null;

      // Increment download count for the product
      await DigitalProduct.findByIdAndUpdate(purchase.product._id, { $inc: { downloadCount: 1 } });
    } else if (paymentIntent.status === 'canceled') {
      purchase.paymentInfo.paymentStatus = 'canceled';
      purchase.status = 'failed';
    } else if (paymentIntent.status === 'payment_failed') {
      purchase.paymentInfo.paymentStatus = 'failed';
      purchase.status = 'failed';
    }

    await purchase.save();

    res.status(200).json({
      success: true,
      data: {
        orderId: purchase.orderId,
        status: purchase.status,
        paymentStatus: purchase.paymentInfo.paymentStatus,
        downloadToken: purchase.status === 'completed' ? purchase.downloadInfo.downloadToken : null,
        product: {
          id: purchase.product._id,
          name: purchase.product.name,
          description: purchase.product.description,
        },
      },
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    next(new AppError('Failed to confirm payment', 500));
  }
};
