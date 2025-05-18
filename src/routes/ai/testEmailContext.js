import { Router } from 'express';
import asyncHandler from '../../middleware/asyncHandler.js';
import { checkGmailIntegration, prepareEmailContext } from '../../utils/gmailUtils.js';

const router = Router();

/**
 * @desc    Test Gmail integration status
 * @route   POST /api/ai/test/check-gmail
 * @access  Private
 */
router.post(
  '/check-gmail',
  asyncHandler(async (req, res) => {
    try {
      const { workspaceId } = req.body;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'workspaceId is required',
        });
      }

      // Check Gmail integration status
      const integrationStatus = await checkGmailIntegration(workspaceId);

      return res.status(200).json({
        success: integrationStatus.status === 'success',
        ...integrationStatus,
      });
    } catch (error) {
      console.error('Error checking Gmail integration:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking Gmail integration',
        error: error.message,
      });
    }
  }),
);

/**
 * @desc    Test the email context functionality
 * @route   POST /api/ai/test/test-email-context
 * @access  Private
 */
router.post(
  '/test-email-context',
  asyncHandler(async (req, res) => {
    try {
      const { workspaceId, emails, allowMockData = false } = req.body;

      // Log the inputs
      console.log('Test Email Context Input:', {
        workspaceId,
        emails: Array.isArray(emails)
          ? emails.map((e) => ({ id: e.id, subject: e.subject }))
          : emails,
        allowMockData,
      });

      if (!workspaceId || !emails || !Array.isArray(emails)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request. workspaceId and emails array are required.',
        });
      }

      // First check Gmail integration status
      const integrationStatus = await checkGmailIntegration(workspaceId);

      // If integration check failed but mock data is allowed, continue anyway
      if (integrationStatus.status !== 'success' && !allowMockData) {
        return res.status(400).json({
          success: false,
          message: 'Gmail integration check failed',
          integrationStatus,
        });
      }

      // Create the email context with optional mock data fallback
      const emailContext = await prepareEmailContext(emails, workspaceId, { allowMockData });

      return res.status(200).json({
        success: true,
        emailContext,
        integrationStatus,
        usedMockData: integrationStatus.status !== 'success' && allowMockData,
        stats: {
          emailCount: emails.length,
          contextLength: emailContext.length,
        },
      });
    } catch (error) {
      console.error('Error in email context test:', error);
      return res.status(500).json({
        success: false,
        message: 'Error testing email context',
        error: error.message,
      });
    }
  }),
);

/**
 * @desc    Fetch a specific email by ID for testing
 * @route   POST /api/ai/test/fetch-email
 * @access  Private
 */
router.post(
  '/fetch-email',
  asyncHandler(async (req, res) => {
    try {
      const { workspaceId, emailId } = req.body;

      if (!workspaceId || !emailId) {
        return res.status(400).json({
          success: false,
          message: 'workspaceId and emailId are required',
        });
      }

      console.log(`Fetching single email ${emailId} for workspace ${workspaceId}`);

      // Check Gmail integration status first
      const integrationStatus = await checkGmailIntegration(workspaceId);

      if (integrationStatus.status !== 'success') {
        return res.status(400).json({
          success: false,
          message: 'Gmail integration check failed',
          integrationStatus,
        });
      }

      // Fetch the specific email
      const emailData = await fetchEmailThread(workspaceId, emailId);

      return res.status(200).json({
        success: true,
        email: {
          ...emailData.email,
          body: emailData.email.body ? truncateForDisplay(emailData.email.body) : null,
        },
        threadCount: emailData.thread ? emailData.thread.length : 0,
        thread: emailData.thread
          ? emailData.thread.map((msg) => ({
              ...msg,
              body: msg.body ? truncateForDisplay(msg.body) : null,
            }))
          : [],
      });
    } catch (error) {
      console.error('Error fetching email:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching email',
        error: error.message,
      });
    }
  }),
);

// Helper function to truncate long HTML/text for display
function truncateForDisplay(text, maxLength = 500) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... (truncated)';
}

export default router;
