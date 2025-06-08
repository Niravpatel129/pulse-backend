// Handle Stripe Terminal webhook events
export const handleStripeTerminalWebhook = catchAsync(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_TERMINAL_WEBHOOK_SECRET,
    );
  } catch (err) {
    return next(new AppError(`Webhook Error: ${err.message}`, 400));
  }

  // Handle the event
  switch (event.type) {
    case 'terminal.reader.updated':
    case 'terminal.reader.status_changed': {
      const reader = event.data.object;

      // Update reader in our database
      await StripeTerminalReader.findOneAndUpdate(
        { readerId: reader.id },
        {
          status: reader.status,
          lastSeenAt: new Date(),
          batteryLevel: reader.battery_level,
          firmwareVersion: reader.firmware_version,
        },
        { new: true },
      );
      break;
    }

    case 'terminal.reader.deleted': {
      const reader = event.data.object;

      // Mark reader as inactive in our database
      await StripeTerminalReader.findOneAndUpdate(
        { readerId: reader.id },
        { isActive: false },
        { new: true },
      );
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});
