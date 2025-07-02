import asyncHandler from '../../middleware/asyncHandler.js';
import GmailIntegration from '../../models/GmailIntegration.js';
import Invoice2 from '../../models/invoice2.js';
import Payment from '../../models/paymentModel.js';
import Workspace from '../../models/Workspace.js';
import { paymentNotification } from '../../services/emailTemplates/paymentNotification.js';
import StripeService from '../../services/stripeService.js';
import { sendGmailEmail } from '../../utils/gmailApi.js';

// Helper function to handle decimal comparisons
const isAmountEqual = (amount1, amount2) => {
  const rounded1 = Math.round(amount1 * 100) / 100;
  const rounded2 = Math.round(amount2 * 100) / 100;
  return Math.abs(rounded1 - rounded2) < 0.01;
};

// Helper function to round to 2 decimal places
const roundToTwoDecimals = (amount) => {
  return Math.round(amount * 100) / 100;
};

// @desc    Handle successful payment for an invoice
// @route   POST /api/invoices2/:id/payment-success
// @access  Public
export const handlePaymentSuccess = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentIntent, paymentIntentClientSecret } = req.body;

  if (!paymentIntent || !paymentIntentClientSecret) {
    return res.status(400).json({
      success: false,
      message: 'Payment intent and client secret are required',
    });
  }

  // Find the invoice
  const invoice = await Invoice2.findById(id).populate('customer.id');

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice not found',
    });
  }

  // Verify the payment with Stripe
  const paymentIntentDetails = await StripeService.verifyPaymentIntent(
    paymentIntent,
    paymentIntentClientSecret,
  );

  if (paymentIntentDetails.status !== 'succeeded') {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed',
    });
  }

  // Verify the payment intent matches
  if (invoice.paymentIntentId !== paymentIntent) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment intent for this invoice',
    });
  }

  const paymentAmount = roundToTwoDecimals(paymentIntentDetails.amount / 100);
  const invoiceTotal = roundToTwoDecimals(invoice.totals.total);

  // Validate payment amount
  if (paymentAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment amount',
    });
  }

  // Determine payment type and status
  const isFullPayment = isAmountEqual(paymentAmount, invoiceTotal);
  const isDepositPayment =
    invoice.settings.deposit.enabled &&
    isAmountEqual(paymentAmount, (invoiceTotal * invoice.settings.deposit.percentage) / 100);

  // Validate deposit payment
  if (isDepositPayment && !invoice.settings.deposit.enabled) {
    return res.status(400).json({
      success: false,
      message: 'Deposit payments are not enabled for this invoice',
    });
  }

  // Get existing payments to calculate payment number and remaining balance
  const existingPayments = await Payment.find({ invoice: invoice._id })
    .sort({ paymentNumber: -1 })
    .limit(1);

  const paymentNumber = existingPayments.length > 0 ? existingPayments[0].paymentNumber + 1 : 1;
  const previousPayment = existingPayments.length > 0 ? existingPayments[0]._id : null;

  // Calculate remaining balance and payment sequence
  const totalPaid = roundToTwoDecimals(
    existingPayments.reduce((sum, payment) => {
      if (payment.type === 'payment' || payment.type === 'deposit') {
        return sum + payment.amount;
      }
      return sum;
    }, 0) + paymentAmount,
  );

  const remainingBalance = roundToTwoDecimals(Math.max(0, invoiceTotal - totalPaid));

  // Determine new status based on payment type and current status
  let newStatus = invoice.status;
  if (isFullPayment || isAmountEqual(remainingBalance, 0)) {
    newStatus = 'paid';
  } else if (isDepositPayment) {
    newStatus = 'partially_paid';
  } else if (paymentAmount > 0) {
    newStatus = 'partially_paid';
  }

  // Add status change to history
  const statusChangeEntry = {
    status: newStatus,
    changedAt: new Date(),
    reason: isFullPayment
      ? `Payment of ${paymentAmount} ${paymentIntentDetails.currency.toUpperCase()} received - Invoice paid in full`
      : isDepositPayment
      ? `Deposit payment of ${paymentAmount} ${paymentIntentDetails.currency.toUpperCase()} received`
      : `Partial payment of ${paymentAmount} ${paymentIntentDetails.currency.toUpperCase()} received`,
  };

  invoice.statusHistory.push(statusChangeEntry);

  // Update invoice status and payment details
  invoice.status = newStatus;
  if (isDepositPayment) {
    invoice.depositPaidAt = new Date();
    invoice.depositPaymentAmount = paymentAmount;
  }
  if (isFullPayment) {
    invoice.paidAt = new Date();
    invoice.paidBy = req.user?.userId || null;
  }
  invoice.statusChangedAt = new Date();
  await invoice.save();

  // Generate receipt number
  const receiptNumber = `RCP-${invoice.invoiceNumber}-${paymentNumber.toString().padStart(3, '0')}`;

  // Determine payment method type from Stripe details
  const paymentMethodType = paymentIntentDetails.payment_method_types?.[0] || 'credit_card';
  const normalizedPaymentMethod = paymentMethodType === 'card' ? 'credit_card' : paymentMethodType;

  // Create a payment record
  const payment = await Payment.create({
    invoice: invoice._id,
    amount: paymentAmount,
    date: new Date(paymentIntentDetails.created * 1000),
    method: normalizedPaymentMethod,
    workspace: invoice.workspace,
    createdBy: invoice.createdBy,
    paymentNumber,
    previousPayment,
    remainingBalance,
    type: isDepositPayment ? 'deposit' : 'payment',
    status: 'completed',
    memo: isDepositPayment
      ? `Deposit payment of ${paymentAmount} ${paymentIntentDetails.currency.toUpperCase()} (${
          invoice.settings.deposit.percentage
        }%)`
      : `Payment of ${paymentAmount} ${paymentIntentDetails.currency.toUpperCase()}`,
    // Add receipt information
    receipt: {
      number: receiptNumber,
      type: isDepositPayment ? 'deposit_receipt' : 'payment_receipt',
      date: new Date(),
      status: 'generated',
    },
    // Add metadata
    metadata: {
      isDeposit: isDepositPayment,
      depositPercentage: isDepositPayment ? invoice.settings.deposit.percentage : null,
      depositDueDate: isDepositPayment ? invoice.settings.deposit.dueDate : null,
      paymentSequence: {
        number: paymentNumber,
        total: existingPayments.length + 1,
        isFinal: remainingBalance === 0,
      },
      currency: paymentIntentDetails.currency.toUpperCase(),
      paymentMethod: {
        type: normalizedPaymentMethod,
        details: {
          stripePaymentMethodId: paymentIntentDetails.payment_method,
          stripePaymentIntentId: paymentIntent,
          last4: paymentIntentDetails.payment_method_details?.card?.last4,
          brand: paymentIntentDetails.payment_method_details?.card?.brand,
          expMonth: paymentIntentDetails.payment_method_details?.card?.exp_month,
          expYear: paymentIntentDetails.payment_method_details?.card?.exp_year,
        },
      },
    },
    stripePaymentDetails: {
      id: paymentIntent,
      amount: paymentIntentDetails.amount,
      amount_received: paymentIntentDetails.amount_received,
      application_fee_amount: paymentIntentDetails.application_fee_amount,
      currency: paymentIntentDetails.currency,
      payment_method: paymentIntentDetails.payment_method,
      payment_method_types: paymentIntentDetails.payment_method_types,
      status: paymentIntentDetails.status,
      transfer_data: paymentIntentDetails.transfer_data,
      transfer_group: paymentIntentDetails.transfer_group,
      latest_charge: paymentIntentDetails.latest_charge,
    },
  });

  // Send payment notifications
  if (payment.type === 'payment' || payment.type === 'deposit') {
    // Send notifications asynchronously - don't wait for completion
    sendPaymentNotificationViaGmail(payment, invoice, req.workspace._id).catch((err) =>
      console.error('Error sending payment notification via Gmail:', err),
    );
  }

  res.status(200).json({
    success: true,
    message: 'Payment processed successfully',
    data: {
      invoice,
      payment,
      paymentIntent: paymentIntentDetails,
      remainingBalance,
      receipt: {
        number: receiptNumber,
        type: payment.receipt.type,
        date: payment.receipt.date,
      },
    },
  });
});

// Helper function to send payment notifications via Gmail
const sendPaymentNotificationViaGmail = async (payment, invoice, workspaceId) => {
  try {
    // Get workspace information
    const workspace = await Workspace.findById(workspaceId).select('name members logo');
    if (!workspace) {
      console.log('Workspace not found for payment notification');
      return;
    }

    // Get Gmail integration for the workspace (primary integration)
    const gmailIntegration = await GmailIntegration.findOne({
      workspace: workspaceId,
      isActive: true,
      isPrimary: true,
    });

    if (!gmailIntegration) {
      console.log('No active Gmail integration found for workspace');
      return;
    }

    // Check if token needs refresh
    if (new Date() >= gmailIntegration.tokenExpiry) {
      console.log('Gmail token expired, skipping notification');
      return;
    }

    // Create Gmail client
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    oauth2Client.setCredentials({
      access_token: gmailIntegration.accessToken,
      refresh_token: gmailIntegration.refreshToken,
      expiry_date: gmailIntegration.tokenExpiry?.getTime(),
    });

    const gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get client name from invoice
    const clientName = invoice.customer?.name || 'Customer';

    // Generate payment link (adjust URL based on your app structure)
    const paymentLink = `${
      process.env.FRONTEND_URL || 'https://app.hourblock.com'
    }/dashboard/invoices/${invoice._id}`;

    // Format payment date
    const paymentDate = new Date(payment.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Format payment method
    const paymentMethod = payment.metadata?.paymentMethod?.details?.brand
      ? `${
          payment.metadata.paymentMethod.details.brand.charAt(0).toUpperCase() +
          payment.metadata.paymentMethod.details.brand.slice(1)
        } **** ${payment.metadata.paymentMethod.details.last4}`
      : payment.method?.charAt(0).toUpperCase() + payment.method?.slice(1) || 'Online Payment';

    // Generate email content using the template
    const emailTemplate = paymentNotification({
      workspaceName: workspace.name || 'Your Workspace',
      clientName,
      amount: payment.amount,
      currency: payment.metadata?.currency || invoice.settings?.currency || 'USD',
      invoiceNumber: invoice.invoiceNumber || '-',
      paymentDate,
      paymentMethod,
      paymentLink,
      workspaceLogo: workspace.logo || '',
    });

    // Format subject line
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: payment.metadata?.currency || invoice.settings?.currency || 'USD',
    }).format(payment.amount);

    const isDepositPayment = payment.type === 'deposit';
    const subject = `${
      isDepositPayment ? 'Deposit' : 'Payment'
    } Received: ${clientName} - ${formattedAmount}`;

    // Prepare email data
    const emailData = {
      to: gmailIntegration.email, // Send to the workspace's primary email
      subject,
      html: emailTemplate.html,
    };

    // Send the email
    const result = await sendGmailEmail(gmailClient, emailData, gmailIntegration);

    if (result.success) {
      console.log(`Payment notification sent via Gmail to ${gmailIntegration.email}`);
    } else {
      console.error('Failed to send payment notification via Gmail:', result.error);
    }
  } catch (error) {
    console.error('Error in sendPaymentNotificationViaGmail:', error);
  }
};
