import asyncHandler from '../../middleware/asyncHandler.js';

/**
 * @desc    Handle inbound webhook/email callback (e.g. Maileroo, SendGrid, etc.)
 * @route   POST /api/public/inbound
 * @access  Public
 */
const inboundEmailController = asyncHandler(async (req, res) => {
  try {
    // Log the inbound payload for debugging/inspection
    console.log('[Public Inbound] Received payload:', JSON.stringify(req.body, null, 2));

    // TODO: Parse and process the inbound payload here.
    // For now we simply acknowledge receipt.

    return res.status(200).json({ status: 'success', message: 'Inbound payload received' });
  } catch (error) {
    console.error('[Public Inbound] Error handling payload:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process inbound payload',
      error: error.message,
    });
  }
});

export default inboundEmailController;
