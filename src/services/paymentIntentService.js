import Invoice2 from '../models/invoice2.js';
import PaymentIntent from '../models/PaymentIntent.js';
import Payment from '../models/paymentModel.js';

class PaymentIntentService {
  /**
   * Create a new payment intent record
   */
  static async createPaymentIntentRecord(data) {
    const paymentIntent = new PaymentIntent(data);
    await paymentIntent.save();
    return paymentIntent;
  }

  /**
   * Find payment intent by Stripe ID or database ID
   */
  static async findPaymentIntent(id) {
    return await PaymentIntent.findOne({
      $or: [{ stripePaymentIntentId: id }, { _id: id }],
    }).populate('invoice workspace customer.id');
  }

  /**
   * Find all payment intents for an invoice
   */
  static async findPaymentIntentsForInvoice(invoiceId, options = {}) {
    const { status, limit = 50, page = 1, sort = { createdAt: -1 } } = options;

    const query = { invoice: invoiceId };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [paymentIntents, total] = await Promise.all([
      PaymentIntent.find(query)
        .populate('customer.id')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      PaymentIntent.countDocuments(query),
    ]);

    return {
      paymentIntents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update payment intent status
   */
  static async updatePaymentIntentStatus(paymentIntentId, status, reason = null, metadata = {}) {
    const paymentIntent = await this.findPaymentIntent(paymentIntentId);

    if (!paymentIntent) {
      throw new Error('Payment intent not found');
    }

    if (status !== paymentIntent.status) {
      paymentIntent.status = status;

      paymentIntent.statusHistory.push({
        status,
        timestamp: new Date(),
        reason: reason || 'Status updated',
        metadata,
      });

      // Handle specific status changes
      if (status === 'succeeded') {
        await this.handlePaymentSuccess(paymentIntent);
      }

      if (status === 'canceled') {
        paymentIntent.canceledAt = new Date();
        paymentIntent.cancellationReason = metadata.cancellationReason || 'requested_by_customer';
      }

      await paymentIntent.save();
    }

    return paymentIntent;
  }

  /**
   * Handle successful payment
   */
  static async handlePaymentSuccess(paymentIntent) {
    paymentIntent.used = true;

    // Calculate payment number and remaining balance
    const existingPayments = await Payment.find({ invoice: paymentIntent.invoice._id });
    const paymentNumber = existingPayments.length + 1;

    // Calculate remaining balance (this is simplified - you might want more complex logic)
    const invoice = await Invoice2.findById(paymentIntent.invoice._id);
    const totalPaid = existingPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = Math.max(
      0,
      invoice.totals.total - totalPaid - paymentIntent.amount / 100,
    );

    // Create payment record
    const payment = new Payment({
      invoice: paymentIntent.invoice._id,
      amount: paymentIntent.amount / 100, // Convert from cents
      date: new Date(),
      method: 'stripe',
      memo: `Payment via Stripe - ${paymentIntent.paymentType}`,
      workspace: paymentIntent.workspace._id,
      createdBy: paymentIntent.createdBy,
      paymentNumber,
      remainingBalance,
      status: 'completed',
      type: paymentIntent.isDeposit ? 'deposit' : 'payment',
      stripePaymentDetails: {
        paymentIntentId: paymentIntent.stripePaymentIntentId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.paymentMethod,
      },
      receipt: {
        number: `RCP-${Date.now()}-${paymentNumber}`,
        type: paymentIntent.isDeposit ? 'deposit_receipt' : 'payment_receipt',
        date: new Date(),
        status: 'generated',
      },
      metadata: {
        isDeposit: paymentIntent.isDeposit,
        depositPercentage: paymentIntent.depositPercentage,
        currency: paymentIntent.currency,
        paymentMethod: {
          type: 'credit_card',
          details: paymentIntent.paymentMethod || {},
        },
      },
    });

    await payment.save();
    paymentIntent.payment = payment._id;

    // Update invoice status if needed
    if (remainingBalance === 0) {
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.statusHistory.push({
        status: 'paid',
        changedAt: new Date(),
        reason: 'Invoice fully paid',
      });
      await invoice.save();
    } else if (paymentIntent.isDeposit) {
      invoice.status = 'partially_paid';
      invoice.depositPaidAt = new Date();
      invoice.depositPaymentAmount = paymentIntent.amount / 100;
      invoice.statusHistory.push({
        status: 'partially_paid',
        changedAt: new Date(),
        reason: 'Deposit paid',
      });
      await invoice.save();
    }
  }

  /**
   * Add payment attempt to payment intent
   */
  static async addPaymentAttempt(paymentIntentId, status, error = null, paymentMethodId = null) {
    const paymentIntent = await this.findPaymentIntent(paymentIntentId);

    if (!paymentIntent) {
      throw new Error('Payment intent not found');
    }

    await paymentIntent.addPaymentAttempt(status, error, paymentMethodId);
    return paymentIntent;
  }

  /**
   * Add webhook event to payment intent
   */
  static async addWebhookEvent(paymentIntentId, eventId, eventType) {
    const paymentIntent = await this.findPaymentIntent(paymentIntentId);

    if (!paymentIntent) {
      throw new Error('Payment intent not found');
    }

    await paymentIntent.addWebhookEvent(eventId, eventType);
    return paymentIntent;
  }

  /**
   * Mark webhook event as processed
   */
  static async markWebhookProcessed(paymentIntentId, eventId) {
    const paymentIntent = await this.findPaymentIntent(paymentIntentId);

    if (!paymentIntent) {
      throw new Error('Payment intent not found');
    }

    await paymentIntent.markWebhookProcessed(eventId);
    return paymentIntent;
  }

  /**
   * Get payment intent statistics for a workspace
   */
  static async getWorkspaceStats(workspaceId, options = {}) {
    const { startDate, endDate } = options;

    const query = { workspace: workspaceId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [
      totalPaymentIntents,
      successfulPaymentIntents,
      failedPaymentIntents,
      canceledPaymentIntents,
      totalAmount,
      successfulAmount,
    ] = await Promise.all([
      PaymentIntent.countDocuments(query),
      PaymentIntent.countDocuments({ ...query, status: 'succeeded' }),
      PaymentIntent.countDocuments({ ...query, status: 'failed' }),
      PaymentIntent.countDocuments({ ...query, status: 'canceled' }),
      PaymentIntent.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentIntent.aggregate([
        { $match: { ...query, status: 'succeeded' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    return {
      totalPaymentIntents,
      successfulPaymentIntents,
      failedPaymentIntents,
      canceledPaymentIntents,
      successRate:
        totalPaymentIntents > 0 ? (successfulPaymentIntents / totalPaymentIntents) * 100 : 0,
      totalAmount: totalAmount[0]?.total || 0,
      successfulAmount: successfulAmount[0]?.total || 0,
    };
  }

  /**
   * Get payment intent statistics for an invoice
   */
  static async getInvoiceStats(invoiceId) {
    const [
      totalPaymentIntents,
      successfulPaymentIntents,
      failedPaymentIntents,
      totalAmount,
      successfulAmount,
    ] = await Promise.all([
      PaymentIntent.countDocuments({ invoice: invoiceId }),
      PaymentIntent.countDocuments({ invoice: invoiceId, status: 'succeeded' }),
      PaymentIntent.countDocuments({ invoice: invoiceId, status: 'failed' }),
      PaymentIntent.aggregate([
        { $match: { invoice: invoiceId } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentIntent.aggregate([
        { $match: { invoice: invoiceId, status: 'succeeded' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    return {
      totalPaymentIntents,
      successfulPaymentIntents,
      failedPaymentIntents,
      successRate:
        totalPaymentIntents > 0 ? (successfulPaymentIntents / totalPaymentIntents) * 100 : 0,
      totalAmount: totalAmount[0]?.total || 0,
      successfulAmount: successfulAmount[0]?.total || 0,
    };
  }

  /**
   * Clean up expired payment intents
   */
  static async cleanupExpiredPaymentIntents() {
    const expiredPaymentIntents = await PaymentIntent.find({
      expiresAt: { $lt: new Date() },
      status: { $nin: ['succeeded', 'canceled'] },
      used: false,
    });

    for (const paymentIntent of expiredPaymentIntents) {
      paymentIntent.status = 'canceled';
      paymentIntent.canceledAt = new Date();
      paymentIntent.cancellationReason = 'expired';
      paymentIntent.statusHistory.push({
        status: 'canceled',
        timestamp: new Date(),
        reason: 'Payment intent expired',
      });
      await paymentIntent.save();
    }

    return expiredPaymentIntents.length;
  }
}

export default PaymentIntentService;
