import { v4 as uuidv4 } from 'uuid';
import DigitalProduct from '../../models/DigitalProduct.js';
import DigitalProductPurchase from '../../models/DigitalProductPurchase.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import StripeService from '../../services/stripeService.js';
import AppError from '../../utils/AppError.js';

export const createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, product, customer, workspaceId } = req.body;

    // Validate required fields
    if (!amount || !product || !customer) {
      return next(new AppError('Missing required fields', 400));
    }

    // Validate customer information
    if (!customer.firstName || !customer.lastName || !customer.email) {
      return next(new AppError('Customer information is incomplete', 400));
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      return next(new AppError('Invalid email address', 400));
    }

    // Verify the digital product exists and populate required fields
    const digitalProduct = await DigitalProduct.findById(product.id).populate(
      'workspace',
      'name currency',
    );

    if (!digitalProduct) {
      return next(new AppError('Digital product not found', 404));
    }

    // Verify the product is active
    if (!digitalProduct.active) {
      return next(new AppError('Digital product is not available', 400));
    }

    // Find the connected Stripe account for this workspace
    let stripeAccount = await StripeConnectAccount.findOne({
      workspace: digitalProduct.workspace._id,
    });

    if (!stripeAccount) {
      stripeAccount = '685391158a60a2238461b118';
    }

    if (!stripeAccount) {
      return next(new AppError('Payment processing not available for this product', 400));
    }

    // Verify the price matches (prevent price manipulation)
    const expectedAmount = digitalProduct.price * 100; // Convert to cents
    console.log('🚀 expectedAmount:', expectedAmount);
    console.log('🚀 amount:', amount);

    if (process.env.NODE_ENV !== 'development' && amount !== expectedAmount) {
      return next(new AppError('Invalid amount', 400));
    }

    // Verify workspace has a currency set
    if (!digitalProduct.workspace.currency) {
      return next(new AppError('Workspace currency not configured', 400));
    }

    // Generate unique order ID
    const orderId =
      'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    // Create payment intent with Stripe (transferring to workspace's connected account)
    const paymentIntent = await StripeService.createPaymentIntent(
      amount,
      digitalProduct.workspace.currency, // Use workspace currency
      stripeAccount.accountId, // Use workspace's connected account
      digitalProduct.workspace.name || `Digital Product: ${digitalProduct.name}`,
    );

    // Create purchase record
    const purchase = new DigitalProductPurchase({
      orderId,
      product: digitalProduct._id,
      workspace: workspaceId || digitalProduct.workspace._id,
      customerInfo: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone || null,
        company: customer.company || null,
        country: customer.country || 'US',
        acceptsMarketing: customer.acceptsMarketing || false,
      },
      paymentInfo: {
        amount,
        currency: digitalProduct.workspace.currency,
        stripePaymentIntentId: paymentIntent.id,
        stripeClientSecret: paymentIntent.client_secret,
        paymentStatus: 'pending',
      },
      downloadInfo: {
        downloadToken: uuidv4(),
      },
      status: 'pending',
      metadata: {
        userAgent: req.get('User-Agent') || '',
        ipAddress: req.ip || '',
      },
    });

    await purchase.save();

    // Return the client secret for the frontend
    res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        orderId: orderId,
        amount: amount,
        currency: digitalProduct.workspace.currency,
        product: {
          id: digitalProduct._id,
          name: digitalProduct.name,
          description: digitalProduct.description,
        },
      },
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    next(new AppError('Failed to create payment intent', 500));
  }
};
