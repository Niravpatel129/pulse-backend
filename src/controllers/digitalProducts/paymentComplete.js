import DigitalProduct from '../../models/DigitalProduct.js';
import DigitalProductPurchase from '../../models/DigitalProductPurchase.js';
import StripeService from '../../services/stripeService.js';
import AppError from '../../utils/AppError.js';

export const paymentComplete = async (req, res, next) => {
  try {
    const { paymentIntentId, amount, currency, product, customer, workspaceId, paymentMethod } =
      req.body;

    if (!paymentIntentId) {
      return next(new AppError('Missing payment intent ID', 400));
    }

    // Find the purchase record by payment intent ID
    const purchase = await DigitalProductPurchase.findOne({
      'paymentInfo.stripePaymentIntentId': paymentIntentId,
    }).populate('product');

    if (!purchase) {
      return next(new AppError('Purchase not found', 404));
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
      purchase.paymentInfo.paymentMethod = paymentMethod || paymentIntent.payment_method || null;

      // Update any additional customer info if provided
      if (customer) {
        if (customer.firstName) purchase.customerInfo.firstName = customer.firstName;
        if (customer.lastName) purchase.customerInfo.lastName = customer.lastName;
        if (customer.email) purchase.customerInfo.email = customer.email;
        if (customer.phone) purchase.customerInfo.phone = customer.phone;
        if (customer.company) purchase.customerInfo.company = customer.company;
        if (customer.country) purchase.customerInfo.country = customer.country;
        if (typeof customer.acceptsMarketing === 'boolean') {
          purchase.customerInfo.acceptsMarketing = customer.acceptsMarketing;
        }
      }

      // Increment download count for the product
      await DigitalProduct.findByIdAndUpdate(purchase.product._id, { $inc: { downloadCount: 1 } });
    } else if (paymentIntent.status === 'canceled') {
      purchase.paymentInfo.paymentStatus = 'canceled';
      purchase.status = 'failed';
    } else if (paymentIntent.status === 'payment_failed') {
      purchase.paymentInfo.paymentStatus = 'failed';
      purchase.status = 'failed';
    } else {
      // Handle other statuses (processing, requires_action, etc.)
      purchase.paymentInfo.paymentStatus = paymentIntent.status;
      purchase.status = 'pending';
    }

    await purchase.save();

    res.status(200).json({
      success: true,
      data: {
        orderId: purchase.orderId,
        order_id: purchase._id, // MongoDB document ID
        status: purchase.status,
        paymentStatus: purchase.paymentInfo.paymentStatus,
        downloadToken: purchase.status === 'completed' ? purchase.downloadInfo.downloadToken : null,
        product: {
          id: purchase.product._id,
          name: purchase.product.name,
          description: purchase.product.description,
        },
        customer: purchase.customerInfo,
      },
    });
  } catch (error) {
    console.error('Error completing payment:', error);
    next(new AppError('Failed to complete payment', 500));
  }
};
