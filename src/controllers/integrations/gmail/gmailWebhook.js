import asyncHandler from '../../../middleware/asyncHandler.js';
import GmailIntegration from '../../../models/GmailIntegration.js';
import gmailListenerService from '../../../services/gmailListenerService.js';

/**
 * @desc    Handle Gmail push notification webhook
 * @route   POST /api/gmail/webhook
 * @access  Public (no auth required as it's called by Google)
 */
const gmailWebhook = asyncHandler(async (req, res) => {
  try {
    // Decode the base64 message data
    const message = Buffer.from(req.body.message.data, 'base64').toString();
    const data = JSON.parse(message);
    const { emailAddress, historyId } = data;

    console.log('[Gmail Webhook] Received notification:', {
      emailAddress,
      historyId,
      timestamp: new Date().toISOString(),
    });

    // Find the Gmail integration for this email
    const integration = await GmailIntegration.findOne({ email: emailAddress });
    if (!integration) {
      console.warn('[Gmail Webhook] No integration found for email:', emailAddress);
      return res.status(200).send('OK'); // Still return 200 to acknowledge receipt
    }

    // Process the notification
    await gmailListenerService.handlePushNotification(integration, historyId);

    res.status(200).send('OK');
  } catch (err) {
    console.error('[Gmail Webhook] Failed:', err);
    // Still return 200 to acknowledge receipt, but log the error
    res.status(200).send('OK');
  }
});

export default gmailWebhook;
