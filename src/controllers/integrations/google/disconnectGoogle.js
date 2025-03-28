import asyncHandler from '../../../middleware/asyncHandler.js';
import GoogleCalendar from '../../../models/GoogleCalendar.js';

// @desc    Disconnect Google integrations
// @route   POST /api/integrations/google/disconnect
// @access  Private
const disconnectGoogle = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  // Find and remove the Google Calendar connection
  const calendarCreds = await GoogleCalendar.findOneAndDelete({ user: userId });

  if (!calendarCreds) {
    return res.status(404).json({
      success: false,
      message: 'Google Calendar not connected',
      services: {
        calendar: {
          connected: false,
          message: 'Google Calendar not connected',
        },
      },
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Google Calendar disconnected successfully',
    services: {
      calendar: {
        connected: false,
        message: 'Google Calendar disconnected successfully',
      },
    },
  });
});

export default disconnectGoogle;
